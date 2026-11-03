using System.Collections.Concurrent;

namespace Decatron.Services.Platforms
{
    /// <summary>
    /// Descarta avisos repetidos por id: Kick reintenta una entrega si no la confirmamos a tiempo, y sin esto una alerta
    /// o una suma de tiempo se haría dos veces. Guarda los ids 30 minutos.
    /// </summary>
    public class PlatformEventDeduper
    {
        private static readonly TimeSpan Keep = TimeSpan.FromMinutes(30);
        private readonly ConcurrentDictionary<string, DateTime> _seen = new();
        private long _calls;

        /// <summary>True si es la primera vez que se ve este id.</summary>
        public bool TryMarkNew(string platform, string id, DateTime? nowUtc = null)
        {
            var now = nowUtc ?? DateTime.UtcNow;
            if (Interlocked.Increment(ref _calls) % 200 == 0) Prune(now);
            return _seen.TryAdd($"{platform}:{id}", now);
        }

        private void Prune(DateTime now)
        {
            foreach (var kv in _seen)
                if (now - kv.Value > Keep) _seen.TryRemove(kv.Key, out _);
        }
    }
}
