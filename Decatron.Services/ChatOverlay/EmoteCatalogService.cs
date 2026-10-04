using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.ChatOverlay
{
    /// <summary>Un emote listo para dibujar, sea de la plataforma o de un proveedor externo</summary>
    public sealed record EmoteInfo(string Name, string Url, string Provider, bool Animated, bool ZeroWidth);

    /// <summary>Qué proveedores externos usa un canal</summary>
    public sealed record EmoteProviders(bool SevenTv, bool Bttv, bool Ffz, bool Globals, bool Decatron = true)
    {
        public static readonly EmoteProviders All = new(true, true, true, true, true);
        public string CacheKey => $"{(SevenTv ? 1 : 0)}{(Bttv ? 1 : 0)}{(Ffz ? 1 : 0)}{(Globals ? 1 : 0)}{(Decatron ? 1 : 0)}";
    }

    /// <summary>
    /// Emotes externos (7TV, BTTV, FFZ) de un canal: globales y del canal, normalizados a un solo
    /// formato y cacheados. Si un proveedor cae se sirve lo último que hubo (o nada) y se reintenta
    /// en un minuto: el overlay nunca debe romperse por un tercero.
    /// Plan: .dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 1B.
    /// </summary>
    public class EmoteCatalogService
    {
        private static readonly TimeSpan GlobalTtl = TimeSpan.FromHours(6);
        private static readonly TimeSpan ChannelTtl = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan RetryAfterError = TimeSpan.FromMinutes(1);
        private static readonly TimeSpan MergedTtl = TimeSpan.FromSeconds(60);

        // Emotes de BTTV que se dibujan encima del anterior (no traen la marca en su API)
        private static readonly HashSet<string> BttvZeroWidth = new(StringComparer.Ordinal)
        {
            "SoSnowy", "IceCold", "SantaHat", "TopHat", "ReinDeer", "CandyCane", "cvMask", "cvHazmat"
        };

        private static readonly TimeSpan OwnTtl = TimeSpan.FromSeconds(60);
        private static readonly TimeSpan OwnerLookupTtl = TimeSpan.FromMinutes(5);

        private readonly IHttpClientFactory _http;
        private readonly IServiceScopeFactory _scopes;
        private readonly string _publicBase;
        private readonly ILogger<EmoteCatalogService> _logger;

        private sealed class Entry
        {
            public DateTime At;
            public TimeSpan Ttl;
            public Dictionary<string, EmoteInfo> Map = new(StringComparer.Ordinal);
        }

        private readonly ConcurrentDictionary<string, Entry> _providerCache = new();
        private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();
        private readonly ConcurrentDictionary<string, (DateTime At, Dictionary<string, EmoteInfo> Map)> _merged = new();
        private readonly ConcurrentDictionary<long, (DateTime At, Dictionary<string, EmoteInfo> Map)> _own = new();
        private readonly ConcurrentDictionary<string, (DateTime At, long? UserId)> _owners = new();

        public EmoteCatalogService(IHttpClientFactory http, IServiceScopeFactory scopes, Microsoft.Extensions.Configuration.IConfiguration config,
            ILogger<EmoteCatalogService> logger)
        {
            _http = http;
            _scopes = scopes;
            _publicBase = (config["Emotes:PublicBase"] ?? "https://decatron.net").TrimEnd('/');
            _logger = logger;
        }

        /// <summary>Lo cacheado de los emotes propios de un canal queda viejo (se subió, aprobó, ocultó o borró uno)</summary>
        public void InvalidateOwn(long userId)
        {
            _own.TryRemove(userId, out _);
            _merged.Clear();
        }

        /// <summary>Los emotes propios aprobados de un canal, resueltos por su cuenta de Twitch o de Kick</summary>
        private async Task<Dictionary<string, EmoteInfo>> GetOwnAsync(string? twitchId, string? kickId)
        {
            var key = $"{twitchId}|{kickId}";
            long? userId;
            if (_owners.TryGetValue(key, out var hit) && DateTime.UtcNow - hit.At < OwnerLookupTtl) userId = hit.UserId;
            else
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<Decatron.Data.DecatronDbContext>();
                    userId = await db.Users.AsNoTracking()
                        .Where(u => u.IsActive && ((!string.IsNullOrEmpty(twitchId) && u.TwitchId == twitchId) || (!string.IsNullOrEmpty(kickId) && u.KickId == kickId)))
                        .Select(u => (long?)u.Id).FirstOrDefaultAsync();
                    _owners[key] = (DateTime.UtcNow, userId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[Emotes] No se pudo resolver el canal de los emotes propios");
                    return new Dictionary<string, EmoteInfo>(StringComparer.Ordinal);
                }
            }
            if (userId == null) return new Dictionary<string, EmoteInfo>(StringComparer.Ordinal);

            if (_own.TryGetValue(userId.Value, out var cached) && DateTime.UtcNow - cached.At < OwnTtl) return cached.Map;
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<Decatron.Data.DecatronDbContext>();
                var rows = await db.ChannelEmotes.AsNoTracking()
                    .Where(e => e.UserId == userId && e.Status == Decatron.Core.Models.ChannelEmote.Approved).ToListAsync();
                var map = new Dictionary<string, EmoteInfo>(StringComparer.Ordinal);
                foreach (var e in rows)
                    map[e.Name] = new EmoteInfo(e.Name, $"{_publicBase}/uploads/emotes/{e.UserId}/{e.FileKey}/2.webp", "decatron", e.Animated, e.ZeroWidth);
                _own[userId.Value] = (DateTime.UtcNow, map);
                return map;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Emotes] No se pudieron leer los emotes propios de {User}", userId);
                return cached.Map ?? new Dictionary<string, EmoteInfo>(StringComparer.Ordinal);
            }
        }

        /// <summary>
        /// Todos los emotes externos que aplican a un canal. Precedencia ante un mismo nombre:
        /// los del canal ganan a los globales, y entre proveedores 7TV &gt; BTTV &gt; FFZ.
        /// </summary>
        public async Task<IReadOnlyDictionary<string, EmoteInfo>> GetMapAsync(string? twitchId, string? kickId, EmoteProviders providers)
        {
            var key = $"{twitchId}|{kickId}|{providers.CacheKey}";
            if (_merged.TryGetValue(key, out var hit) && DateTime.UtcNow - hit.At < MergedTtl)
                return hit.Map;

            var layers = new List<Task<Dictionary<string, EmoteInfo>>>();
            // De menos a más prioridad: lo último que se aplica gana
            if (providers.Globals)
            {
                if (providers.Ffz) layers.Add(GetAsync("ffz:global", GlobalTtl, FetchFfzGlobalAsync));
                if (providers.Bttv) layers.Add(GetAsync("bttv:global", GlobalTtl, FetchBttvGlobalAsync));
                if (providers.SevenTv) layers.Add(GetAsync("7tv:global", GlobalTtl, FetchSevenTvGlobalAsync));
            }
            if (!string.IsNullOrEmpty(twitchId))
            {
                if (providers.Ffz) layers.Add(GetAsync($"ffz:twitch:{twitchId}", ChannelTtl, () => FetchFfzChannelAsync(twitchId)));
                if (providers.Bttv) layers.Add(GetAsync($"bttv:twitch:{twitchId}", ChannelTtl, () => FetchBttvChannelAsync(twitchId)));
                if (providers.SevenTv) layers.Add(GetAsync($"7tv:twitch:{twitchId}", ChannelTtl, () => FetchSevenTvChannelAsync("twitch", twitchId)));
            }
            if (!string.IsNullOrEmpty(kickId) && providers.SevenTv)
                layers.Add(GetAsync($"7tv:kick:{kickId}", ChannelTtl, () => FetchSevenTvChannelAsync("kick", kickId)));

            // Los emotes propios van al final: ganan a los de 7TV, BTTV y FFZ ante un mismo nombre
            if (providers.Decatron) layers.Add(GetOwnAsync(twitchId, kickId));

            var merged = new Dictionary<string, EmoteInfo>(StringComparer.Ordinal);
            foreach (var layer in await Task.WhenAll(layers))
                foreach (var (name, emote) in layer)
                    merged[name] = emote;

            _merged[key] = (DateTime.UtcNow, merged);
            return merged;
        }

        /// <summary>Descarta lo cacheado de un canal para que se vuelva a pedir (botón "Actualizar ahora")</summary>
        public void Refresh(string? twitchId, string? kickId)
        {
            foreach (var k in _providerCache.Keys.Where(k =>
                (!string.IsNullOrEmpty(twitchId) && k.EndsWith($":twitch:{twitchId}")) ||
                (!string.IsNullOrEmpty(kickId) && k.EndsWith($":kick:{kickId}"))))
                _providerCache.TryRemove(k, out _);
            _merged.Clear();
        }

        private async Task<Dictionary<string, EmoteInfo>> GetAsync(string key, TimeSpan ttl, Func<Task<Dictionary<string, EmoteInfo>>> fetch)
        {
            if (_providerCache.TryGetValue(key, out var fresh) && DateTime.UtcNow - fresh.At < fresh.Ttl)
                return fresh.Map;

            var gate = _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync();
            try
            {
                if (_providerCache.TryGetValue(key, out fresh) && DateTime.UtcNow - fresh.At < fresh.Ttl)
                    return fresh.Map;

                try
                {
                    var map = await fetch();
                    _providerCache[key] = new Entry { At = DateTime.UtcNow, Ttl = ttl, Map = map };
                    return map;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("[Emotes] {Key}: {Error}", key, ex.Message);
                    // Se sirve lo último que hubo y se reintenta en un minuto
                    var stale = _providerCache.TryGetValue(key, out var old) ? old.Map : new Dictionary<string, EmoteInfo>(StringComparer.Ordinal);
                    _providerCache[key] = new Entry { At = DateTime.UtcNow, Ttl = RetryAfterError, Map = stale };
                    return stale;
                }
            }
            finally
            {
                gate.Release();
            }
        }

        private async Task<JsonElement?> GetJsonAsync(string url)
        {
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(8);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Decatron/1.0 (+https://decatron.net)");
            using var response = await client.GetAsync(url);
            // Un canal sin set o sin cuenta en el proveedor es normal, no un error
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                return null;
            response.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
            return doc.RootElement.Clone();
        }

        // ── 7TV ───────────────────────────────────────────────────────────

        private Task<Dictionary<string, EmoteInfo>> FetchSevenTvGlobalAsync() =>
            FetchSevenTvAsync("https://7tv.io/v3/emote-sets/global", set => set);

        private Task<Dictionary<string, EmoteInfo>> FetchSevenTvChannelAsync(string platform, string id) =>
            FetchSevenTvAsync($"https://7tv.io/v3/users/{platform}/{id}",
                user => user.TryGetProperty("emote_set", out var s) && s.ValueKind == JsonValueKind.Object ? s : (JsonElement?)null);

        private async Task<Dictionary<string, EmoteInfo>> FetchSevenTvAsync(string url, Func<JsonElement, JsonElement?> pickSet)
        {
            var map = new Dictionary<string, EmoteInfo>(StringComparer.Ordinal);
            var root = await GetJsonAsync(url);
            if (root == null) return map;
            var set = pickSet(root.Value);
            if (set == null || !set.Value.TryGetProperty("emotes", out var emotes) || emotes.ValueKind != JsonValueKind.Array)
                return map;

            foreach (var e in emotes.EnumerateArray())
            {
                var name = e.TryGetProperty("name", out var n) ? n.GetString() : null;
                var id = e.TryGetProperty("id", out var i) ? i.GetString() : null;
                if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(id)) continue;

                var animated = false;
                var zeroWidth = e.TryGetProperty("flags", out var f) && f.ValueKind == JsonValueKind.Number && (f.GetInt32() & 1) != 0;
                var host = "https://cdn.7tv.app/emote/" + id;
                if (e.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object)
                {
                    animated = data.TryGetProperty("animated", out var a) && a.ValueKind == JsonValueKind.True;
                    if (data.TryGetProperty("flags", out var df) && df.ValueKind == JsonValueKind.Number && (df.GetInt32() & 256) != 0)
                        zeroWidth = true;
                    if (data.TryGetProperty("host", out var h) && h.TryGetProperty("url", out var hu) && hu.GetString() is { Length: > 0 } hostUrl)
                        host = hostUrl.StartsWith("//") ? "https:" + hostUrl : hostUrl;
                }
                map[name] = new EmoteInfo(name, $"{host}/2x.webp", "7tv", animated, zeroWidth);
            }
            return map;
        }

        // ── BetterTTV ─────────────────────────────────────────────────────

        private async Task<Dictionary<string, EmoteInfo>> FetchBttvGlobalAsync()
        {
            var map = new Dictionary<string, EmoteInfo>(StringComparer.Ordinal);
            var root = await GetJsonAsync("https://api.betterttv.net/3/cached/emotes/global");
            if (root is { ValueKind: JsonValueKind.Array } arr) AddBttv(map, arr);
            return map;
        }

        private async Task<Dictionary<string, EmoteInfo>> FetchBttvChannelAsync(string twitchId)
        {
            var map = new Dictionary<string, EmoteInfo>(StringComparer.Ordinal);
            var root = await GetJsonAsync($"https://api.betterttv.net/3/cached/users/twitch/{twitchId}");
            if (root is { ValueKind: JsonValueKind.Object } obj)
            {
                if (obj.TryGetProperty("sharedEmotes", out var shared) && shared.ValueKind == JsonValueKind.Array) AddBttv(map, shared);
                if (obj.TryGetProperty("channelEmotes", out var own) && own.ValueKind == JsonValueKind.Array) AddBttv(map, own);
            }
            return map;
        }

        private static void AddBttv(Dictionary<string, EmoteInfo> map, JsonElement list)
        {
            foreach (var e in list.EnumerateArray())
            {
                var code = e.TryGetProperty("code", out var c) ? c.GetString() : null;
                var id = e.TryGetProperty("id", out var i) ? i.GetString() : null;
                if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(id)) continue;
                var animated = (e.TryGetProperty("animated", out var a) && a.ValueKind == JsonValueKind.True)
                               || (e.TryGetProperty("imageType", out var t) && t.GetString() == "gif");
                map[code] = new EmoteInfo(code, $"https://cdn.betterttv.net/emote/{id}/2x.webp", "bttv", animated, BttvZeroWidth.Contains(code));
            }
        }

        // ── FrankerFaceZ ──────────────────────────────────────────────────

        private async Task<Dictionary<string, EmoteInfo>> FetchFfzGlobalAsync()
        {
            var map = new Dictionary<string, EmoteInfo>(StringComparer.Ordinal);
            var root = await GetJsonAsync("https://api.frankerfacez.com/v1/set/global");
            if (root is { ValueKind: JsonValueKind.Object } obj) AddFfz(map, obj, defaultSetsOnly: true);
            return map;
        }

        private async Task<Dictionary<string, EmoteInfo>> FetchFfzChannelAsync(string twitchId)
        {
            var map = new Dictionary<string, EmoteInfo>(StringComparer.Ordinal);
            var root = await GetJsonAsync($"https://api.frankerfacez.com/v1/room/id/{twitchId}");
            if (root is { ValueKind: JsonValueKind.Object } obj) AddFfz(map, obj, defaultSetsOnly: false);
            return map;
        }

        private static void AddFfz(Dictionary<string, EmoteInfo> map, JsonElement root, bool defaultSetsOnly)
        {
            if (!root.TryGetProperty("sets", out var sets) || sets.ValueKind != JsonValueKind.Object) return;

            HashSet<string>? wanted = null;
            if (defaultSetsOnly && root.TryGetProperty("default_sets", out var defaults) && defaults.ValueKind == JsonValueKind.Array)
                wanted = defaults.EnumerateArray().Select(d => d.ToString()).ToHashSet();

            foreach (var set in sets.EnumerateObject())
            {
                if (wanted != null && !wanted.Contains(set.Name)) continue;
                if (!set.Value.TryGetProperty("emoticons", out var emoticons) || emoticons.ValueKind != JsonValueKind.Array) continue;

                foreach (var e in emoticons.EnumerateArray())
                {
                    var name = e.TryGetProperty("name", out var n) ? n.GetString() : null;
                    if (string.IsNullOrEmpty(name)) continue;

                    var animated = false;
                    string? url = null;
                    if (e.TryGetProperty("animated", out var anim) && anim.ValueKind == JsonValueKind.Object)
                    {
                        url = PickFfzUrl(anim);
                        animated = url != null;
                    }
                    if (url == null && e.TryGetProperty("urls", out var urls) && urls.ValueKind == JsonValueKind.Object)
                        url = PickFfzUrl(urls);
                    if (url == null) continue;

                    map[name] = new EmoteInfo(name, url, "ffz", animated, false);
                }
            }
        }

        private static string? PickFfzUrl(JsonElement urls)
        {
            foreach (var size in new[] { "2", "1", "4" })
                if (urls.TryGetProperty(size, out var u) && u.GetString() is { Length: > 0 } s)
                    return s.StartsWith("//") ? "https:" + s : s;
            return null;
        }
    }
}
