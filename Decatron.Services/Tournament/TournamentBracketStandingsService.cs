using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Tournament
{
    public class BracketStanding
    {
        public long TeamId { get; set; }
        public int Wins { get; set; }
        public int Losses { get; set; }
        public int Rank { get; set; }
    }

    /// <summary>
    /// Standings de W/L a partir de TournamentMatch — distinto de
    /// TournamentStandingsService (ese es LP de SoloQ Climb, no se mezclan). Usado por
    /// round_robin (tabla de posiciones) y swiss (emparejar la ronda siguiente).
    /// Desempate v1: solo por cantidad de victorias — sin diferencial de partidas
    /// jugadas todavia, documentado como simplificacion.
    /// </summary>
    public class TournamentBracketStandingsService
    {
        public async Task<List<BracketStanding>> GetStandingsAsync(DecatronDbContext db, long editionId, CancellationToken ct = default)
        {
            var matches = await db.TournamentMatches
                .Where(m => m.TournamentEditionId == editionId && (m.Status == "finished" || m.Status == "walkover"))
                .ToListAsync(ct);

            var record = new Dictionary<long, (int wins, int losses)>();

            void Track(long? teamId, bool won)
            {
                if (teamId == null) return;
                var (wins, losses) = record.TryGetValue(teamId.Value, out var r) ? r : (0, 0);
                record[teamId.Value] = won ? (wins + 1, losses) : (wins, losses + 1);
            }

            foreach (var m in matches)
            {
                if (m.WinnerTeamId == null) continue;
                if (m.TeamAId != null) Track(m.TeamAId, m.WinnerTeamId == m.TeamAId);
                if (m.TeamBId != null) Track(m.TeamBId, m.WinnerTeamId == m.TeamBId);
            }

            // Incluye tambien equipos sin partidas jugadas todavia (0-0), para que
            // aparezcan en la tabla desde el arranque.
            var allTeamIds = await db.TournamentTeams
                .Where(t => t.TournamentEditionId == editionId)
                .Select(t => t.Id)
                .ToListAsync(ct);
            foreach (var id in allTeamIds)
                if (!record.ContainsKey(id)) record[id] = (0, 0);

            return record
                .OrderByDescending(kv => kv.Value.wins)
                .Select((kv, idx) => new BracketStanding { TeamId = kv.Key, Wins = kv.Value.wins, Losses = kv.Value.losses, Rank = idx + 1 })
                .ToList();
        }

        /// <summary>
        /// Pares de equipos que ya jugaron entre si (finished o walkover) — usado por
        /// swiss para evitar revanchas al armar la ronda siguiente.
        /// </summary>
        public async Task<HashSet<(long, long)>> GetPlayedPairsAsync(DecatronDbContext db, long editionId, CancellationToken ct = default)
        {
            var matches = await db.TournamentMatches
                .Where(m => m.TournamentEditionId == editionId && m.TeamAId != null && m.TeamBId != null)
                .Select(m => new { m.TeamAId, m.TeamBId })
                .ToListAsync(ct);

            var pairs = new HashSet<(long, long)>();
            foreach (var m in matches)
            {
                var a = m.TeamAId!.Value;
                var b = m.TeamBId!.Value;
                pairs.Add(a < b ? (a, b) : (b, a));
            }
            return pairs;
        }
    }
}
