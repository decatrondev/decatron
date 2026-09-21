using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Decatron.Services.GameData.Riot;

namespace Decatron.Services.Tournament
{
    /// <summary>
    /// Para torneos ARAM N vs N: por cada cruce del bracket todavia sin resultado,
    /// busca entre las partidas recientes de los jugadores conocidos cual es
    /// realmente el enfrentamiento de ese match (cruzando los PUUID de ambos
    /// equipos), y SIEMPRE que la identifica guarda las estadisticas de cada
    /// participante conocido (TournamentLpSnapshot, misma tabla que usa SoloQ Climb —
    /// LpBefore/LpAfter quedan null) para que los premios "por metrica" tambien
    /// funcionen en ARAM (agregado 24-08-2026, pedido del usuario: "por que no
    /// validaste todo lo de premios").
    ///
    /// Si ademas hay condiciones de victoria activas (combinables: gana quien cumpla
    /// CUALQUIERA primero), evalua todas contra el timeline, se queda con la que
    /// ocurrio mas temprano cronologicamente, y declara el ganador solo — reusando
    /// TournamentBracketService.RecordResultAsync (mismo codigo que usa el admin al
    /// cargar un resultado a mano), asi la propagacion de ronda siguiente no se
    /// duplica. Sin condiciones activas, solo queda guardado el historial — el
    /// resultado del match lo sigue cargando el admin a mano.
    ///
    /// Se dispara desde TournamentRiotPollingService junto al sync de LP de SoloQ
    /// Climb — mismo intervalo de 3 min, scoped porque depende de DecatronDbContext.
    /// </summary>
    public class TournamentWinConditionSyncService
    {
        private readonly RiotApiClient _riotClient;
        private readonly TournamentWinConditionEngine _engine;
        private readonly TournamentBracketService _bracketService;
        private readonly ILogger<TournamentWinConditionSyncService> _logger;

        public TournamentWinConditionSyncService(
            RiotApiClient riotClient,
            TournamentWinConditionEngine engine,
            TournamentBracketService bracketService,
            ILogger<TournamentWinConditionSyncService> logger)
        {
            _riotClient = riotClient;
            _engine = engine;
            _bracketService = bracketService;
            _logger = logger;
        }

