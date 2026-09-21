using Decatron.Core.Models.Tournament;
using Microsoft.Extensions.Logging;
using Decatron.Services.GameData.Riot;

namespace Decatron.Services.Tournament
{
    // Resultado de una condicion que se cumplio: quien gano y EN QUE MOMENTO de la
    // partida (ms desde el arranque) — necesario para comparar entre varias
    // condiciones activas a la vez y quedarse con la que paso primero.
    public class WinConditionResult
    {
        public int WinnerRiotTeamId { get; set; } // 100 o 200
        public long Timestamp { get; set; }
    }

    /// <summary>
    /// Evalua una TournamentWinCondition contra el timeline completo (ya terminado)
    /// de una partida de Riot, y devuelve cual de los dos equipos Riot (100/200) la
    /// cumplio primero y en que momento — o null si no se cumplio (partida se jugo
    /// completa a pesar del formato, o la condicion no aplica a los datos
    /// disponibles). El timestamp permite al llamador comparar varias condiciones
    /// activas a la vez y quedarse con la que ocurrio mas temprano en la partida.
    ///
    /// Puro/sin estado — no toca la base de datos, solo lee el timeline ya
    /// descargado por RiotApiClient.GetMatchTimelineAsync. El llamador
    /// (TournamentWinConditionSyncService) es quien mapea el "equipo Riot ganador"
    /// (100/200) de vuelta a un TeamAId/TeamBId de Decatron y llama a
    /// TournamentBracketService.RecordResultAsync.
    /// </summary>
    public class TournamentWinConditionEngine
    {
        private const long MultikillWindowMs = 10_000; // ventana oficial de multikill de LoL

        private readonly ILogger<TournamentWinConditionEngine> _logger;

        public TournamentWinConditionEngine(ILogger<TournamentWinConditionEngine> logger)
        {
            _logger = logger;
        }

        public WinConditionResult? EvaluateWinner(TournamentWinCondition condition, RiotMatchTimeline timeline, Dictionary<int, int> participantTeam)
        {
            return condition.ConditionType switch
            {
                "first_blood" => FirstChampionKillTeam(timeline, participantTeam),
                "team_kills" => FirstTeamToReachKillTally(timeline, participantTeam, (int)condition.ThresholdValue),
                "player_kills" => FirstPlayerToReachKillCount(timeline, participantTeam, (int)condition.ThresholdValue),
                "player_kill_streak" => FirstPlayerToReachKillStreak(timeline, participantTeam, (int)condition.ThresholdValue),
                "multikill" => FirstPlayerToReachMultikill(timeline, participantTeam, (int)condition.ThresholdValue),
                "first_tower" => FirstBuildingTeam(timeline, "TOWER_BUILDING"),
                "team_towers" => FirstTeamToReachBuildingTally(timeline, "TOWER_BUILDING", (int)condition.ThresholdValue),
                "first_inhibitor" => FirstBuildingTeam(timeline, "INHIBITOR_BUILDING"),
                "cs_threshold" => FirstPlayerToReachFrameStat(timeline, participantTeam, (int)condition.ThresholdValue, f => f.MinionsKilled + f.JungleMinionsKilled),
                "gold_threshold" => FirstPlayerToReachFrameStat(timeline, participantTeam, (int)condition.ThresholdValue, f => f.TotalGold),
                "level_threshold" => FirstPlayerToReachFrameStat(timeline, participantTeam, (int)condition.ThresholdValue, f => f.Level),
                "champion_damage_threshold" => FirstPlayerToReachFrameStat(timeline, participantTeam, (int)condition.ThresholdValue, f => f.DamageToChampions),
                "time_lead" => TeamAheadAtMinute(timeline, participantTeam, (int)condition.ThresholdValue),
                "gold_lead" => FirstTeamWithGoldLead(timeline, participantTeam, (int)condition.ThresholdValue),
                _ => null,
            };
        }

        // ─── Kills ──────────────────────────────────────────────────────────────────

