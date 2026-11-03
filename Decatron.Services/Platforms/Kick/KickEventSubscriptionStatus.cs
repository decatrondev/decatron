using System.Collections.Concurrent;

namespace Decatron.Services.Platforms.Kick
{
    /// <summary>Último resultado de asegurar las suscripciones de cada canal de Kick (en memoria; se rehace en cada ciclo).</summary>
    public record KickEventSubscriptionState(DateTime CheckedAtUtc, bool Ok, IReadOnlyList<string> Missing, string? Error);

    public class KickEventSubscriptionStatus
    {
        private readonly ConcurrentDictionary<string, KickEventSubscriptionState> _byKickId = new();

        public void Set(string kickId, KickEventSubscriptionState state) => _byKickId[kickId] = state;

        public KickEventSubscriptionState? Get(string kickId) => _byKickId.TryGetValue(kickId, out var s) ? s : null;
    }
}
