using System;
using System.Collections.Concurrent;
using System.Linq;

namespace Decatron.Core.Services.Moderation
{
    /// <summary>
    /// Caché corta por canal de lo que la moderación lee en cada mensaje (config, filtros,
    /// palabras). Se invalida al guardar desde el dashboard, así que el TTL solo cubre
    /// cambios hechos por otro camino.
    /// </summary>
    public static class ModerationCache
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);
        private static readonly ConcurrentDictionary<string, (DateTime At, object? Value)> _entries = new();

        public static bool TryGet<T>(string kind, string channel, out T? value)
        {
            if (_entries.TryGetValue(Key(kind, channel), out var entry) && DateTime.UtcNow - entry.At < Ttl)
            {
                value = (T?)entry.Value;
                return true;
            }
            value = default;
            return false;
        }

        public static void Set<T>(string kind, string channel, T? value) =>
            _entries[Key(kind, channel)] = (DateTime.UtcNow, value);

        public static void Invalidate(string channel)
        {
            var suffix = ":" + channel.ToLower();
            foreach (var key in _entries.Keys.Where(k => k.EndsWith(suffix)))
                _entries.TryRemove(key, out _);
        }

        private static string Key(string kind, string channel) => $"{kind}:{channel.ToLower()}";
    }
}