        private static WinConditionResult? FirstChampionKillTeam(RiotMatchTimeline timeline, Dictionary<int, int> participantTeam)
        {
            var ev = timeline.Events.FirstOrDefault(e => e.Type == "CHAMPION_KILL" && e.KillerId is > 0);
            return ev != null && participantTeam.TryGetValue(ev.KillerId!.Value, out var team)
                ? new WinConditionResult { WinnerRiotTeamId = team, Timestamp = ev.Timestamp } : null;
        }

        private static WinConditionResult? FirstTeamToReachKillTally(RiotMatchTimeline timeline, Dictionary<int, int> participantTeam, int threshold)
        {
            if (threshold <= 0) return null;
            var tally = new Dictionary<int, int>();

            foreach (var ev in timeline.Events.Where(e => e.Type == "CHAMPION_KILL" && e.KillerId is > 0))
            {
                if (!participantTeam.TryGetValue(ev.KillerId!.Value, out var team)) continue;
                tally[team] = tally.GetValueOrDefault(team) + 1;
                if (tally[team] >= threshold) return new WinConditionResult { WinnerRiotTeamId = team, Timestamp = ev.Timestamp };
            }
            return null;
        }

        private static WinConditionResult? FirstPlayerToReachKillCount(RiotMatchTimeline timeline, Dictionary<int, int> participantTeam, int threshold)
        {
            if (threshold <= 0) return null;
            var perPlayer = new Dictionary<int, int>();

            foreach (var ev in timeline.Events.Where(e => e.Type == "CHAMPION_KILL" && e.KillerId is > 0))
            {
                var killer = ev.KillerId!.Value;
                perPlayer[killer] = perPlayer.GetValueOrDefault(killer) + 1;
                if (perPlayer[killer] >= threshold && participantTeam.TryGetValue(killer, out var team))
                    return new WinConditionResult { WinnerRiotTeamId = team, Timestamp = ev.Timestamp };
            }
            return null;
        }

        private static WinConditionResult? FirstPlayerToReachKillStreak(RiotMatchTimeline timeline, Dictionary<int, int> participantTeam, int threshold)
        {
            if (threshold <= 0) return null;
            var streak = new Dictionary<int, int>();

            foreach (var ev in timeline.Events.Where(e => e.Type == "CHAMPION_KILL"))
            {
                if (ev.VictimId is > 0) streak[ev.VictimId!.Value] = 0; // morir corta la racha propia

                if (ev.KillerId is > 0)
                {
                    var killer = ev.KillerId!.Value;
                    streak[killer] = streak.GetValueOrDefault(killer) + 1;
                    if (streak[killer] >= threshold && participantTeam.TryGetValue(killer, out var team))
                        return new WinConditionResult { WinnerRiotTeamId = team, Timestamp = ev.Timestamp };
                }
            }
            return null;
        }

        // Multikill: kills consecutivos del mismo jugador dentro de la ventana oficial
        // de 10s de LoL, sin morir en el medio (si muere, se corta arriba via streak-
        // style reset — reusa el mismo diccionario de "ultimo kill" solo para el timer).
        private static WinConditionResult? FirstPlayerToReachMultikill(RiotMatchTimeline timeline, Dictionary<int, int> participantTeam, int tier)
        {
            if (tier <= 1) return null;
            var lastKillAt = new Dictionary<int, long>();
            var streakCount = new Dictionary<int, int>();

            foreach (var ev in timeline.Events.Where(e => e.Type == "CHAMPION_KILL"))
            {
                if (ev.VictimId is > 0) { streakCount[ev.VictimId!.Value] = 0; lastKillAt.Remove(ev.VictimId!.Value); }

                if (ev.KillerId is > 0)
                {
                    var killer = ev.KillerId!.Value;
                    var withinWindow = lastKillAt.TryGetValue(killer, out var last) && (ev.Timestamp - last) <= MultikillWindowMs;
                    streakCount[killer] = withinWindow ? streakCount.GetValueOrDefault(killer) + 1 : 1;
                    lastKillAt[killer] = ev.Timestamp;

                    if (streakCount[killer] >= tier && participantTeam.TryGetValue(killer, out var team))
                        return new WinConditionResult { WinnerRiotTeamId = team, Timestamp = ev.Timestamp };
                }
            }
            return null;
        }

