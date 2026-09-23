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

        private readonly OpenRouterClient _openRouter;
        private readonly GeminiChatClient _gemini;
        private readonly AiSettingsCache _settings;
        private readonly ILogger<LiveTranslator> _logger;
        private readonly string _geminiModel;

        private static readonly Dictionary<string, string> _langNames = new(StringComparer.OrdinalIgnoreCase)
        {
            ["en"] = "English", ["es"] = "Spanish", ["pt"] = "Brazilian Portuguese", ["fr"] = "French",
            ["de"] = "German", ["it"] = "Italian", ["ja"] = "Japanese", ["ko"] = "Korean", ["ru"] = "Russian",
        };

        public static IReadOnlyCollection<string> SupportedLanguages => _langNames.Keys;
        public static string LanguageName(string code) => _langNames.TryGetValue(code, out var n) ? n : code;

        public LiveTranslator(IOptions<LiveTranslationOptions> opts,
            OpenRouterClient openRouter, GeminiChatClient gemini, AiSettingsCache settings, ILogger<LiveTranslator> logger)
        {
            _openRouter = openRouter;
            _gemini = gemini;
            _settings = settings;
            _logger = logger;
            _geminiModel = opts.Value.GeminiFallbackModel;
        }

        public bool IsConfigured => _openRouter.IsConfigured || _gemini.IsConfigured;

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
            await _settings.EnsureFreshAsync();

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
                    if (!_gemini.IsConfigured) throw;
                    _logger.LogWarning("[LiveTranslation] OpenRouter falló ({Err}); fallback a Gemini {Model}", ex.Message, _geminiModel);
                }
            }

            return await TranslateWithGeminiAsync(text, system, ctx, ct);
        }

        private async Task<string> TranslateWithGeminiAsync(string text, string system, AiCallContext ctx, CancellationToken ct)
        {
            var r = await _gemini.ChatAsync(_geminiModel, system, text, ctx, maxTokens: 256, temperature: 0.2, ct: ct);
            return Clean(r.Text);
        }

        private static string Clean(string s) => s.Trim().Trim('"');
    }
}
