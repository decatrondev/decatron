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
    }
}