        // ─── Estructuras ────────────────────────────────────────────────────────────

        // BUILDING_KILL.TeamId es el equipo DUEÑO de la estructura perdida — el que la
        // derriba es el equipo rival.
        private static int AttackingTeamOf(RiotTimelineEvent ev) => ev.TeamId == 100 ? 200 : 100;

        private static WinConditionResult? FirstBuildingTeam(RiotMatchTimeline timeline, string buildingType)
        {
            var ev = timeline.Events.FirstOrDefault(e => e.Type == "BUILDING_KILL" && e.BuildingType == buildingType && e.TeamId is 100 or 200);
            return ev != null ? new WinConditionResult { WinnerRiotTeamId = AttackingTeamOf(ev), Timestamp = ev.Timestamp } : null;
        }

        private static WinConditionResult? FirstTeamToReachBuildingTally(RiotMatchTimeline timeline, string buildingType, int threshold)
        {
            if (threshold <= 0) return null;
            var tally = new Dictionary<int, int>();

            foreach (var ev in timeline.Events.Where(e => e.Type == "BUILDING_KILL" && e.BuildingType == buildingType && e.TeamId is 100 or 200))
            {
                var attacker = AttackingTeamOf(ev);
                tally[attacker] = tally.GetValueOrDefault(attacker) + 1;
                if (tally[attacker] >= threshold) return new WinConditionResult { WinnerRiotTeamId = attacker, Timestamp = ev.Timestamp };
            }
            return null;
        }

        // ─── Progreso por frame (subditos / oro / nivel / daño) ────────────────────

        private static WinConditionResult? FirstPlayerToReachFrameStat(
            RiotMatchTimeline timeline, Dictionary<int, int> participantTeam, int threshold, Func<RiotParticipantFrame, int> selector)
        {
            if (threshold <= 0) return null;

            foreach (var frame in timeline.Frames)
            {
                foreach (var pf in frame.Participants)
                {
                    if (selector(pf) >= threshold && participantTeam.TryGetValue(pf.ParticipantId, out var team))
                        return new WinConditionResult { WinnerRiotTeamId = team, Timestamp = frame.Timestamp };
                }
            }
            return null;
        }

        // ─── Basadas en tiempo ──────────────────────────────────────────────────────

        private static WinConditionResult? TeamAheadAtMinute(RiotMatchTimeline timeline, Dictionary<int, int> participantTeam, int minute)
        {
            if (minute <= 0) return null;
            var cutoffMs = minute * 60_000L;

            var kills100 = 0;
            var kills200 = 0;
            foreach (var ev in timeline.Events.Where(e => e.Type == "CHAMPION_KILL" && e.Timestamp <= cutoffMs && e.KillerId is > 0))
            {
                if (!participantTeam.TryGetValue(ev.KillerId!.Value, out var team)) continue;
                if (team == 100) kills100++; else if (team == 200) kills200++;
            }

            if (timeline.Frames.Count == 0 || timeline.Frames[^1].Timestamp < cutoffMs) return null; // la partida no llego a ese minuto
            if (kills100 == kills200) return null; // empate, la condicion no desempata
            return new WinConditionResult { WinnerRiotTeamId = kills100 > kills200 ? 100 : 200, Timestamp = cutoffMs };
        }

        private static WinConditionResult? FirstTeamWithGoldLead(RiotMatchTimeline timeline, Dictionary<int, int> participantTeam, int threshold)
        {
            if (threshold <= 0) return null;

            foreach (var frame in timeline.Frames)
            {
                var gold100 = 0;
                var gold200 = 0;
                foreach (var pf in frame.Participants)
                {
                    if (!participantTeam.TryGetValue(pf.ParticipantId, out var team)) continue;
                    if (team == 100) gold100 += pf.TotalGold; else if (team == 200) gold200 += pf.TotalGold;
                }

                if (gold100 - gold200 >= threshold) return new WinConditionResult { WinnerRiotTeamId = 100, Timestamp = frame.Timestamp };
                if (gold200 - gold100 >= threshold) return new WinConditionResult { WinnerRiotTeamId = 200, Timestamp = frame.Timestamp };
            }
            return null;
        }
    }
}
