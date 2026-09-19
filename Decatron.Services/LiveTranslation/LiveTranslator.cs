using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// Traduce frase a frase con Gemini. No reutiliza GeminiService a propósito: aquel
    /// está afinado para respuestas de chat (temperatura 0.7, recorte a 500 chars,
    /// filtros de seguridad en MEDIUM). Un streamer dice groserías y eso no puede
    /// bloquear la traducción, y aquí la temperatura tiene que ser baja.
    /// </summary>
    public class LiveTranslator
    {
        private readonly HttpClient _http;
        private readonly string _apiKey;
        private readonly string _model;

        private static readonly Dictionary<string, string> _langNames = new(StringComparer.OrdinalIgnoreCase)
        {
            ["en"] = "English", ["es"] = "Spanish", ["pt"] = "Brazilian Portuguese", ["fr"] = "French",
            ["de"] = "German", ["it"] = "Italian", ["ja"] = "Japanese", ["ko"] = "Korean", ["ru"] = "Russian",
        };

        public static IReadOnlyCollection<string> SupportedLanguages => _langNames.Keys;
        public static string LanguageName(string code) => _langNames.TryGetValue(code, out var n) ? n : code;

        public LiveTranslator(IHttpClientFactory httpFactory, IConfiguration config, IOptions<LiveTranslationOptions> opts)
        {
            _http = httpFactory.CreateClient("live-translator");
            _http.Timeout = TimeSpan.FromSeconds(15);
            _apiKey = config["GeminiSettings:ApiKey"] ?? "";
            _model = opts.Value.TranslationModel;
        }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

        public async Task<string> TranslateAsync(string text, string sourceLang, string targetLang, CancellationToken ct)
        {
            var system =
                $"You are a live interpreter for a Twitch streamer who speaks {LanguageName(sourceLang)}. " +
                $"Translate each utterance into natural spoken {LanguageName(targetLang)} as it would be said out loud by the same person: " +
                "same energy, same register, keep it as short as the original. Keep slang and swearing at the same level as the original: never add profanity, insults or intensity that were not there. " +
                "Gaming terms, usernames, game names and emote names stay untranslated. " +
                "Output ONLY the translation. No quotes, no notes, no explanations.";

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
                $"https://generativelanguage.googleapis.com/v1beta/models/{_model}:generateContent?key={_apiKey}")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };
            using var res = await _http.SendAsync(req, ct);
            var json = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
                throw new InvalidOperationException($"Gemini {(int)res.StatusCode}: {(json.Length > 200 ? json[..200] : json)}");

            var node = JsonNode.Parse(json);
            var outText = node?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(outText))
                throw new InvalidOperationException("Gemini devolvió una respuesta vacía");
            return outText.Trim().Trim('"');
        }
    }
}