        public async Task SyncEditionAsync(DecatronDbContext db, TournamentRiotConfig config, TournamentEdition edition, CancellationToken ct = default)
        {
            if (edition.Mode != "aram_teams") return;

            var activeConditions = await db.TournamentWinConditions
                .Where(c => c.TournamentEditionId == edition.Id && c.IsActive)
                .ToListAsync(ct);
            // Sin condiciones activas igual seguimos: el historial de partidas (para
            // premios "por metrica") se guarda de todas formas, solo no se declara
            // ganador automatico del bracket.

            // A diferencia de solo_q_climb, nada resuelve el RiotPuuid de un
            // participante ARAM todavia — sin esto GetTeamParticipantsAsync siempre
            // devolveria vacio y nunca se podria identificar ninguna partida.
            await ResolveMissingPuuidsAsync(db, config, edition, ct);

            var pendingMatches = await db.TournamentMatches
                .Where(m => m.TournamentEditionId == edition.Id
                         && m.Status != "finished" && m.Status != "walkover"
                         && m.TeamAId != null && m.TeamBId != null)
                .ToListAsync(ct);

            foreach (var match in pendingMatches)
            {
                try
                {
                    await TrySyncMatchAsync(db, config, edition, activeConditions, match, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error evaluando condicion de victoria para el match {MatchId} de la edicion {EditionId}", match.Id, edition.Id);
                }

                // Respiro entre matches para no pegarle todas las llamadas juntas a la
                // key de Riot (no hay rate limiter real todavia, ver RiotApiClient).
                await Task.Delay(1200, ct);
            }
        }

        private async Task TrySyncMatchAsync(
            DecatronDbContext db, TournamentRiotConfig config, TournamentEdition edition, List<TournamentWinCondition> activeConditions, TournamentMatch match, CancellationToken ct)
        {
            var teamAParticipants = await GetTeamParticipantsAsync(db, match.TeamAId!.Value, ct);
            var teamBParticipants = await GetTeamParticipantsAsync(db, match.TeamBId!.Value, ct);
            if (teamAParticipants.Count == 0 || teamBParticipants.Count == 0) return; // nadie de alguno de los dos equipos tiene puuid resuelto todavia

            var teamAPuuids = teamAParticipants.Select(p => p.RiotPuuid!).ToList();
            var teamBPuuids = teamBParticipants.Select(p => p.RiotPuuid!).ToList();
            var participantIdByPuuid = teamAParticipants.Concat(teamBParticipants).ToDictionary(p => p.RiotPuuid!, p => p.Id);

            var knownPuuids = new HashSet<string>(teamAPuuids.Concat(teamBPuuids));
            // Margen de 2 por si algun participante todavia no tiene RiotPuuid resuelto
            // (primer sync pendiente) o hay un suplente jugando — igual alcanza para
            // distinguir "esta es la partida" de una partida cualquiera de otro dia.
            var minOverlap = Math.Max(2, knownPuuids.Count - 2);

            var probePuuid = knownPuuids.First();
            var (matchesOk, matchIds, _) = await _riotClient.GetRecentMatchIdsAsync(edition.Region, probePuuid, config.ApiKey, count: 5);
            if (!matchesOk) return;

            foreach (var matchId in matchIds)
            {
                var (partsOk, participants, _) = await _riotClient.GetMatchParticipantsAsync(edition.Region, matchId, config.ApiKey);
                if (!partsOk) continue;

                var overlap = participants.Count(p => knownPuuids.Contains(p.Puuid));
                if (overlap < minOverlap) continue;

                var teamAVotes = new Dictionary<int, int>();
                var teamBVotes = new Dictionary<int, int>();
                var participantTeam = new Dictionary<int, int>();
                foreach (var p in participants)
                {
                    participantTeam[p.ParticipantId] = p.TeamId;
                    if (teamAPuuids.Contains(p.Puuid)) teamAVotes[p.TeamId] = teamAVotes.GetValueOrDefault(p.TeamId) + 1;
                    else if (teamBPuuids.Contains(p.Puuid)) teamBVotes[p.TeamId] = teamBVotes.GetValueOrDefault(p.TeamId) + 1;
                }
                if (teamAVotes.Count == 0 || teamBVotes.Count == 0) continue;

                var riotTeamForA = teamAVotes.OrderByDescending(kv => kv.Value).First().Key;
                var riotTeamForB = teamBVotes.OrderByDescending(kv => kv.Value).First().Key;
                if (riotTeamForA == riotTeamForB) continue; // no se puede distinguir un equipo del otro con estos datos

                // Ya identificamos la partida real de este match — guardar el
                // historial de cada participante conocido pase lo que pase despues
                // (haya o no condiciones de victoria activas). Dedup interno por
                // RiotMatchId, no reinserta si ya se guardo en un ciclo anterior.
                await SaveParticipantStatsAsync(db, edition, matchId, participantIdByPuuid, config, ct);

                if (activeConditions.Count == 0) return; // sin condiciones activas: se guardo el historial, el resultado del match lo carga el admin a mano

                var (timelineOk, timeline, timelineError) = await _riotClient.GetMatchTimelineAsync(edition.Region, matchId, config.ApiKey);
                if (!timelineOk || timeline == null)
                {
                    _logger.LogWarning("No se pudo leer el timeline de la partida {MatchId}: {Error}", matchId, timelineError);
                    continue;
                }

                // Evalua TODAS las condiciones activas y se queda con la que ocurrio
                // primero en el tiempo real de la partida — "gana quien cumpla
                // cualquiera de las activas, la que sea que pase antes".
                TournamentWinCondition? winningCondition = null;
                WinConditionResult? earliest = null;
                foreach (var condition in activeConditions)
                {
                    var candidate = _engine.EvaluateWinner(condition, timeline, participantTeam);
                    if (candidate == null) continue;
                    if (earliest == null || candidate.Timestamp < earliest.Timestamp)
                    {
                        earliest = candidate;
                        winningCondition = condition;
                    }
                }

                if (earliest == null || winningCondition == null) continue; // ninguna condicion activa se cumplio en esta partida

                var winnerTeamId = earliest.WinnerRiotTeamId == riotTeamForA ? match.TeamAId!.Value : match.TeamBId!.Value;

                var result = await _bracketService.RecordResultAsync(db, edition, match.Id, winnerTeamId, ct);
                if (result.Success)
                {
                    _logger.LogInformation(
                        "Torneo: match {MatchId} (edicion {EditionId}) decidido automaticamente por condicion de victoria '{ConditionType}' (partida {RiotMatchId})",
                        match.Id, edition.Id, winningCondition.ConditionType, matchId);
                }
                else
                {
                    _logger.LogWarning("No se pudo registrar el resultado automatico del match {MatchId}: {Error}", match.Id, result.Error);
                }

                return; // ya identificamos y resolvimos la partida de este match, no seguir probando el resto de matchIds
            }
        }

        private async Task ResolveMissingPuuidsAsync(DecatronDbContext db, TournamentRiotConfig config, TournamentEdition edition, CancellationToken ct)
        {
            var pending = await db.TournamentParticipants
                .Where(p => p.TournamentEditionId == edition.Id && p.TeamId != null
                         && p.RiotPuuid == null && p.RiotId != null && p.RiotTagLine != null)
                .ToListAsync(ct);

            foreach (var participant in pending)
            {
                var (ok, puuid, error) = await _riotClient.ResolvePuuidAsync(edition.Region, participant.RiotId!, participant.RiotTagLine!, config.ApiKey);
                if (!ok || string.IsNullOrEmpty(puuid))
                {
                    _logger.LogWarning("No se pudo resolver el puuid del participante {ParticipantId}: {Error}", participant.Id, error);
                    continue;
                }
                participant.RiotPuuid = puuid;
            }

            if (pending.Count > 0) await db.SaveChangesAsync(ct);
        }

        private static async Task<List<TournamentParticipant>> GetTeamParticipantsAsync(DecatronDbContext db, long teamId, CancellationToken ct)
        {
            return await db.TournamentParticipants
                .Where(p => p.TeamId == teamId && p.RiotPuuid != null)
                .ToListAsync(ct);
        }

        /// <summary>
        /// Guarda kills/muertes/asistencias/campeon/resultado de cada participante
        /// conocido de la partida — misma tabla que ya usa SoloQ Climb
        /// (TournamentLpSnapshot), LpBefore/LpAfter quedan null porque ARAM no tiene
        /// LP. Esto es lo que hace que los premios "por metrica" (mas kills, mejor
        /// KDA, etc.) funcionen tambien en ARAM, no solo en SoloQ Climb.
        /// </summary>
        private async Task SaveParticipantStatsAsync(
            DecatronDbContext db, TournamentEdition edition, string matchId, Dictionary<string, long> participantIdByPuuid, TournamentRiotConfig config, CancellationToken ct)
        {
            var (statsOk, stats, statsError) = await _riotClient.GetMatchAllParticipantStatsAsync(edition.Region, matchId, config.ApiKey);
            if (!statsOk)
            {
                _logger.LogWarning("No se pudieron leer las stats de la partida {MatchId}: {Error}", matchId, statsError);
                return;
            }

            var alreadySaved = await db.TournamentLpSnapshots
                .Where(s => s.RiotMatchId == matchId && participantIdByPuuid.Values.Contains(s.TournamentParticipantId))
                .Select(s => s.TournamentParticipantId)
                .ToListAsync(ct);

            var anyNew = false;
            foreach (var stat in stats)
            {
                if (!participantIdByPuuid.TryGetValue(stat.Puuid, out var participantId)) continue; // no es uno de nuestros dos equipos (suplente sin puuid, etc.)
                if (alreadySaved.Contains(participantId)) continue;

                db.TournamentLpSnapshots.Add(new TournamentLpSnapshot
                {
                    TournamentParticipantId = participantId,
                    RiotMatchId = matchId,
                    OccurredAt = stat.OccurredAt,
                    Result = stat.Win ? "win" : "loss",
                    Champion = stat.Champion,
                    Kills = (short)stat.Kills,
                    Deaths = (short)stat.Deaths,
                    Assists = (short)stat.Assists,
                    CsPerMin = stat.CsPerMin,
                    DamageDealt = stat.DamageDealt,
                    VisionScore = (short?)stat.VisionScore,
                    PentaKills = (short)stat.PentaKills,
                    DurationSeconds = stat.DurationSeconds,
                    LpBefore = null,
                    LpAfter = null,
                });
                anyNew = true;
            }

            if (anyNew) await db.SaveChangesAsync(ct);
        }
    }
}
