using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Decatron.Services.GameData.Riot;

namespace Decatron.Services.Tournament
{
    public class TournamentEditionSyncResult
    {
        public bool HadError { get; set; }
        public string? LastError { get; set; }
        public int NewSnapshots { get; set; }
    }

    /// <summary>
    /// Logica real de sincronizacion con Riot API para una edicion, extraida de
    /// TournamentRiotPollingService para que tanto el poller automatico (cada 3 min)
    /// como el boton "Resincronizar ahora" del panel (TournamentAdminController) usen
    /// exactamente el mismo codigo — no una copia paralela que se desincroniza.
    /// Scoped porque depende de DecatronDbContext.
    /// </summary>
    public class TournamentRiotSyncService
    {
        private readonly RiotApiClient _riotClient;
        private readonly TournamentBlueShellEngine _blueShellEngine;
        private readonly ILogger<TournamentRiotSyncService> _logger;

        public TournamentRiotSyncService(RiotApiClient riotClient, TournamentBlueShellEngine blueShellEngine, ILogger<TournamentRiotSyncService> logger)
        {
            _riotClient = riotClient;
            _blueShellEngine = blueShellEngine;
            _logger = logger;
        }

        public async Task<TournamentEditionSyncResult> SyncEditionAsync(
            DecatronDbContext db,
            TournamentRiotConfig config,
            TournamentEdition edition,
            CancellationToken ct = default)
        {
            var result = new TournamentEditionSyncResult();

            var participants = await db.TournamentParticipants
                .Where(p => p.TournamentEditionId == edition.Id
                         && p.Status == "approved"
                         && p.RiotId != null && p.RiotTagLine != null)
                .ToListAsync(ct);

            foreach (var participant in participants)
            {
                try
                {
                    if (string.IsNullOrEmpty(participant.RiotPuuid))
                    {
                        var (ok, puuid, error) = await _riotClient.ResolvePuuidAsync(
                            edition.Region, participant.RiotId!, participant.RiotTagLine!, config.ApiKey);

                        if (!ok || string.IsNullOrEmpty(puuid))
                        {
                            result.HadError = true;
                            result.LastError = error;
                            continue;
                        }

                        participant.RiotPuuid = puuid;
                        await db.SaveChangesAsync(ct);
                    }

                    result.NewSnapshots += await SyncParticipantAsync(db, config, edition, participant, ct);
                }
                catch (Exception ex)
                {
                    result.HadError = true;
                    result.LastError = ex.Message;
                    _logger.LogError(ex, "Error trackeando al participante {ParticipantId} ({DisplayName})", participant.Id, participant.DisplayName);
                }
            }

            config.LastValidatedAt = DateTime.UtcNow;
            if (result.HadError)
            {
                config.LastErrorAt = DateTime.UtcNow;
                config.LastErrorMessage = result.LastError;
            }
            await db.SaveChangesAsync(ct);

            // Motor de castigos/suerte: evalua los snapshots recien insertados (y
            // cualquier otro que hubiera quedado pendiente de una corrida anterior).
            await _blueShellEngine.EvaluateEditionAsync(db, edition, ct);

            return result;
        }

        private async Task<int> SyncParticipantAsync(
            DecatronDbContext db,
            TournamentRiotConfig config,
            TournamentEdition edition,
            TournamentParticipant participant,
            CancellationToken ct)
        {
            var (matchesOk, matchIds, matchesError) = await _riotClient.GetRecentMatchIdsAsync(
                edition.Region, participant.RiotPuuid!, config.ApiKey, count: 5);

            if (!matchesOk)
                throw new Exception($"No se pudo listar partidas recientes: {matchesError}");

            var alreadySaved = await db.TournamentLpSnapshots
                .Where(s => s.TournamentParticipantId == participant.Id && matchIds.Contains(s.RiotMatchId))
                .Select(s => s.RiotMatchId)
                .ToListAsync(ct);

            var newMatchIds = matchIds.Except(alreadySaved).ToList();
            if (newMatchIds.Count == 0) return 0;

            // Orden cronologico (Riot devuelve mas nueva primero) para que LpBefore
            // encadene bien entre snapshots consecutivos.
            newMatchIds.Reverse();

            var lastKnownLp = await db.TournamentLpSnapshots
                .Where(s => s.TournamentParticipantId == participant.Id)
                .OrderByDescending(s => s.OccurredAt)
                .Select(s => (int?)s.LpAfter)
                .FirstOrDefaultAsync(ct);

            var saved = 0;
            foreach (var matchId in newMatchIds)
            {
                var (summaryOk, summary, summaryError) = await _riotClient.GetMatchSummaryAsync(
                    edition.Region, matchId, participant.RiotPuuid!, config.ApiKey);

                if (!summaryOk || summary == null)
                {
                    _logger.LogWarning("No se pudo leer el detalle de la partida {MatchId}: {Error}", matchId, summaryError);
                    continue;
                }

                var (lpOk, currentLp, _, _, _) = await _riotClient.GetCurrentSoloQLpAsync(edition.Region, participant.RiotPuuid!, config.ApiKey);

                var snapshot = new TournamentLpSnapshot
                {
                    TournamentParticipantId = participant.Id,
                    RiotMatchId = summary.MatchId,
                    OccurredAt = summary.OccurredAt,
                    Result = summary.Win ? "win" : "loss",
                    Champion = summary.Champion,
                    Kills = (short)summary.Kills,
                    Deaths = (short)summary.Deaths,
                    Assists = (short)summary.Assists,
                    CsPerMin = summary.CsPerMin,
                    DamageDealt = summary.DamageDealt,
                    VisionScore = (short?)summary.VisionScore,
                    PentaKills = (short)summary.PentaKills,
                    DurationSeconds = summary.DurationSeconds,
                    LpBefore = lastKnownLp,
                    LpAfter = lpOk ? currentLp : null,
                };

                db.TournamentLpSnapshots.Add(snapshot);
                lastKnownLp = snapshot.LpAfter ?? lastKnownLp;
                saved++;
            }

            await db.SaveChangesAsync(ct);
            return saved;
        }
    }
}
