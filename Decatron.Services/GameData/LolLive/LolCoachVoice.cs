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
    /// Voz del coach, con los mismos motores de la traducción en vivo:
    ///
    ///   standard  Piper, voz propia de Decatron. No cobra créditos. Algo más lenta.
    ///   premium   Deepgram Aura. Cobra créditos TTS del canal, feature "lol_coach".
    ///
    /// Con premium y sin saldo para el clip, sale con Piper en vez de callarse: la voz
    /// cuesta 50-100 veces más que el texto, y quedarse sin créditos de voz no puede
    /// dejar mudo a un coach que todavía tiene saldo para pensar. Devuelve el MP3
    /// completo (clips cortos: no vale la pena streamear al Desktop).
    /// </summary>
    public class LolCoachVoice
    {
        public const string Feature = "lol_coach";
        public const string Standard = "standard";
        public const string Premium = "premium";
        /// <summary>Tope de caracteres por clip para que el plan final no sea un monólogo de 40 s.</summary>
        private const int MaxChars = 420;
        /// <summary>Tope del plan final, que llega con la selección a punto de cerrar.</summary>
        private const int MaxCharsFinal = 280;

        private readonly ITranslationTtsEngine? _premium;
        private readonly ITranslationTtsEngine? _standard;
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<LolCoachVoice> _logger;

        public LolCoachVoice(IEnumerable<ITranslationTtsEngine> engines, IServiceScopeFactory scopes, ILogger<LolCoachVoice> logger)
        {
            var list = engines.ToList();
            _premium = list.FirstOrDefault(e => e.Name == "deepgram");
            _standard = list.FirstOrDefault(e => e.Name == "piper");
            _scopes = scopes; _logger = logger;
        }

        public bool PremiumAvailable => _premium?.IsConfigured == true;
        public bool StandardAvailable => _standard?.IsConfigured == true;
        public bool IsAvailable => PremiumAvailable || StandardAvailable;
        /// <summary>Las voces que se pueden elegir: las de premium. La estándar usa la de fábrica del idioma.</summary>
        public IReadOnlyList<TtsVoice> Voices => _premium?.Voices ?? Array.Empty<TtsVoice>();

        /// <summary>Qué se dice en voz alta según el momento: lo justo, no el JSON entero.</summary>
        public static string TextFor(LiveCoachInfo info, string lang)
        {
            var en = lang.StartsWith("en", StringComparison.OrdinalIgnoreCase);
            var t = info.Kind switch
            {
                "my_turn" when info.Suggestion != null => (en ? $"My pick: {info.Suggestion}. " : $"Mi pick: {info.Suggestion}. ") + info.Comment,
                // Runas y hechizos primero: es lo que el streamer tiene que poner antes de que
                // empiece la partida. El comentario va después y se corta antes (ver abajo).
                "final" => string.Join(" ", new[] { info.Runes != null ? (en ? "Runes: " : "Runas: ") + info.Runes + "." : null, info.Spells != null ? (en ? "Spells: " : "Hechizos: ") + info.Spells + "." : null, info.Comment }.Where(x => x != null)),
                "postgame" => string.Join(" ", new[] { info.Comment }.Concat(info.Tips.Take(2))),
                _ => info.Comment,
            };
            t = t.Replace("\n", " ").Trim();
            // El plan final es el que más apura: más corto = sintetiza y se oye antes.
            var tope = info.Kind == "final" ? MaxCharsFinal : MaxChars;
            return t.Length <= tope ? t : t[..tope].TrimEnd() + "…";
        }

        /// <summary>
        /// El clip, el motor que lo hizo (standard | premium) o el motivo por el que no hay
        /// clip. <c>fellBack</c> = se pidió premium y salió con la estándar por falta de saldo.
        /// </summary>
        public async Task<(byte[]? mp3, string? error, bool fellBack)> SpeakAsync(long userId, LolCoachSettings settings, LiveCoachInfo info, string lang, CancellationToken ct)
        {
            var text = TextFor(info, lang);
            if (text.Length == 0) return (null, null, false);

            var quierePremium = settings.VoiceEngine == Premium && PremiumAvailable;
            if (quierePremium)
            {
                var (mp3, error) = await PremiumAsync(userId, settings, text, lang, ct);
                if (mp3 != null) return (mp3, null, false);
                // Sin saldo o Deepgram caído: la estándar, si está. Si tampoco, el motivo real.
                if (!StandardAvailable) return (null, error, false);
                var (std, stdError) = await StandardAsync(userId, text, lang, ct);
                return (std, std != null ? null : stdError ?? error, std != null);
            }

            if (StandardAvailable)
            {
                var (std, stdError) = await StandardAsync(userId, text, lang, ct);
                return (std, stdError, false);
            }
            return (null, "voice_unavailable", false);
        }

        private async Task<(byte[]? mp3, string? error)> StandardAsync(long userId, string text, string lang, CancellationToken ct)
        {
            try
            {
                return (await SynthAsync(_standard!, text, _standard!.DefaultVoiceFor(lang), ct), null);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[LolCoach] voz estándar falló para user {UserId}", userId);
                return (null, "tts_failed");
            }
        }

        private async Task<(byte[]? mp3, string? error)> PremiumAsync(long userId, LolCoachSettings settings, string text, string lang, CancellationToken ct)
        {
            var engine = _premium!;
            var voice = !string.IsNullOrWhiteSpace(settings.VoiceId) && engine.Voices.Any(v => v.Id == settings.VoiceId) ? settings.VoiceId : engine.DefaultVoiceFor(lang);

            long charged;
            using (var scope = _scopes.CreateScope())
            {
                var credits = scope.ServiceProvider.GetRequiredService<ITtsCreditService>();
                var r = await credits.TryConsumeAsync(userId, text.Length, engine.CreditEngine, Feature, voice, lang);
                if (!r.Allowed) return (null, "no_credits");
                charged = r.CreditsCharged;
            }

            try
            {
                return (await SynthAsync(engine, text, voice, ct), null);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[LolCoach] voz premium falló para user {UserId}", userId);
                using var scope = _scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<ITtsCreditService>().RefundAsync(userId, charged, Feature, "síntesis del coach falló");
                return (null, "tts_failed");
            }
        }

        private static async Task<byte[]> SynthAsync(ITranslationTtsEngine engine, string text, string voice, CancellationToken ct)
        {
            using var ms = new MemoryStream();
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(20));
            await foreach (var chunk in engine.SynthesizeAsync(text, voice, cts.Token)) ms.Write(chunk.Span);
            if (ms.Length == 0) throw new InvalidOperationException("audio vacío");
            return ms.ToArray();
        }
    }
}
