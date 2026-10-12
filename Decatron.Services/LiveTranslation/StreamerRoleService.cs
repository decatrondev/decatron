using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text.Json;
using Decatron.Core.Settings;
using Decatron.Services.Multiview;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>Qué niveles puede comprobar este canal con su token de Twitch y qué permiso le falta a cada uno.</summary>
    public sealed record LevelAvailability(bool HasTwitch, bool TokenValid, IReadOnlyDictionary<string, string[]> Missing);

    /// <summary>
    /// Pregunta a Twitch si una persona es seguidora, suscriptora, VIP o moderadora de un canal, SIEMPRE con el token del streamer
    /// (nunca el del espectador) y sin descifrarlo fuera del backend. Los resultados se guardan 10 minutos (2 si la persona no tiene
    /// ningún rol) para no pasar los límites de Twitch, y los permisos del token se validan con id.twitch.tv/oauth2/validate. Si algo
    /// falla devuelve null: quien llama niega la entrada (nunca se abre de más). Plan: TRADUCCION_ACCESO_PLAN.md, Fase 3.
    /// </summary>
    public sealed class StreamerRoleService
    {
        public const string ScopeFollowers = "moderator:read:followers";
        public const string ScopeSubs = "channel:read:subscriptions";
        public const string ScopeVips = "channel:read:vips";
        public static readonly string[] ScopeMods = { "moderation:read", "channel:manage:moderators" };

        private static readonly TimeSpan RolePositiveTtl = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan RoleNegativeTtl = TimeSpan.FromMinutes(2);
        private static readonly TimeSpan ScopesTtl = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan FailureTtl = TimeSpan.FromSeconds(30);

        private readonly IStreamerTwitchAccess _accounts;
        private readonly IHttpClientFactory _http;
        private readonly IMemoryCache _cache;
        private readonly TwitchSettings _twitch;
        private readonly ILogger<StreamerRoleService> _logger;
        private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

        public StreamerRoleService(IStreamerTwitchAccess accounts, IHttpClientFactory http, IMemoryCache cache, IOptions<TwitchSettings> twitch, ILogger<StreamerRoleService> logger)
        {
            _accounts = accounts;
            _http = http;
            _cache = cache;
            _twitch = twitch.Value;
            _logger = logger;
        }

        public void Invalidate(long ownerUserId) => _cache.Remove("lt-scopes:" + ownerUserId);

        /// <summary>Los permisos del token del streamer (null si no tiene token de Twitch o Twitch no lo valida).</summary>
        public async Task<HashSet<string>?> GetScopesAsync(long ownerUserId)
        {
            var key = "lt-scopes:" + ownerUserId;
            if (_cache.TryGetValue(key, out HashSet<string>? hit)) return hit;
            HashSet<string>? scopes = null;
            try
            {
                var me = await _accounts.GetTwitchAsync(ownerUserId);
                if (me != null)
                {
                    using var req = new HttpRequestMessage(HttpMethod.Get, "https://id.twitch.tv/oauth2/validate");
                    req.Headers.Authorization = new AuthenticationHeaderValue("OAuth", me.Token);
                    using var res = await _http.CreateClient().SendAsync(req);
                    if (res.IsSuccessStatusCode)
                    {
                        using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync());
                        scopes = doc.RootElement.TryGetProperty("scopes", out var sc) && sc.ValueKind == JsonValueKind.Array
                            ? sc.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToHashSet(StringComparer.Ordinal)
                            : new HashSet<string>();
                    }
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "[LiveTranslation] No se pudieron validar los permisos del token de {UserId}", ownerUserId);
            }
            _cache.Set(key, scopes, scopes == null ? FailureTtl : ScopesTtl);
            return scopes;
        }

        private static string[] Required(string mode) => mode switch
        {
            "followers" => new[] { ScopeFollowers },
            "subscribers" => new[] { ScopeSubs },
            "vip" => new[] { ScopeVips },
            "mods" => ScopeMods,
            _ => Array.Empty<string>(),
        };

        // Moderadores: basta uno de los dos permisos; el resto necesita el suyo
        private static bool Has(HashSet<string> scopes, string mode) =>
            mode == "mods" ? ScopeMods.Any(scopes.Contains) : Required(mode).All(scopes.Contains);

        /// <summary>Qué niveles se pueden comprobar hoy y qué permiso falta en cada uno (para el panel).</summary>
        public async Task<LevelAvailability> GetAvailabilityAsync(long ownerUserId)
        {
            var me = await _accounts.GetLinkedAsync(ownerUserId);
            if (me.TwitchLogin == null) return new LevelAvailability(false, false, new Dictionary<string, string[]>());
            var scopes = await GetScopesAsync(ownerUserId);
            var missing = new Dictionary<string, string[]>();
            foreach (var mode in new[] { "followers", "subscribers", "vip", "mods" })
                missing[mode] = scopes != null && Has(scopes, mode) ? Array.Empty<string>() : Required(mode);
            return new LevelAvailability(true, scopes != null, missing);
        }

        /// <summary>
        /// El rol de la persona en el canal, con las consultas que pide el nivel. null = no se pudo comprobar (sin token, falta el permiso
        /// de ese nivel, o Twitch falló).
        /// </summary>
        public async Task<ViewerRole?> GetRoleAsync(long ownerUserId, string mode, string viewerTwitchId)
        {
            var key = $"lt-role:{ownerUserId}:{mode}:{viewerTwitchId}";
            if (_cache.TryGetValue(key, out ViewerRole? hit)) return hit;

            var gate = _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync();
            try
            {
                if (_cache.TryGetValue(key, out hit)) return hit;
                var scopes = await GetScopesAsync(ownerUserId);
                if (scopes == null || !Has(scopes, mode)) return null;
                var me = await _accounts.GetTwitchAsync(ownerUserId);
                if (me == null) return null;

                // Solo se hacen las consultas del nivel y de los que lo incluyen, y solo si el token tiene su permiso
                var wantFollow = mode == "followers" && scopes.Contains(ScopeFollowers);
                var wantSub = (mode is "followers" or "subscribers") && scopes.Contains(ScopeSubs);
                var wantVip = (mode is "followers" or "subscribers" or "vip") && scopes.Contains(ScopeVips);
                var wantMod = ScopeMods.Any(scopes.Contains);

                var tFollow = wantFollow ? FollowedAtAsync(ownerUserId, me, viewerTwitchId) : Task.FromResult<(bool Ok, DateTime? Value)>((true, null));
                var tSub = wantSub ? SubTierAsync(ownerUserId, me, viewerTwitchId) : Task.FromResult<(bool Ok, int Value)>((true, 0));
                var tVip = wantVip ? IsInListAsync(ownerUserId, me, "channels/vips", viewerTwitchId) : Task.FromResult<(bool Ok, bool Value)>((true, false));
                var tMod = wantMod ? IsInListAsync(ownerUserId, me, "moderation/moderators", viewerTwitchId) : Task.FromResult<(bool Ok, bool Value)>((true, false));
                await Task.WhenAll(tFollow, tSub, tVip, tMod);

                // Si Twitch falló en una consulta que hacía falta, no se adivina: se niega y se reintenta pronto
                if (!tFollow.Result.Ok || !tSub.Result.Ok || !tVip.Result.Ok || !tMod.Result.Ok)
                {
                    _cache.Set(key, (ViewerRole?)null, FailureTtl);
                    return null;
                }
                var role = new ViewerRole(tMod.Result.Value, tVip.Result.Value, tSub.Result.Value, tFollow.Result.Value);
                var any = role.IsMod || role.IsVip || role.SubTier > 0 || role.FollowedAt != null;
                _cache.Set(key, role, any ? RolePositiveTtl : RoleNegativeTtl);
                return role;
            }
            finally { gate.Release(); }
        }

        private async Task<JsonDocument?> HelixAsync(long ownerUserId, TwitchIdentity me, string path, string viewerId, bool notFoundIsEmpty = false)
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, $"https://api.twitch.tv/helix/{path}?broadcaster_id={Uri.EscapeDataString(me.TwitchId)}&user_id={Uri.EscapeDataString(viewerId)}");
            req.Headers.Add("Client-Id", _twitch.ClientId);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", me.Token);
            using var res = await _http.CreateClient().SendAsync(req);
            if (res.StatusCode == System.Net.HttpStatusCode.NotFound && notFoundIsEmpty) return JsonDocument.Parse("{\"data\":[]}");
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogInformation("[LiveTranslation] Twitch respondió {Status} a {Path}", (int)res.StatusCode, path);
                if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized) _cache.Remove("lt-scopes:" + ownerUserId);
                return null;
            }
            return await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync());
        }

        private async Task<(bool Ok, DateTime? Value)> FollowedAtAsync(long owner, TwitchIdentity me, string viewerId)
        {
            try
            {
                using var doc = await HelixAsync(owner, me, "channels/followers", viewerId);
                if (doc == null) return (false, null);
                var data = doc.RootElement.GetProperty("data");
                if (data.GetArrayLength() == 0) return (true, null);
                return (true, data[0].TryGetProperty("followed_at", out var f) ? f.GetDateTime().ToUniversalTime() : null);
            }
            catch (Exception ex) when (ex is not OperationCanceledException) { _logger.LogDebug(ex, "[LiveTranslation] Fallo al consultar seguidores"); return (false, null); }
        }

        private async Task<(bool Ok, int Value)> SubTierAsync(long owner, TwitchIdentity me, string viewerId)
        {
            try
            {
                using var doc = await HelixAsync(owner, me, "subscriptions", viewerId, notFoundIsEmpty: true);
                if (doc == null) return (false, 0);
                var data = doc.RootElement.GetProperty("data");
                if (data.GetArrayLength() == 0) return (true, 0);
                var tier = data[0].TryGetProperty("tier", out var t) ? t.GetString() : "1000";
                return (true, tier switch { "3000" => 3, "2000" => 2, _ => 1 });
            }
            catch (Exception ex) when (ex is not OperationCanceledException) { _logger.LogDebug(ex, "[LiveTranslation] Fallo al consultar suscripciones"); return (false, 0); }
        }

        private async Task<(bool Ok, bool Value)> IsInListAsync(long owner, TwitchIdentity me, string path, string viewerId)
        {
            try
            {
                using var doc = await HelixAsync(owner, me, path, viewerId);
                if (doc == null) return (false, false);
                return (true, doc.RootElement.GetProperty("data").GetArrayLength() > 0);
            }
            catch (Exception ex) when (ex is not OperationCanceledException) { _logger.LogDebug(ex, "[LiveTranslation] Fallo al consultar {Path}", path); return (false, false); }
        }
    }
}
