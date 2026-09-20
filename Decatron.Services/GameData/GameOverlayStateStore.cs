using System.Linq;
using System.Collections.Concurrent;
using Decatron.Core.Models.GameOverlays;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// Ultimo OverlayState calculado por el poller, por (canal, instancia). El
    /// endpoint publico del overlay lo devuelve al instante al cargar la pagina;
    /// las actualizaciones posteriores llegan por SignalR.
    /// </summary>
    public class GameOverlayStateStore
    {
        private readonly ConcurrentDictionary<(long userId, string slug), OverlayState> _states = new();

        public OverlayState? Get(long userId, string slug) => _states.TryGetValue((userId, slug), out var s) ? s : null;

        public void Set(long userId, string slug, OverlayState state) => _states[(userId, slug)] = state;

        public void Remove(long userId, string slug) => _states.TryRemove((userId, slug), out _);

        /// <summary>Todos los estados de un canal (una por instancia de overlay).</summary>
        public System.Collections.Generic.IEnumerable<OverlayState> AllFor(long userId) =>
            _states.Where(kv => kv.Key.Item1 == userId).Select(kv => kv.Value);
    }
}
