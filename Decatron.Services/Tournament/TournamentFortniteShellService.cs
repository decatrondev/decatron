using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Tournament
{
    /// <summary>
    /// Castigos en Fortnite (.dev/torneos/15-fortnite.md F6). Usa el mismo motor que
    /// LoL (catalogo de castigos, inventario, cooldown por puesto y reverse), con
    /// condiciones propias que se evaluan solo sobre resultados oficiales:
    ///   fn_win, fn_eliminations, fn_top_streak (al cerrar cada partida) y
    ///   fn_comeback (al terminar la sesion).
    /// Las fichas son del equipo: las guarda su "titular", el jugador aprobado de
    /// menor id. En Solo es el propio jugador.
    /// </summary>
    public class TournamentFortniteShellService
    {
        public static readonly string[] ConditionTypes = { "fn_win", "fn_eliminations", "fn_top_streak", "fn_comeback" };

        private readonly TournamentBlueShellEngine _engine;
        private readonly TournamentFortniteStandingsService _standings;

        public TournamentFortniteShellService(TournamentBlueShellEngine engine, TournamentFortniteStandingsService standings)
        {
            _engine = engine;
            _standings = standings;
        }

        /// <summary>teamId -> jugador que guarda las fichas del equipo.</summary>
        public static async Task<Dictionary<long, long>> TeamHoldersAsync(DecatronDbContext db, long editionId, CancellationToken ct = default) =>
            (await db.TournamentParticipants
                .Where(p => p.TournamentEditionId == editionId && p.TeamId != null && p.Status == "approved")
                .Select(p => new { p.TeamId, p.Id })
                .ToListAsync(ct))
            .GroupBy(p => p.TeamId!.Value)
            .ToDictionary(g => g.Key, g => g.Min(x => x.Id));

        private static async Task<(List<TournamentShellTrigger> triggers, short maxInventory)> LoadAsync(DecatronDbContext db, long editionId, CancellationToken ct)
        {
            var triggers = await db.TournamentShellTriggers
                .Where(t => t.TournamentEditionId == editionId && t.IsActive && ConditionTypes.Contains(t.ConditionType))
                .ToListAsync(ct);
            var maxInventory = (await db.TournamentBlueShellRules.FirstOrDefaultAsync(r => r.TournamentEditionId == editionId, ct))?.MaxInventory ?? 3;
            return (triggers, maxInventory);
        }

        /// <summary>
        /// Al cerrar una partida (una sola vez): victoria, eliminaciones y racha de top N
        /// para cada equipo con resultado aprobado.
        /// </summary>
        public async Task EvaluateGameAsync(DecatronDbContext db, TournamentEdition edition, TournamentFortniteGame game, CancellationToken ct = default)
        {
            if (game.ShellsEvaluatedAt != null) return;
            game.ShellsEvaluatedAt = DateTime.UtcNow;

            var (triggers, maxInventory) = await LoadAsync(db, edition.Id, ct);
            var gameTriggers = triggers.Where(t => t.ConditionType != "fn_comeback").ToList();
            if (gameTriggers.Count == 0)
            {
                await db.SaveChangesAsync(ct);
                return;
            }

            var holders = await TeamHoldersAsync(db, edition.Id, ct);
            var results = await db.TournamentFortniteResults.Where(r => r.GameId == game.Id && r.Status == "approved" && r.Placement != null).ToListAsync(ct);

            foreach (var result in results)
            {
                if (!holders.TryGetValue(result.TeamId, out var holder)) continue;
                foreach (var trigger in gameTriggers)
                {
                    var fires = trigger.ConditionType switch
                    {
                        "fn_win" => result.Placement == 1,
                        "fn_eliminations" => result.Eliminations >= trigger.ThresholdValue,
                        "fn_top_streak" => await TopStreakHitsAsync(db, edition.Id, result.TeamId, game, (int)trigger.ThresholdValue, trigger.StreakLength ?? 3, ct),
                        _ => false,
                    };
                    if (!fires) continue;
                    await _engine.GrantShellAsync(db, edition, holder, trigger, maxInventory, ct);
                    // Guardar ya: si otra condicion le da ficha al mismo equipo, el
                    // inventario recien creado tiene que existir en la base.
                    await db.SaveChangesAsync(ct);
                }
            }

            await db.SaveChangesAsync(ct);
        }

        /// <summary>
        /// true cuando esta partida completa una racha de K partidas seguidas en top N
        /// (y cada K mas: 3, 6, 9...), para no dar la ficha en cada partida de la misma
        /// racha. Cuenta las partidas del equipo en orden; un rechazo o sin reporte corta.
        /// </summary>
        private static async Task<bool> TopStreakHitsAsync(DecatronDbContext db, long editionId, long teamId, TournamentFortniteGame game, int topN, int length, CancellationToken ct)
        {
            if (topN <= 0 || length <= 0) return false;

            var history = await (
                from r in db.TournamentFortniteResults
                where r.TeamId == teamId
                join g in db.TournamentFortniteGames on r.GameId equals g.Id
                join s in db.TournamentFortniteSessions on g.SessionId equals s.Id
                where s.TournamentEditionId == editionId
                orderby s.SortOrder, s.Id, g.GameNumber
                select new { r.GameId, r.Status, r.Placement }
            ).ToListAsync(ct);

            var streak = 0;
            foreach (var h in history)
            {
                streak = h.Status == "approved" && h.Placement != null && h.Placement <= topN ? streak + 1 : 0;
                if (h.GameId == game.Id) return streak > 0 && streak % length == 0;
            }
            return false;
        }

        /// <summary>
        /// Al terminar una sesion (una sola vez): remontada = cuantos puestos subio cada
        /// equipo en la tabla de esa sesion (antes de jugarla vs. despues).
        /// </summary>
        public async Task EvaluateSessionAsync(DecatronDbContext db, TournamentEdition edition, TournamentFortniteSession session, CancellationToken ct = default)
        {
            if (session.ShellsEvaluatedAt != null) return;
            session.ShellsEvaluatedAt = DateTime.UtcNow;

            var (triggers, maxInventory) = await LoadAsync(db, edition.Id, ct);
            var comeback = triggers.Where(t => t.ConditionType == "fn_comeback").ToList();
            if (comeback.Count == 0)
            {
                await db.SaveChangesAsync(ct);
                return;
            }

            var scopeKey = session.GroupId == null ? "all" : $"group:{session.GroupId}";
            var before = (await _standings.ComputeAsync(db, edition, ct, excludeSessionId: session.Id)).FirstOrDefault(s => s.Key == scopeKey);
            var after = (await _standings.ComputeAsync(db, edition, ct)).FirstOrDefault(s => s.Key == scopeKey);
            // Sin partidas previas no hay "antes" contra el que remontar.
            if (before == null || after == null || before.GamesWithResults == 0)
            {
                await db.SaveChangesAsync(ct);
                return;
            }

            var holders = await TeamHoldersAsync(db, edition.Id, ct);
            foreach (var row in after.Rows)
            {
                var prev = before.Rows.FirstOrDefault(r => r.TeamId == row.TeamId);
                if (prev == null || !holders.TryGetValue(row.TeamId, out var holder)) continue;
                var climbed = prev.Rank - row.Rank;
                foreach (var trigger in comeback.Where(t => climbed >= t.ThresholdValue && t.ThresholdValue > 0))
                {
                    await _engine.GrantShellAsync(db, edition, holder, trigger, maxInventory, ct);
                    await db.SaveChangesAsync(ct);
                }
            }

            await db.SaveChangesAsync(ct);
        }

        /// <summary>Puesto del equipo del jugador (para cooldown y reverse por puesto al lanzar).</summary>
        public async Task<int?> ParticipantRankAsync(DecatronDbContext db, TournamentEdition edition, long participantId, CancellationToken ct = default)
        {
            var teamId = await db.TournamentParticipants.Where(p => p.Id == participantId).Select(p => p.TeamId).FirstOrDefaultAsync(ct);
            return teamId == null ? null : await _standings.TeamRankAsync(db, edition, teamId.Value, ct);
        }
    }
}
