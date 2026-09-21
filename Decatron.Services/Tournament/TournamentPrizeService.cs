using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Tournament
{
    public class PrizeLeaderResult
    {
        public long? ParticipantId { get; set; }
        public string? DisplayName { get; set; }
        public decimal? Value { get; set; }
    }

    /// <summary>
    /// Resuelve el "lider actual" de un premio por metrica. Simplificacion
    /// deliberada de Milestone 1 vs. el diseno completo de
    /// .dev/torneos/06-premios-pagos-sponsors.md #2: un switch fijo de 5 metricas
    /// calculadas sobre TournamentLpSnapshot, no un catalogo TournamentMetricDefinition
    /// editable — alcanza para lo que hoy se puede calcular con los datos que guarda
    /// el poller. Se recalcula siempre al pedirlo (sin cache), igual criterio que
    /// TournamentStandingsService — valido mientras el volumen de partidas por
    /// edicion sea chico.
    /// </summary>
    public class TournamentPrizeService
    {
        public static readonly Dictionary<string, string> MetricLabels = new()
        {
            ["most_kills"] = "Mas kills (total)",
            ["most_assists"] = "Mas asistencias (total)",
            ["most_wins"] = "Mas victorias",
            ["best_kda"] = "Mejor KDA promedio (min. 5 partidas)",
            ["longest_win_streak"] = "Racha de victorias mas larga",
        };

        public async Task<PrizeLeaderResult> GetLeaderAsync(DecatronDbContext db, long editionId, string metricKey, CancellationToken ct = default)
        {
            var participants = await db.TournamentParticipants
                .Where(p => p.TournamentEditionId == editionId && p.Status != "rejected" && p.Status != "withdrawn")
                .Select(p => new { p.Id, p.DisplayName })
                .ToListAsync(ct);

            PrizeLeaderResult? best = null;

            foreach (var p in participants)
            {
                var snapshots = await db.TournamentLpSnapshots
                    .Where(s => s.TournamentParticipantId == p.Id)
                    .OrderBy(s => s.OccurredAt)
                    .ToListAsync(ct);

                if (snapshots.Count == 0) continue;

                decimal? value = metricKey switch
                {
                    "most_kills" => snapshots.Sum(s => (decimal)s.Kills),
                    "most_assists" => snapshots.Sum(s => (decimal)s.Assists),
                    "most_wins" => snapshots.Count(s => s.Result == "win"),
                    "best_kda" => snapshots.Count >= 5
                        ? Math.Round((snapshots.Sum(s => s.Kills) + snapshots.Sum(s => s.Assists)) / (decimal)Math.Max(1, snapshots.Sum(s => s.Deaths)), 2)
                        : null,
                    "longest_win_streak" => LongestStreak(snapshots.Select(s => s.Result == "win").ToList()),
                    _ => null,
                };

                if (value == null) continue;
                if (best == null || value > best.Value)
                    best = new PrizeLeaderResult { ParticipantId = p.Id, DisplayName = p.DisplayName, Value = value };
            }

            return best ?? new PrizeLeaderResult();
        }

        private static int LongestStreak(List<bool> wins)
        {
            var best = 0;
            var current = 0;
            foreach (var w in wins)
            {
                current = w ? current + 1 : 0;
                if (current > best) best = current;
            }
            return best;
        }
    }
}
