using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Desktop
{
    /// <summary>
    /// Apps conectadas por canal (usuario). Sirve para empujarles cambios sin que reconecten:
    /// por ejemplo, cuando el streamer activa la traducción en el dashboard con la app ya
    /// abierta, se le reenvía la descripción del módulo (<c>core/module</c>) en vez de esperar
    /// al próximo <c>hello</c>.
    /// </summary>
    public sealed class DesktopConnectionRegistry
    {
        private readonly ConcurrentDictionary<long, ConcurrentDictionary<DesktopConnection, byte>> _byUser = new();
        private readonly IReadOnlyDictionary<string, IDesktopChannel> _channels;
        private readonly ILogger<DesktopConnectionRegistry> _logger;

        public DesktopConnectionRegistry(IEnumerable<IDesktopChannel> channels, ILogger<DesktopConnectionRegistry> logger)
        {
            _channels = channels.ToDictionary(c => c.Name, StringComparer.OrdinalIgnoreCase);
            _logger = logger;
        }

        internal void Add(DesktopConnection conn) =>
            _byUser.GetOrAdd(conn.UserId, _ => new()).TryAdd(conn, 0);

        internal void Remove(DesktopConnection conn)
        {
            if (!_byUser.TryGetValue(conn.UserId, out var set)) return;
            set.TryRemove(conn, out _);
            if (set.IsEmpty) _byUser.TryRemove(conn.UserId, out _);
        }

        public int CountFor(long userId) => _byUser.TryGetValue(userId, out var s) ? s.Count : 0;

        /// <summary>Vuelve a describir un módulo y se lo manda a todas las apps del usuario.</summary>
        public async Task NotifyModuleChangedAsync(long userId, string channel)
        {
            if (!_channels.TryGetValue(channel, out var ch)) return;
            if (!_byUser.TryGetValue(userId, out var set) || set.IsEmpty) return;
            foreach (var conn in set.Keys)
            {
                try
                {
                    var desc = await ch.DescribeAsync(conn);
                    await conn.SendAsync("core", "module", new { name = ch.Name, module = desc });
                }
                catch (Exception ex) { _logger.LogDebug(ex, "[Desktop] no se pudo avisar cambio de {Ch} a {Login}", channel, conn.Login); }
            }
        }
    }
}
