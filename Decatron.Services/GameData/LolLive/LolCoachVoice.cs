using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models.GameOverlays;
using Decatron.Services.LiveTranslation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.GameData.LolLive
{
    /// <summary>
    /// Voz del coach: sintetiza lo que dijo con el mismo motor de la traducción en vivo
    /// (Deepgram Aura) y lo cobra en créditos TTS del canal, feature "lol_coach". Devuelve
    /// el MP3 completo (clips cortos: no vale la pena streamear al Desktop).
    /// </summary>
    public class LolCoachVoice
    {
        public const string Feature = "lol_coach";
        /// <summary>Tope de caracteres por clip para que el plan final no sea un monólogo de 40 s.</summary>
        private const int MaxChars = 420;

        private readonly ITranslationTtsEngine? _engine;
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<LolCoachVoice> _logger;

        public LolCoachVoice(IEnumerable<ITranslationTtsEngine> engines, IServiceScopeFactory scopes, ILogger<LolCoachVoice> logger)
        {
            _engine = engines.FirstOrDefault(e => e.Name == "deepgram");
            _scopes = scopes; _logger = logger;
        }

        public bool IsAvailable => _engine?.IsConfigured == true;
        public IReadOnlyList<TtsVoice> Voices => _engine?.Voices ?? Array.Empty<TtsVoice>();
        public string DefaultVoiceFor(string lang) => _engine?.DefaultVoiceFor(lang) ?? "";

        /// <summary>Qué se dice en voz alta según el momento: lo justo, no el JSON entero.</summary>
        public static string TextFor(LiveCoachInfo info, string lang)
        {
            var en = lang.StartsWith("en", StringComparison.OrdinalIgnoreCase);
            var t = info.Kind switch
            {
                "my_turn" when info.Suggestion != null => (en ? $"My pick: {info.Suggestion}. " : $"Mi pick: {info.Suggestion}. ") + info.Comment,
                "final" => string.Join(" ", new[] { info.Comment, info.Runes != null ? (en ? "Runes: " : "Runas: ") + info.Runes + "." : null, info.Spells != null ? (en ? "Spells: " : "Hechizos: ") + info.Spells + "." : null }.Where(x => x != null)),
                "postgame" => string.Join(" ", new[] { info.Comment }.Concat(info.Tips.Take(2))),
                _ => info.Comment,
            };
            t = t.Replace("\n", " ").Trim();
            return t.Length <= MaxChars ? t : t[..MaxChars].TrimEnd() + "…";
        }

        public async Task<(byte[]? mp3, string? error)> SpeakAsync(long userId, LolCoachSettings settings, LiveCoachInfo info, string lang, CancellationToken ct)
        {
            if (_engine == null || !_engine.IsConfigured) return (null, "voice_unavailable");
            var text = TextFor(info, lang);
            if (text.Length == 0) return (null, null);
            var voice = !string.IsNullOrWhiteSpace(settings.VoiceId) && _engine.Voices.Any(v => v.Id == settings.VoiceId) ? settings.VoiceId : _engine.DefaultVoiceFor(lang);

            long charged;
            using (var scope = _scopes.CreateScope())
            {
                var credits = scope.ServiceProvider.GetRequiredService<ITtsCreditService>();
                var r = await credits.TryConsumeAsync(userId, text.Length, _engine.CreditEngine, Feature, voice, lang);
                if (!r.Allowed) return (null, "no_credits");
                charged = r.CreditsCharged;
            }

            try
            {
                using var ms = new MemoryStream();
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(TimeSpan.FromSeconds(20));
                await foreach (var chunk in _engine.SynthesizeAsync(text, voice, cts.Token)) ms.Write(chunk.Span);
                if (ms.Length == 0) throw new InvalidOperationException("audio vacío");
                return (ms.ToArray(), null);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[LolCoach] voz falló para user {UserId}", userId);
                using var scope = _scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<ITtsCreditService>().RefundAsync(userId, charged, Feature, "síntesis del coach falló");
                return (null, "tts_failed");
            }
        }
    }
}
