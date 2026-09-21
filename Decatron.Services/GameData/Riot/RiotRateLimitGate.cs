using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;

namespace Decatron.Services.GameData.Riot
{
    /// <summary>
    /// Freno compartido por API key de Riot. Riot limita POR KEY (no por canal), y la
    /// key de plataforma la usan todos los canales a la vez — sin esto, el primer
    /// 429 se convierte en una cascada de 429 de todos los pollers. Dos reglas:
    ///
    /// 1. Serializa las requests de una misma key con un espaciado minimo
    ///    (MinSpacing) para no reventar el limite por segundo.
    /// 2. Cuando Riot devuelve 429, bloquea esa key hasta que pase Retry-After
    ///    (o 10 s si no vino el header) — todos los que llamen mientras tanto esperan.
    ///
    /// Singleton. Lo usan RiotApiClient (automatico en cada GetJsonAsync) y, si hace
    /// falta, el poller para saber si una key esta en penitencia (IsBlocked).
    /// </summary>
    public class RiotRateLimitGate
    {
        private class KeyState
        {
            public readonly SemaphoreSlim Lock = new(1, 1);
            public DateTime NextAllowedUtc = DateTime.MinValue;
            public DateTime BlockedUntilUtc = DateTime.MinValue;
        }

        private readonly ConcurrentDictionary<string, KeyState> _keys = new();

        // Production keys de Riot: 500 req / 10 s por defecto. 25 ms de espaciado =
        // 40 req/s como tope teorico, bien por debajo, y sin serializar demasiado.
        private static readonly TimeSpan MinSpacing = TimeSpan.FromMilliseconds(25);
        private static readonly TimeSpan DefaultPenalty = TimeSpan.FromSeconds(10);

        private KeyState StateFor(string apiKey) => _keys.GetOrAdd(apiKey, _ => new KeyState());

        public bool IsBlocked(string apiKey) => StateFor(apiKey).BlockedUntilUtc > DateTime.UtcNow;

        public TimeSpan BlockedFor(string apiKey)
        {
            var until = StateFor(apiKey).BlockedUntilUtc;
            return until > DateTime.UtcNow ? until - DateTime.UtcNow : TimeSpan.Zero;
        }

        /// <summary>Espera el turno de esta key (espaciado + penalizacion 429 si la hay).</summary>
        public async Task WaitAsync(string apiKey, CancellationToken ct = default)
        {
            var state = StateFor(apiKey);
            await state.Lock.WaitAsync(ct);
            try
            {
                var now = DateTime.UtcNow;
                var waitUntil = state.BlockedUntilUtc > state.NextAllowedUtc ? state.BlockedUntilUtc : state.NextAllowedUtc;
                if (waitUntil > now)
                    await Task.Delay(waitUntil - now, ct);
                state.NextAllowedUtc = DateTime.UtcNow + MinSpacing;
            }
            finally
            {
                state.Lock.Release();
            }
        }

        /// <summary>Riot devolvio 429: nadie mas usa esta key hasta que pase retryAfter.</summary>
        public void Block(string apiKey, TimeSpan? retryAfter)
        {
            var penalty = retryAfter ?? DefaultPenalty;
            if (penalty < TimeSpan.FromSeconds(1)) penalty = TimeSpan.FromSeconds(1);
            if (penalty > TimeSpan.FromMinutes(2)) penalty = TimeSpan.FromMinutes(2);
            var state = StateFor(apiKey);
            var until = DateTime.UtcNow + penalty;
            if (until > state.BlockedUntilUtc) state.BlockedUntilUtc = until;
        }
    }
}
