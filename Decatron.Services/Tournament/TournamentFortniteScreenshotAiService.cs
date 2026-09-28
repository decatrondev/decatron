using System.Text.Json;
using System.Text.RegularExpressions;
using Decatron.Core.Models;
using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services.AI;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tournament
{
    /// <summary>
    /// Lee una captura de la pantalla final de Fortnite con IA para prellenar el
    /// reporte (.dev/torneos/15-fortnite.md F8). Apagada por defecto; la activa el
    /// streamer y se cobra de los creditos de su canal como el resto de la IA
    /// (AiUsageRecorder + AiCreditGate). El jugador siempre confirma lo que se leyo.
    /// </summary>
    public class TournamentFortniteScreenshotAiService
    {
        public const string Module = "fortnite-screenshot";

        // Tope por jugador para que nadie gaste los creditos del streamer subiendo
        // capturas en bucle.
        private const int MaxReadsPerWindow = 6;
        private static readonly TimeSpan Window = TimeSpan.FromMinutes(15);

        private const string SystemPrompt =
            "Lees capturas de Fortnite. Te dan la pantalla del final de una partida de un jugador " +
            "(la que muestra el puesto, por ejemplo \"#3\" o \"¡Victoria magistral!\"/\"Victory Royale\" para el puesto 1, " +
            "y las eliminaciones del jugador, por ejemplo \"Eliminaciones 5\" o \"Eliminations 5\"). " +
            "Responde SOLO un JSON, sin texto alrededor: " +
            "{\"is_result_screen\": true|false, \"placement\": numero o null, \"eliminations\": numero o null}. " +
            "Si un dato no se ve con claridad, ponlo en null. No inventes numeros.";

        private readonly OpenRouterClient _openRouter;
        private readonly AiSettingsCache _settings;
        private readonly AiCreditGate _credits;
        private readonly ILogger<TournamentFortniteScreenshotAiService> _logger;

        public TournamentFortniteScreenshotAiService(OpenRouterClient openRouter, AiSettingsCache settings, AiCreditGate credits, ILogger<TournamentFortniteScreenshotAiService> logger)
        {
            _openRouter = openRouter;
            _settings = settings;
            _credits = credits;
            _logger = logger;
        }

        public class Reading
        {
            public int? Placement { get; set; }
            public int? Eliminations { get; set; }
            public string? Note { get; set; }
        }

        /// <summary>
        /// Lee la captura y guarda lo leido en el archivo. (null, motivo) si no se pudo
        /// leer: sin creditos, tope de lecturas, IA caida o respuesta sin sentido. Nunca
        /// frena el reporte: el jugador siempre puede escribir los numeros a mano.
        /// </summary>
        public async Task<(Reading? reading, string? error)> ReadAsync(
            DecatronDbContext db, TournamentEdition edition, TournamentFortniteFile file, byte[] jpeg, long userId, CancellationToken ct = default)
        {
            if (!_openRouter.IsConfigured) return (null, "La lectura con IA no está disponible ahora");

            var since = DateTime.UtcNow - Window;
            var recentReads = await db.TournamentFortniteFiles.CountAsync(f =>
                f.TournamentEditionId == edition.Id && f.UploadedByUserId == userId && f.AiReadAt != null && f.AiReadAt > since, ct);
            if (recentReads >= MaxReadsPerWindow)
                return (null, "Leíste muchas capturas seguidas: escribe los números a mano o espera unos minutos");

            if (!await _credits.HasCreditsAsync(edition.ChannelOwnerId))
                return (null, "El canal no tiene créditos para leer capturas con IA: escribe los números a mano");

            var channelName = await db.Users.Where(u => u.Id == edition.ChannelOwnerId).Select(u => u.Login).FirstOrDefaultAsync(ct);
            var ctx = new AiCallContext(Module, edition.ChannelOwnerId, channelName);

            OpenRouterCompletion completion;
            try
            {
                await _settings.EnsureFreshAsync();
                completion = await _openRouter.ChatWithImageAsync(_settings.CoachModel, SystemPrompt, "Lee esta captura.", jpeg, ctx, ct: ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[FortniteAI] No se pudo leer la captura {FileId}", file.Id);
                return (null, "La IA no pudo leer la captura: escribe los números a mano");
            }

            var reading = Parse(completion.Text);
            file.AiReadAt = DateTime.UtcNow;
            if (reading == null)
            {
                file.AiNote = "No se pudo interpretar la respuesta de la IA";
                await db.SaveChangesAsync(ct);
                return (null, "La IA no pudo leer la captura: escribe los números a mano");
            }

            file.AiPlacement = (short?)reading.Placement;
            file.AiEliminations = (short?)reading.Eliminations;
            file.AiNote = reading.Note;
            await db.SaveChangesAsync(ct);
            return (reading, null);
        }

        private static Reading? Parse(string text)
        {
            var match = Regex.Match(text, @"\{[\s\S]*\}");
            if (!match.Success) return null;
            try
            {
                using var doc = JsonDocument.Parse(match.Value);
                var root = doc.RootElement;
                int? Num(string name) =>
                    root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n) ? n : null;

                var isResult = !root.TryGetProperty("is_result_screen", out var r) || r.ValueKind != JsonValueKind.False;
                var placement = Num("placement");
                var eliminations = Num("eliminations");
                // Valores imposibles = no leidos.
                if (placement is < 1 or > 100) placement = null;
                if (eliminations is < 0 or > 99) eliminations = null;

                return new Reading
                {
                    Placement = isResult ? placement : null,
                    Eliminations = isResult ? eliminations : null,
                    Note = !isResult ? "No parece la pantalla final de la partida"
                        : placement == null || eliminations == null ? "No se leyó todo con claridad" : null,
                };
            }
            catch
            {
                return null;
            }
        }
    }
}
