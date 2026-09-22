using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using Decatron.Core.Models.GameOverlays;

namespace Decatron.Services.GameData.LolLive
{
    /// <summary>
    /// Ultimo estado del cliente de LoL que mando Decatron Desktop, por streamer. Solo
    /// memoria: si la app se desconecta, se borra y el overlay vuelve a lo que da la
    /// Riot API. La cuenta se identifica por PUUID (= linked_game_accounts.external_id).
    /// </summary>
    public class LolLiveStateStore
    {
        public sealed class Entry
        {
            public string? Puuid { get; set; }
            public string? SummonerName { get; set; }
            public LivePhaseInfo Phase { get; set; } = new();
            public long DeviceId { get; set; }

            // ── Coach (fase 2) ──
            /// <summary>Llamadas a la IA en la selección actual (tope LolCoachBrain.MaxCallsPerChampSelect).</summary>
            public int CoachCalls { get; set; }
            /// <summary>Firma de picks lockeados + bans de la última vez que se comentó, para no repetir.</summary>
            public string LastCommentedSignature { get; set; } = "";
            public bool LastMyTurn { get; set; }
            public bool FinalSent { get; set; }
            public bool PostGameSent { get; set; }
            /// <summary>Día (UTC) en que ya se dio el briefing, para darlo una vez por stream.</summary>
            public DateTime? BriefedOn { get; set; }
            /// <summary>Firma de los miembros del lobby que ya se comentaron.</summary>
            public string LastLobbySignature { get; set; } = "";
            /// <summary>Longitud de la racha de derrotas en la que ya se hizo el tilt check.</summary>
            public int TiltCheckedAt { get; set; }
            public CancellationTokenSource? Debounce { get; set; }
            /// <summary>Últimos comentarios (los más nuevos al final), para el panel y los comandos.</summary>
            public List<LiveCoachInfo> CoachHistory { get; } = new();

            public void ResetChampSelect()
            {
                CoachCalls = 0; LastCommentedSignature = ""; LastMyTurn = false; FinalSent = false;
                Debounce?.Cancel(); Debounce = null;
            }
        }

        private readonly ConcurrentDictionary<long, Entry> _byUser = new();

        public Entry GetOrCreate(long userId, long deviceId) =>
            _byUser.AddOrUpdate(userId, _ => new Entry { DeviceId = deviceId }, (_, e) => { e.DeviceId = deviceId; return e; });

        public Entry? Get(long userId) => _byUser.TryGetValue(userId, out var e) ? e : null;

        public void Remove(long userId, long deviceId)
        {
            // Solo el dispositivo que lo puso lo quita: si el streamer tiene dos apps, la
            // segunda no borra lo de la primera al cerrarse.
            if (_byUser.TryGetValue(userId, out var e) && e.DeviceId == deviceId) _byUser.TryRemove(userId, out _);
        }

        /// <summary>Fase para una cuenta concreta, o null si la app no esta o es otra cuenta.</summary>
        public LivePhaseInfo? PhaseFor(long userId, string? puuid)
        {
            if (!_byUser.TryGetValue(userId, out var e)) return null;
            if (string.IsNullOrEmpty(puuid) || !string.Equals(e.Puuid, puuid, StringComparison.OrdinalIgnoreCase)) return null;
            return e.Phase;
        }

        /// <summary>
        /// Lo que la tarjeta de Game Overlays necesita para su linea de estado ("Seleccion ·
        /// Jinx", "En partida · 12:30", "Victoria 7/2/9"): la fase y lo justo de cada una.
        /// Sin coach, prediccion, picks completos ni scouting de los amigos: todo eso vive en
        /// el overlay Partida en vivo.
        /// </summary>
        public LivePhaseInfo? StatusLineFor(long userId, string? puuid)
        {
            var full = PhaseFor(userId, puuid);
            if (full == null) return null;
            var cs = full.ChampSelect;
            var pg = full.PostGame;
            return new LivePhaseInfo
            {
                Phase = full.Phase,
                QueueId = full.QueueId,
                QueueName = full.QueueName,
                Lobby = full.Lobby.ConvertAll(m => new LiveLobbyMember { Name = m.Name, Tag = m.Tag, IsMe = m.IsMe, IsLeader = m.IsLeader }),
                ChampSelect = cs == null ? null : new LiveChampSelect { MyPick = cs.MyPick, MyPosition = cs.MyPosition, MyTurn = cs.MyTurn, TimerPhase = cs.TimerPhase },
                Game = full.Game,
                PostGame = pg == null ? null : new LivePostGame { Win = pg.Win, Champion = pg.Champion, Kills = pg.Kills, Deaths = pg.Deaths, Assists = pg.Assists, PointsDelta = pg.PointsDelta, DurationSeconds = pg.DurationSeconds },
                UpdatedAt = full.UpdatedAt,
            };
        }
    }
}
