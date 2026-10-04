using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.ChatOverlay
{
    public sealed record ChatBadgeImage(string Url, string Title);

    /// <summary>
    /// Imágenes de las insignias de Twitch (globales y las propias de cada canal: sub por meses,
    /// bits, etc.). Se piden a Helix con el token de la app y se cachean.
    /// </summary>
    public class ChatBadgeService
    {
        private static readonly TimeSpan GlobalTtl = TimeSpan.FromHours(12);
        private static readonly TimeSpan ChannelTtl = TimeSpan.FromMinutes(30);
        private static readonly TimeSpan RetryAfterError = TimeSpan.FromMinutes(1);

        private readonly TwitchApiService _twitch;
        private readonly ILogger<ChatBadgeService> _logger;
        private readonly ConcurrentDictionary<string, (DateTime At, TimeSpan Ttl, Dictionary<string, ChatBadgeImage> Map)> _cache = new();
        private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

        public ChatBadgeService(TwitchApiService twitch, ILogger<ChatBadgeService> logger)
        {
            _twitch = twitch;
            _logger = logger;
        }

        /// <summary>La imagen de una insignia ("moderator", "1") en un canal; null si no existe</summary>
        public async Task<ChatBadgeImage?> ResolveAsync(string? broadcasterId, string setId, string version)
        {
            var key = $"{setId}/{version}";
            if (!string.IsNullOrEmpty(broadcasterId))
            {
                var channel = await GetAsync(broadcasterId, ChannelTtl);
                if (channel.TryGetValue(key, out var own)) return own;
            }
            var global = await GetAsync(null, GlobalTtl);
            return global.TryGetValue(key, out var g) ? g : null;
        }

        private async Task<Dictionary<string, ChatBadgeImage>> GetAsync(string? broadcasterId, TimeSpan ttl)
        {
            var cacheKey = broadcasterId ?? "global";
            if (_cache.TryGetValue(cacheKey, out var hit) && DateTime.UtcNow - hit.At < hit.Ttl)
                return hit.Map;

            var gate = _locks.GetOrAdd(cacheKey, _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync();
            try
            {
                if (_cache.TryGetValue(cacheKey, out hit) && DateTime.UtcNow - hit.At < hit.Ttl)
                    return hit.Map;

                var json = await _twitch.GetChatBadgesJsonAsync(broadcasterId);
                if (json == null)
                {
                    var stale = _cache.TryGetValue(cacheKey, out var old) ? old.Map : new Dictionary<string, ChatBadgeImage>();
                    _cache[cacheKey] = (DateTime.UtcNow, RetryAfterError, stale);
                    return stale;
                }

                var map = Parse(json);
                _cache[cacheKey] = (DateTime.UtcNow, ttl, map);
                return map;
            }
            finally
            {
                gate.Release();
            }
        }

        public static Dictionary<string, ChatBadgeImage> Parse(string json)
        {
            var map = new Dictionary<string, ChatBadgeImage>();
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
                return map;

            foreach (var set in data.EnumerateArray())
            {
                var setId = set.TryGetProperty("set_id", out var s) ? s.GetString() : null;
                if (string.IsNullOrEmpty(setId) || !set.TryGetProperty("versions", out var versions)) continue;
                foreach (var v in versions.EnumerateArray())
                {
                    var id = v.TryGetProperty("id", out var i) ? i.GetString() : null;
                    var url = v.TryGetProperty("image_url_2x", out var u) ? u.GetString() : null;
                    if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(url)) continue;
                    var title = v.TryGetProperty("title", out var t) ? t.GetString() ?? setId : setId;
                    map[$"{setId}/{id}"] = new ChatBadgeImage(url, title);
                }
            }
            return map;
        }
    }
}
