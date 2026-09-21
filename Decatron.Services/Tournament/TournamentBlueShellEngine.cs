using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tournament
{
    /// <summary>
    /// Evalua triggers de obtencion de fichas de castigo y el contador de suerte contra
    /// snapshots nuevos de Riot API. Se invoca al final de cada sync (poller o
    /// "Resincronizar ahora"), nunca directo por el usuario.
    ///
    /// Cobertura de Milestone 1 vs. el diseno completo (04-motor-blue-shell-aegis.md #1):
    /// implementados stat_threshold, streak_wins, perfect_kda, match_duration_min,
    /// champion_variety, win_with_active_punishment, penta_kills. NO implementados: comeback_gold y
    /// steal_on_win — el snapshot que guarda el poller (fase 3) no trackea oro por
    /// timestamp ni la identidad del rival, asi que esos dos triggers no tienen datos
    /// de donde salir todavia. Si se agregan mas adelante, hay que ampliar primero
    /// TournamentLpSnapshot / el cliente de Riot (match-v5 timeline API para oro).
    /// </summary>
    public class TournamentBlueShellEngine
    {
        private readonly ILogger<TournamentBlueShellEngine> _logger;

        public TournamentBlueShellEngine(ILogger<TournamentBlueShellEngine> logger)
        {
            _logger = logger;
        }

        public async Task EvaluateEditionAsync(DecatronDbContext db, TournamentEdition edition, CancellationToken ct = default)
        {
            var rules = await db.TournamentBlueShellRules
                .FirstOrDefaultAsync(r => r.TournamentEditionId == edition.Id, ct);
            var maxInventory = rules?.MaxInventory ?? 3;

            var triggers = await db.TournamentShellTriggers
                .Where(t => t.TournamentEditionId == edition.Id && t.IsActive)
                .ToListAsync(ct);

            var pendingSnapshots = await db.TournamentLpSnapshots
                .Where(s => s.BlueShellEvaluatedAt == null
                         && db.TournamentParticipants.Any(p => p.Id == s.TournamentParticipantId && p.TournamentEditionId == edition.Id))
                .OrderBy(s => s.OccurredAt)
                .ToListAsync(ct);

            foreach (var snapshot in pendingSnapshots)
            {
                await EvaluateSnapshotAsync(db, edition, snapshot, triggers, maxInventory, ct);
                await EvaluateAegisAsync(db, snapshot, ct);
                snapshot.BlueShellEvaluatedAt = DateTime.UtcNow;
            }

            if (pendingSnapshots.Count > 0)
                await db.SaveChangesAsync(ct);
        }

        private async Task EvaluateSnapshotAsync(
            DecatronDbContext db, TournamentEdition edition, Core.Models.Tournament.TournamentLpSnapshot snapshot,
            List<TournamentShellTrigger> triggers, short maxInventory, CancellationToken ct)
        {
            foreach (var trigger in triggers)
            {
                var fired = await TriggerFiresAsync(db, snapshot, trigger, ct);
                if (!fired) continue;

                await GrantShellAsync(db, edition, snapshot.TournamentParticipantId, trigger, maxInventory, ct);
            }
        }

        private async Task<bool> TriggerFiresAsync(
            DecatronDbContext db, Core.Models.Tournament.TournamentLpSnapshot snapshot, TournamentShellTrigger trigger, CancellationToken ct)
        {
            switch (trigger.ConditionType)
            {
                case "stat_threshold":
                    var statValue = trigger.StatField switch
                    {
                        "kills" => (decimal)snapshot.Kills,
                        "assists" => (decimal)snapshot.Assists,
                        "deaths" => (decimal)snapshot.Deaths,
                        _ => 0m
                    };
                    return statValue >= trigger.ThresholdValue;

                case "match_duration_min":
                    return snapshot.Result == "win" && snapshot.DurationSeconds >= trigger.ThresholdValue * 60;

                case "perfect_kda":
                    return snapshot.Deaths == 0 && (snapshot.Kills + snapshot.Assists) >= trigger.ThresholdValue;

                case "penta_kills":
                    return snapshot.PentaKills >= trigger.ThresholdValue;

                case "streak_wins":
                    return await IsWinStreakAsync(db, snapshot, (int)trigger.ThresholdValue, ct);

                case "champion_variety":
                    return await IsDistinctChampionMilestoneAsync(db, snapshot, (int)trigger.ThresholdValue, ct);

                case "win_with_active_punishment":
                    return snapshot.Result == "win" && await HasActivePunishmentAsync(db, snapshot.TournamentParticipantId, ct);

                default:
                    return false;
            }
        }

        private async Task<bool> IsWinStreakAsync(DecatronDbContext db, Core.Models.Tournament.TournamentLpSnapshot snapshot, int streakLength, CancellationToken ct)
        {
            if (snapshot.Result != "win" || streakLength <= 0) return false;

            var recent = await db.TournamentLpSnapshots
                .Where(s => s.TournamentParticipantId == snapshot.TournamentParticipantId && s.OccurredAt <= snapshot.OccurredAt)
                .OrderByDescending(s => s.OccurredAt)
                .Take(streakLength)
                .Select(s => s.Result)
                .ToListAsync(ct);

            return recent.Count == streakLength && recent.All(r => r == "win");
        }

        /// <summary>
        /// Aproximacion de "cada N victorias con campeon distinto" (audit: "Cada 5
        /// victorias con un campeón distinto"): cuenta campeones distintos ganados
        /// hasta este snapshot inclusive: si este campeon no se habia ganado antes Y
        /// el total de campeones distintos ganados es multiplo de N, dispara.
        /// </summary>
        private async Task<bool> IsDistinctChampionMilestoneAsync(DecatronDbContext db, Core.Models.Tournament.TournamentLpSnapshot snapshot, int n, CancellationToken ct)
        {
            if (snapshot.Result != "win" || string.IsNullOrEmpty(snapshot.Champion) || n <= 0) return false;

            var priorWinChampions = await db.TournamentLpSnapshots
                .Where(s => s.TournamentParticipantId == snapshot.TournamentParticipantId
                         && s.Result == "win" && s.OccurredAt < snapshot.OccurredAt && s.Champion != null)
                .Select(s => s.Champion!)
                .Distinct()
                .ToListAsync(ct);

            if (priorWinChampions.Contains(snapshot.Champion)) return false;

            var distinctCount = priorWinChampions.Count + 1;
            return distinctCount % n == 0;
        }

        private async Task<bool> HasActivePunishmentAsync(DecatronDbContext db, long participantId, CancellationToken ct)
        {
            return await db.TournamentShellEvents.AnyAsync(e =>
                e.TargetParticipantId == participantId && e.Type == "received" && e.FulfilledAt == null, ct);
        }

        private async Task GrantShellAsync(
            DecatronDbContext db, TournamentEdition edition, long participantId, TournamentShellTrigger trigger, short maxInventory, CancellationToken ct)
        {
            var inventory = await db.TournamentShellInventories
                .FirstOrDefaultAsync(i => i.TournamentParticipantId == participantId, ct);

            if (inventory == null)
            {
                inventory = new TournamentShellInventory { TournamentParticipantId = participantId };
                db.TournamentShellInventories.Add(inventory);
            }

            var wasLostFull = inventory.Count >= maxInventory;

            db.TournamentShellEvents.Add(new TournamentShellEvent
            {
                TournamentEditionId = edition.Id,
                Type = "obtained",
                SourceParticipantId = participantId,
                TriggerId = trigger.Id,
                WasLostFull = wasLostFull,
            });

            if (!wasLostFull)
            {
                inventory.Count = (short)Math.Min(maxInventory, inventory.Count + trigger.ShellsGranted);
                inventory.TotalObtained += trigger.ShellsGranted;
            }
            inventory.UpdatedAt = DateTime.UtcNow;

            _logger.LogInformation("Torneo: participante {ParticipantId} obtuvo una ficha de castigo por '{Trigger}' (llena={Full})",
                participantId, trigger.Name, wasLostFull);
        }

        /// <summary>
        /// Factor de suerte de LP (mecanica propia, nombre configurable por tenant via
        /// TournamentEdition.AegisMechanicName): "estimado", puramente informativo, sin inventario ni evento propio. Se calcula comparando el delta de LP de este
        /// snapshot contra el promedio de deltas previos del jugador — anomalo hacia
        /// arriba en victoria, o cero en derrota.
        /// Nota realista: como LpAfter/LpBefore reflejan el LP ACTUAL al momento del
        /// sync (no el LP historico exacto de esa partida puntual — ver
        /// .dev/torneos/ESTADO.md, limitacion ya documentada), esto solo es preciso
        /// para partidas trackeadas en vivo, no para el backfill inicial de historial.
        /// </summary>
        private async Task EvaluateAegisAsync(DecatronDbContext db, Core.Models.Tournament.TournamentLpSnapshot snapshot, CancellationToken ct)
        {
            if (snapshot.LpBefore == null || snapshot.LpAfter == null) return;

            var delta = snapshot.LpAfter.Value - snapshot.LpBefore.Value;

            var priorDeltas = await db.TournamentLpSnapshots
                .Where(s => s.TournamentParticipantId == snapshot.TournamentParticipantId
                         && s.OccurredAt < snapshot.OccurredAt && s.LpBefore != null && s.LpAfter != null)
                .OrderByDescending(s => s.OccurredAt)
                .Take(10)
                .Select(s => s.LpAfter!.Value - s.LpBefore!.Value)
                .ToListAsync(ct);

            if (priorDeltas.Count < 3) return; // no hay historial suficiente para "lo esperable"

            var avgAbsDelta = priorDeltas.Select(Math.Abs).Average();
            if (avgAbsDelta <= 0) return;

            if (snapshot.Result == "win" && delta >= avgAbsDelta * 1.8)
                snapshot.AegisTriggered = true;
            else if (snapshot.Result == "loss" && delta == 0)
                snapshot.AegisTriggered = true;
        }
    }
}
