using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Decatron.Core.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.AI
{
    /// <summary>Resultado crudo de una chat completion de OpenRouter.</summary>
    public sealed record OpenRouterCompletion(string Text, int PromptTokens, int CompletionTokens, int ResponseTimeMs, string Model);

    /// <summary>
    /// Cliente mínimo de OpenRouter (chat completions, sin streaming). Singleton: lo usan tanto
    /// el chat como la traducción en vivo. Registra cada llamada en ai_usage_logs.
    /// Plan: .dev/plans/AI_OPENROUTER_UNIFICACION_PLAN.md
    /// </summary>
    public class OpenRouterClient
    {
        public const string BaseUrl = "https://openrouter.ai/api/v1";

        private readonly IHttpClientFactory _httpFactory;
        private readonly AiUsageRecorder _usage;
        private readonly ILogger<OpenRouterClient> _logger;
        private readonly string _apiKey;

        public OpenRouterClient(IHttpClientFactory httpFactory, IConfiguration config, AiUsageRecorder usage, ILogger<OpenRouterClient> logger)
        {
            _httpFactory = httpFactory;
            _usage = usage;
            _logger = logger;
            _apiKey = config["OpenRouterSettings:ApiKey"] ?? "";
        }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

        public HttpRequestMessage NewRequest(HttpMethod method, string path)
        {
            var req = new HttpRequestMessage(method, BaseUrl + path);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            req.Headers.Add("HTTP-Referer", "https://decatron.net");
            req.Headers.Add("X-Title", "Decatron Bot");
            return req;
        }

        /// <summary>
        /// Una chat completion. Lanza <see cref="InvalidOperationException"/> si la API responde error
        /// o sin contenido; <see cref="TaskCanceledException"/> si vence <paramref name="timeout"/>.
        /// <paramref name="reasoning"/> va en false por defecto: los modelos "thinking" (Qwen 3.8, DeepSeek V4)
        /// gastan todo el max_tokens pensando y devuelven contenido vacío. Solo activarlo para análisis largos.
        /// </summary>
        public async Task<OpenRouterCompletion> ChatAsync(
            string model, string systemPrompt, string userPrompt, AiCallContext ctx,
            int maxTokens = 256, double temperature = 0.7, TimeSpan? timeout = null, bool reasoning = false, CancellationToken ct = default)
        {
            if (!IsConfigured) throw new InvalidOperationException("API Key de OpenRouter no configurada");

            var sw = Stopwatch.StartNew();
            var body = new
            {
                model,
                max_tokens = maxTokens,
                temperature,
                reasoning = new { enabled = reasoning },
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt },
                },
            };

            using var req = NewRequest(HttpMethod.Post, "/chat/completions");
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(timeout ?? TimeSpan.FromSeconds(30));

            var http = _httpFactory.CreateClient("openrouter");
            string json;
            HttpResponseMessage res;
            try
            {
                res = await http.SendAsync(req, cts.Token);
                json = await res.Content.ReadAsStringAsync(cts.Token);
            }
            catch (Exception ex)
            {
                sw.Stop();
                var msg = ex is OperationCanceledException && !ct.IsCancellationRequested ? "timeout" : ex.Message;
                _usage.Record(ctx, "openrouter", model, 0, 0, (int)sw.ElapsedMilliseconds, false, msg);
                throw;
            }

            sw.Stop();
            using (res)
            {
                if (!res.IsSuccessStatusCode)
                {
                    var err = $"OpenRouter {(int)res.StatusCode}: {(json.Length > 200 ? json[..200] : json)}";
                    _logger.LogError("❌ [OPENROUTER] {Module} {Model}: {Err}", ctx.Module, model, err);
                    _usage.Record(ctx, "openrouter", model, 0, 0, (int)sw.ElapsedMilliseconds, false, err);
                    throw new InvalidOperationException(err);
                }
            }

            var node = JsonNode.Parse(json);
            var text = node?["choices"]?[0]?["message"]?["content"]?.GetValue<string>();
            var usage = node?["usage"];
            var pIn = usage?["prompt_tokens"]?.GetValue<int>() ?? 0;
            var pOut = usage?["completion_tokens"]?.GetValue<int>() ?? 0;
            decimal? cost = usage?["cost"] is { } c ? c.GetValue<decimal>() : null;
            var usedModel = node?["model"]?.GetValue<string>() ?? model;

            if (string.IsNullOrWhiteSpace(text))
            {
                _usage.Record(ctx, "openrouter", model, pIn, pOut, (int)sw.ElapsedMilliseconds, false, "respuesta vacía");
                throw new InvalidOperationException("OpenRouter devolvió una respuesta vacía");
            }

            _usage.Record(ctx, "openrouter", model, pIn, pOut, (int)sw.ElapsedMilliseconds, true, actualCostUsd: cost);
            _logger.LogInformation("✅ [OPENROUTER] {Module} {Model} {Ms}ms in={In} out={Out} ${Cost}", ctx.Module, usedModel, sw.ElapsedMilliseconds, pIn, pOut, cost);
            return new OpenRouterCompletion(text, pIn, pOut, (int)sw.ElapsedMilliseconds, usedModel);
        }

        /// <summary>Saldo de la cuenta: (créditos comprados, gastados). Null si falla.</summary>
        public async Task<(decimal TotalCredits, decimal TotalUsage)?> GetCreditsAsync(CancellationToken ct = default)
        {
            if (!IsConfigured) return null;
            try
            {
                using var req = NewRequest(HttpMethod.Get, "/credits");
                var http = _httpFactory.CreateClient("openrouter");
                using var res = await http.SendAsync(req, ct);
                if (!res.IsSuccessStatusCode) return null;
                var node = JsonNode.Parse(await res.Content.ReadAsStringAsync(ct))?["data"];
                return (node?["total_credits"]?.GetValue<decimal>() ?? 0, node?["total_usage"]?.GetValue<decimal>() ?? 0);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[OPENROUTER] No se pudo leer el saldo");
                return null;
            }
        }
    }
}
