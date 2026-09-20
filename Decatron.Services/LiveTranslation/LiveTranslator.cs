using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Decatron.Core.Models;
using Decatron.Services.AI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// Traduce frase a frase. Va por OpenRouter (modelo configurable desde /admin/ai-costs, sin
    /// redeploy) con timeout corto; si OpenRouter falla, cae a Gemini directo. No reutiliza
    /// GeminiService a propósito: aquel está afinado para chat (temperatura 0.7, recorte a
    /// 500 chars, filtros de seguridad en MEDIUM). Un streamer dice groserías y eso no puede
    /// bloquear la traducción, y aquí la temperatura tiene que ser baja.
    /// Cada llamada queda en ai_usage_logs bajo el módulo "translation".
    /// </summary>
    public class LiveTranslator
    {
        public const string Module = "translation";

        /// <summary>Más que esto y la frase llega tarde: mejor perderla y seguir con la siguiente.</summary>
        private static readonly TimeSpan OpenRouterTimeout = TimeSpan.FromSeconds(4);

        private readonly HttpClient _http;
        private readonly OpenRouterClient _openRouter;
        private readonly AiSettingsCache _settings;
        private readonly AiUsageRecorder _usage;
        private readonly ILogger<LiveTranslator> _logger;
        private readonly string _geminiKey;
        private readonly string _geminiModel;

        private static readonly Dictionary<string, string> _langNames = new(StringComparer.OrdinalIgnoreCase)
        {
            ["en"] = "English", ["es"] = "Spanish", ["pt"] = "Brazilian Portuguese", ["fr"] = "French",
            ["de"] = "German", ["it"] = "Italian", ["ja"] = "Japanese", ["ko"] = "Korean", ["ru"] = "Russian",
        };

        public static IReadOnlyCollection<string> SupportedLanguages => _langNames.Keys;
        public static string LanguageName(string code) => _langNames.TryGetValue(code, out var n) ? n : code;

        public LiveTranslator(IHttpClientFactory httpFactory, IConfiguration config, IOptions<LiveTranslationOptions> opts,
            OpenRouterClient openRouter, AiSettingsCache settings, AiUsageRecorder usage, ILogger<LiveTranslator> logger)
        {
            _http = httpFactory.CreateClient("live-translator");
            _http.Timeout = TimeSpan.FromSeconds(15);
            _openRouter = openRouter;
            _settings = settings;
            _usage = usage;
            _logger = logger;
            _geminiKey = config["GeminiSettings:ApiKey"] ?? "";
            _geminiModel = opts.Value.GeminiFallbackModel;
        }

        public bool IsConfigured => _openRouter.IsConfigured || !string.IsNullOrWhiteSpace(_geminiKey);

        private static string SystemPrompt(string sourceLang, string targetLang) =>
            $"You are a live interpreter for a Twitch streamer who speaks {LanguageName(sourceLang)}. " +
            $"Translate each utterance into natural spoken {LanguageName(targetLang)} as it would be said out loud by the same person: " +
            "same energy, same register, keep it as short as the original. Keep slang and swearing at the same level as the original: never add profanity, insults or intensity that were not there. " +
            "Gaming terms, usernames, game names and emote names stay untranslated. " +
            "Output ONLY the translation. No quotes, no notes, no explanations.";

        public async Task<string> TranslateAsync(string text, string sourceLang, string targetLang, long userId, string login, CancellationToken ct)
        {
            var ctx = new AiCallContext(Module, userId, login);
            var system = SystemPrompt(sourceLang, targetLang);

            if (_openRouter.IsConfigured)
            {
                try
                {
                    var r = await _openRouter.ChatAsync(_settings.TranslationModel, system, text, ctx,
                        maxTokens: 256, temperature: 0.2, timeout: OpenRouterTimeout, reasoning: false, ct: ct);
                    return Clean(r.Text);
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
                catch (Exception ex)
                {
                    if (string.IsNullOrWhiteSpace(_geminiKey)) throw;
                    _logger.LogWarning("[LiveTranslation] OpenRouter falló ({Err}); fallback a Gemini {Model}", ex.Message, _geminiModel);
                }
            }

            return await TranslateWithGeminiAsync(text, system, ctx, ct);
        }

        private async Task<string> TranslateWithGeminiAsync(string text, string system, AiCallContext ctx, CancellationToken ct)
        {
            var sw = Stopwatch.StartNew();
            var body = new
            {
                system_instruction = new { parts = new[] { new { text = system } } },
                contents = new[] { new { role = "user", parts = new[] { new { text } } } },
                generationConfig = new { temperature = 0.2, maxOutputTokens = 256 },
                safetySettings = new[]
                {
                    new { category = "HARM_CATEGORY_HARASSMENT",        threshold = "BLOCK_NONE" },
                    new { category = "HARM_CATEGORY_HATE_SPEECH",       threshold = "BLOCK_NONE" },
                    new { category = "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold = "BLOCK_NONE" },
                    new { category = "HARM_CATEGORY_DANGEROUS_CONTENT", threshold = "BLOCK_NONE" },
                }
            };

            using var req = new HttpRequestMessage(HttpMethod.Post,
                $"https://generativelanguage.googleapis.com/v1beta/models/{_geminiModel}:generateContent?key={_geminiKey}")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };

            string json;
            try
            {
                using var res = await _http.SendAsync(req, ct);
                json = await res.Content.ReadAsStringAsync(ct);
                if (!res.IsSuccessStatusCode)
                {
                    var err = $"Gemini {(int)res.StatusCode}: {(json.Length > 200 ? json[..200] : json)}";
                    _usage.Record(ctx, "gemini", _geminiModel, 0, 0, (int)sw.ElapsedMilliseconds, false, err);
                    throw new InvalidOperationException(err);
                }
            }
            catch (Exception ex) when (ex is not InvalidOperationException)
            {
                _usage.Record(ctx, "gemini", _geminiModel, 0, 0, (int)sw.ElapsedMilliseconds, false, ex.Message);
                throw;
            }

            var node = JsonNode.Parse(json);
            var outText = node?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.GetValue<string>();
            var meta = node?["usageMetadata"];
            var pIn = meta?["promptTokenCount"]?.GetValue<int>() ?? 0;
            var pOut = meta?["candidatesTokenCount"]?.GetValue<int>() ?? 0;

            if (string.IsNullOrWhiteSpace(outText))
            {
                _usage.Record(ctx, "gemini", _geminiModel, pIn, pOut, (int)sw.ElapsedMilliseconds, false, "respuesta vacía");
                throw new InvalidOperationException("Gemini devolvió una respuesta vacía");
            }
            _usage.Record(ctx, "gemini", _geminiModel, pIn, pOut, (int)sw.ElapsedMilliseconds, true);
            return Clean(outText);
        }

        private static string Clean(string s) => s.Trim().Trim('"');
    }
}
