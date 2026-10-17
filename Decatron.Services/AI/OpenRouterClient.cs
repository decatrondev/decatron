using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Decatron.Core.Interfaces;
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
        private readonly AiSettingsCache _settings;
        private readonly ILogger<OpenRouterClient> _logger;

        /// <summary>OpenRouter acepta pocos modelos por petición: el principal y hasta tres de respaldo.</summary>
        private const int MaxModels = 4;
        private readonly string _apiKey;
        private readonly IByoKeys? _byo;

        public OpenRouterClient(IHttpClientFactory httpFactory, IConfiguration config, AiUsageRecorder usage, AiSettingsCache settings, ILogger<OpenRouterClient> logger, IByoKeys? byo = null)
        {
            _byo = byo;
            _httpFactory = httpFactory;
            _usage = usage;
            _settings = settings;
            _logger = logger;
            _apiKey = config["OpenRouterSettings:ApiKey"] ?? "";
        }

        /// <summary>
        /// #1: la llave de appsettings. Otro tenant (Fase 5.8): SU llave de IA; sin ella la IA queda apagada (nunca se usa la del #1).
        /// </summary>
        public bool IsConfigured => (TenantAmbient.Current ?? 1) == 1 ? !string.IsNullOrWhiteSpace(_apiKey) : _byo?.IsAvailable(ByoProviders.Ai) == true;

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
        public Task<OpenRouterCompletion> ChatAsync(
            string model, string systemPrompt, string userPrompt, AiCallContext ctx,
            int maxTokens = 256, double temperature = 0.7, TimeSpan? timeout = null, bool reasoning = false, CancellationToken ct = default)
            => SendAsync(model, new object[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt },
            }, ctx, maxTokens, temperature, timeout, reasoning, ct);

        /// <summary>
        /// Igual que <see cref="ChatAsync"/> pero el mensaje del usuario lleva una imagen
        /// (JPEG). Solo sirve con modelos que aceptan imágenes: los de respaldo del admin
        /// también tienen que aceptarlas (hoy Qwen 3.8 Flash, GPT-6 Luna y DeepSeek V4.1
        /// Flash las aceptan, verificado en /models de OpenRouter el 27-09-2026).
        /// </summary>
        public Task<OpenRouterCompletion> ChatWithImageAsync(
            string model, string systemPrompt, string userPrompt, byte[] jpeg, AiCallContext ctx,
            int maxTokens = 200, double temperature = 0, TimeSpan? timeout = null, CancellationToken ct = default)
            => SendAsync(model, new object[]
            {
                new { role = "system", content = systemPrompt },
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new { type = "text", text = userPrompt },
                        new { type = "image_url", image_url = new { url = "data:image/jpeg;base64," + Convert.ToBase64String(jpeg) } },
                    },
                },
            }, ctx, maxTokens, temperature, timeout ?? TimeSpan.FromSeconds(45), false, ct);

        private async Task<OpenRouterCompletion> SendAsync(
            string model, object[] messages, AiCallContext ctx,
            int maxTokens, double temperature, TimeSpan? timeout, bool reasoning, CancellationToken ct)
        {
            var tenant = TenantAmbient.Current ?? 1;
            ByoKey? byo = null;
            if (tenant != 1)
            {
                // Fase 5.8: el tenant usa SU llave, su URL y sus modelos; sin llave la IA queda apagada
                byo = _byo is null ? null : await _byo.GetAsync(ByoProviders.Ai, tenant, ct);
                if (byo is null || string.IsNullOrWhiteSpace(byo.Config.GetValueOrDefault("model")) || string.IsNullOrWhiteSpace(byo.Config.GetValueOrDefault("base_url")))
                    throw new InvalidOperationException("byo_not_configured");
                return await SendByoAsync(byo, messages, ctx, maxTokens, temperature, timeout, reasoning, ct);
            }
            if (!IsConfigured) throw new InvalidOperationException("API Key de OpenRouter no configurada");
            await _settings.EnsureFreshAsync();

            var sw = Stopwatch.StartNew();
            // El principal y los de respaldo del admin. Con más de uno va `models` y no
            // `model`: OpenRouter prueba en orden y pasa al siguiente si el anterior da 429,
            // está caído o rechaza — todo dentro de esta misma petición, sin tiempo extra
            // de ida y vuelta. Se cobra solo el que respondió.
            var models = new[] { model }.Concat(_settings.FallbackModels)
                .Distinct(StringComparer.OrdinalIgnoreCase).Take(MaxModels).ToArray();
            var body = new
            {
                models,
                max_tokens = maxTokens,
                temperature,
                reasoning = new { enabled = reasoning },
                messages,
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

            // Se registra el modelo que respondió de verdad: si fue uno de respaldo, el admin
            // tiene que poder ver cuántas veces se cayó el principal.
            _usage.Record(ctx, "openrouter", usedModel, pIn, pOut, (int)sw.ElapsedMilliseconds, true, actualCostUsd: cost);
            if (!string.Equals(usedModel, model, StringComparison.OrdinalIgnoreCase))
                _logger.LogWarning("⚠️ [OPENROUTER] {Module}: {Primary} no respondió, contestó el respaldo {Used}", ctx.Module, model, usedModel);
            _logger.LogInformation("✅ [OPENROUTER] {Module} {Model} {Ms}ms in={In} out={Out} ${Cost}", ctx.Module, usedModel, sw.ElapsedMilliseconds, pIn, pOut, cost);
            return new OpenRouterCompletion(text, pIn, pOut, (int)sw.ElapsedMilliseconds, usedModel);
        }

        /// <summary>
        /// Chat completion con la llave del tenant (Fase 5.8): API compatible con OpenAI en la URL que cargó. El modelo principal y, si hay, el de
        /// respaldo (se prueba el segundo solo si el primero falla). El costo lo paga el proveedor del tenant: no se cobran créditos de Decatron.
        /// </summary>
        private async Task<OpenRouterCompletion> SendByoAsync(ByoKey key, object[] messages, AiCallContext ctx, int maxTokens, double temperature, TimeSpan? timeout, bool reasoning, CancellationToken ct)
        {
            var baseUrl = key.Config["base_url"].TrimEnd('/');
            var isOpenRouter = new Uri(baseUrl).Host.EndsWith("openrouter.ai", StringComparison.OrdinalIgnoreCase);
            var models = new[] { key.Config["model"], key.Config.GetValueOrDefault("fallback_model") }
                .Where(m => !string.IsNullOrWhiteSpace(m)).Select(m => m!).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

            Exception? last = null;
            foreach (var model in models)
            {
                var sw = Stopwatch.StartNew();
                try
                {
                    // `reasoning` es propio de OpenRouter: otros proveedores pueden rechazar campos que no conocen.
                    object body = isOpenRouter
                        ? new { model, max_tokens = maxTokens, temperature, reasoning = new { enabled = reasoning }, messages }
                        : new { model, max_tokens = maxTokens, temperature, messages };
                    using var req = new HttpRequestMessage(HttpMethod.Post, baseUrl + "/chat/completions");
                    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key.ApiKey);
                    req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

                    using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                    cts.CancelAfter(timeout ?? TimeSpan.FromSeconds(30));
                    using var res = await _httpFactory.CreateClient("openrouter").SendAsync(req, cts.Token);
                    var json = await res.Content.ReadAsStringAsync(cts.Token);
                    sw.Stop();
                    if (!res.IsSuccessStatusCode)
                    {
                        // Sin el cuerpo: puede repetir datos del pedido. Solo el codigo.
                        _usage.Record(ctx, "byo-ai", model, 0, 0, (int)sw.ElapsedMilliseconds, false, $"HTTP {(int)res.StatusCode}");
                        last = new InvalidOperationException($"IA del tenant: HTTP {(int)res.StatusCode}");
                        continue;
                    }
                    var node = JsonNode.Parse(json);
                    var text = node?["choices"]?[0]?["message"]?["content"]?.GetValue<string>();
                    var pIn = node?["usage"]?["prompt_tokens"]?.GetValue<int>() ?? 0;
                    var pOut = node?["usage"]?["completion_tokens"]?.GetValue<int>() ?? 0;
                    if (string.IsNullOrWhiteSpace(text))
                    {
                        _usage.Record(ctx, "byo-ai", model, pIn, pOut, (int)sw.ElapsedMilliseconds, false, "respuesta vacía");
                        last = new InvalidOperationException("La IA del tenant devolvió una respuesta vacía");
                        continue;
                    }
                    _usage.Record(ctx, "byo-ai", model, pIn, pOut, (int)sw.ElapsedMilliseconds, true);
                    _logger.LogInformation("✅ [BYO-AI] {Module} {Model} {Ms}ms in={In} out={Out}", ctx.Module, model, sw.ElapsedMilliseconds, pIn, pOut);
                    return new OpenRouterCompletion(text, pIn, pOut, (int)sw.ElapsedMilliseconds, model);
                }
                catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
                {
                    sw.Stop();
                    _usage.Record(ctx, "byo-ai", model, 0, 0, (int)sw.ElapsedMilliseconds, false, ex is OperationCanceledException ? "timeout" : ex.GetType().Name);
                    last = ex;
                }
            }
            throw last ?? new InvalidOperationException("byo_not_configured");
        }

        /// <summary>Saldo de la cuenta: (créditos comprados, gastados). Null si falla.</summary>
        public async Task<(decimal TotalCredits, decimal TotalUsage)?> GetCreditsAsync(CancellationToken ct = default)
        {
            if ((TenantAmbient.Current ?? 1) != 1 || string.IsNullOrWhiteSpace(_apiKey)) return null; // el saldo es de la cuenta de Decatron
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
