using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Decatron.Core.Models;
using Microsoft.Extensions.Configuration;

namespace Decatron.Services.AI
{
    /// <summary>
    /// Gemini directo (API de Google, sin OpenRouter). Es el respaldo de los módulos que
    /// no pueden quedarse mudos: si OpenRouter falla —el caso real fue el 429 "rate-limited
    /// upstream" de Qwen, que tumbó la mitad de las llamadas del coach el 20-21/09—, se
    /// repite la misma llamada acá. Otra empresa y otra cuota: lo que tira a uno no tira
    /// al otro. Registra cada llamada en ai_usage_logs igual que OpenRouter, así que el
    /// cobro en créditos funciona sin cambios.
    /// </summary>
    public class GeminiChatClient
    {
        private readonly IHttpClientFactory _httpFactory;
        private readonly AiUsageRecorder _usage;
        private readonly string _apiKey;

        public GeminiChatClient(IHttpClientFactory httpFactory, IConfiguration config, AiUsageRecorder usage)
        {
            _httpFactory = httpFactory;
            _usage = usage;
            _apiKey = config["GeminiSettings:ApiKey"] ?? "";
        }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

        /// <summary>
        /// Una llamada. Lanza <see cref="InvalidOperationException"/> si la API responde error
        /// o sin texto. <paramref name="json"/> pide la respuesta como JSON puro, para los
        /// módulos que la parsean (el coach).
        /// </summary>
        public async Task<OpenRouterCompletion> ChatAsync(
            string model, string systemPrompt, string userPrompt, AiCallContext ctx,
            int maxTokens = 256, double temperature = 0.7, TimeSpan? timeout = null, bool json = false, CancellationToken ct = default)
        {
            if (!IsConfigured) throw new InvalidOperationException("API Key de Gemini no configurada");

            var sw = Stopwatch.StartNew();
            var body = new
            {
                system_instruction = new { parts = new[] { new { text = systemPrompt } } },
                contents = new[] { new { role = "user", parts = new[] { new { text = userPrompt } } } },
                generationConfig = json
                    ? (object)new { temperature, maxOutputTokens = maxTokens, responseMimeType = "application/json" }
                    : new { temperature, maxOutputTokens = maxTokens },
                safetySettings = new[]
                {
                    new { category = "HARM_CATEGORY_HARASSMENT",        threshold = "BLOCK_NONE" },
                    new { category = "HARM_CATEGORY_HATE_SPEECH",       threshold = "BLOCK_NONE" },
                    new { category = "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold = "BLOCK_NONE" },
                    new { category = "HARM_CATEGORY_DANGEROUS_CONTENT", threshold = "BLOCK_NONE" },
                }
            };

            using var req = new HttpRequestMessage(HttpMethod.Post,
                $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_apiKey}")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(timeout ?? TimeSpan.FromSeconds(15));

            string text;
            try
            {
                using var res = await _httpFactory.CreateClient("gemini-chat").SendAsync(req, cts.Token);
                text = await res.Content.ReadAsStringAsync(cts.Token);
                if (!res.IsSuccessStatusCode)
                {
                    var err = $"Gemini {(int)res.StatusCode}: {(text.Length > 200 ? text[..200] : text)}";
                    _usage.Record(ctx, "gemini", model, 0, 0, (int)sw.ElapsedMilliseconds, false, err);
                    throw new InvalidOperationException(err);
                }
            }
            catch (Exception ex) when (ex is not InvalidOperationException)
            {
                var msg = ex is OperationCanceledException && !ct.IsCancellationRequested ? "timeout" : ex.Message;
                _usage.Record(ctx, "gemini", model, 0, 0, (int)sw.ElapsedMilliseconds, false, msg);
                throw;
            }

            var node = JsonNode.Parse(text);
            var outText = node?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.GetValue<string>();
            var meta = node?["usageMetadata"];
            var pIn = meta?["promptTokenCount"]?.GetValue<int>() ?? 0;
            var pOut = meta?["candidatesTokenCount"]?.GetValue<int>() ?? 0;

            if (string.IsNullOrWhiteSpace(outText))
            {
                _usage.Record(ctx, "gemini", model, pIn, pOut, (int)sw.ElapsedMilliseconds, false, "respuesta vacía");
                throw new InvalidOperationException("Gemini devolvió una respuesta vacía");
            }

            _usage.Record(ctx, "gemini", model, pIn, pOut, (int)sw.ElapsedMilliseconds, true);
            return new OpenRouterCompletion(outText, pIn, pOut, (int)sw.ElapsedMilliseconds, model);
        }
    }
}
