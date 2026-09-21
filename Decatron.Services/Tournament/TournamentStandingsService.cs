using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Tournament
{
    public class ParticipantStanding
    {
        public long ParticipantId { get; set; }
        public int? CurrentLp { get; set; }
        public int Rank { get; set; }
    }

    /// <summary>
    /// Calcula el ranking (posicion actual por LP) de una edicion — usado tanto por
    /// el motor de castigos (reglas por rango de posicion, fase 4 seccion 2) como por
    /// cualquier otra parte que necesite saber "en que puesto esta X ahora mismo".
    /// Nunca se cachea la posicion en TournamentParticipant — se recalcula siempre al
    /// pedirla, ver .dev/torneos/04-motor-blue-shell-aegis.md seccion 2.
    /// </summary>
    public class TournamentStandingsService
    {
        public async Task<List<ParticipantStanding>> GetStandingsAsync(DecatronDbContext db, long editionId, CancellationToken ct = default)
        {
            var participantIds = await db.TournamentParticipants
                .Where(p => p.TournamentEditionId == editionId && p.Status != "rejected" && p.Status != "withdrawn")
                .Select(p => p.Id)
                .ToListAsync(ct);

            var withLp = new List<(long Id, int? Lp)>();
            foreach (var id in participantIds)
            {
                var lastLp = await db.TournamentLpSnapshots
                    .Where(s => s.TournamentParticipantId == id)
                    .OrderByDescending(s => s.OccurredAt)
                    .Select(s => (int?)s.LpAfter)
                    .FirstOrDefaultAsync(ct);

                withLp.Add((id, lastLp));
            }

            return withLp
                .OrderByDescending(x => x.Lp ?? -1)
                .Select((x, idx) => new ParticipantStanding { ParticipantId = x.Id, CurrentLp = x.Lp, Rank = idx + 1 })
                .ToList();
        }

        public async Task<int?> GetRankAsync(DecatronDbContext db, long editionId, long participantId, CancellationToken ct = default)
        {
            var standings = await GetStandingsAsync(db, editionId, ct);
            return standings.FirstOrDefault(s => s.ParticipantId == participantId)?.Rank;
        }
    }
}
