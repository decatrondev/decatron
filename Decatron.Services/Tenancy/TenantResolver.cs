using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Resolutor único de tenant (Fase 2). Mantiene en memoria una copia de la tabla channels (decenas de filas) y la
/// refresca cada minuto, así que resolver no toca la base en cada request.
/// Mientras solo exista el tenant 1, todo lo conocido resuelve a 1 y lo desconocido cae a 1 con Resolved=false.
/// </summary>
public sealed class TenantResolver : ITenantResolver
{
    public const long DefaultTenantId = 1;
    private static readonly TimeSpan Refresh = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<TenantResolver> _log;
    private readonly object _gate = new();
    private Snapshot _snap = Snapshot.Empty;
    private DateTime _loadedAt = DateTime.MinValue;

    public TenantResolver(IServiceScopeFactory scopes, ILogger<TenantResolver> log)
    {
        _scopes = scopes;
        _log = log;
    }

    /// <summary>Fuerza la relectura de channels en la proxima resolucion (tras dar de alta un canal nuevo).</summary>
    public void InvalidateCache() => _loadedAt = DateTime.MinValue;

    public TenantResolution ByUserId(long userId)
        => _Get().ByUser.TryGetValue(userId, out var t)
            ? new(t, true, TenantSource.User)
            : new(DefaultTenantId, false, TenantSource.Default);

    public TenantResolution ByChannelKey(string? key)
    {
        if (string.IsNullOrWhiteSpace(key)) return new(DefaultTenantId, false, TenantSource.Default);
        key = key.Trim();
        // Los overlays v2 se unen con "v2:{clave}" (SoundAlertTriggerService.V2Key); el prefijo no es parte del login.
        if (key.StartsWith("v2:", StringComparison.OrdinalIgnoreCase)) key = key[3..];
        var s = _Get();
        // external_id (Twitch/Kick) y kick_{id}
        if (s.ByExternal.TryGetValue(key, out var t1)) return new(t1, true, TenantSource.Channel);
        if (key.StartsWith("kick_", StringComparison.OrdinalIgnoreCase) && s.ByExternal.TryGetValue(key[5..], out var t2))
            return new(t2, true, TenantSource.Channel);
        if (s.ByLogin.TryGetValue(key.ToLowerInvariant(), out var t3)) return new(t3, true, TenantSource.Channel);
        // users.id (numérico)
        if (long.TryParse(key, out var uid) && s.ByUser.TryGetValue(uid, out var t4)) return new(t4, true, TenantSource.Channel);
        return new(DefaultTenantId, false, TenantSource.Default);
    }

    public TenantResolution ByGuildId(string? guildId)
        => !string.IsNullOrWhiteSpace(guildId) && _Get().ByGuild.TryGetValue(guildId.Trim(), out var t)
            ? new(t, true, TenantSource.Guild)
            : new(DefaultTenantId, false, TenantSource.Default);

    /// <summary>Dominio de la plataforma: <c>slug.decatron.top</c> elige el tenant de ese slug.</summary>
    public const string PlatformDomain = "decatron.top";

    /// <summary>
    /// El slug de un Host del tipo <c>slug.decatron.top</c> (una sola etiqueta, minúsculas y a-z0-9-), o null para cualquier otro Host:
    /// el dominio raíz, <c>www</c>, otros dominios y subdominios anidados.
    /// </summary>
    public static string? SlugFromHost(string? host)
    {
        if (string.IsNullOrWhiteSpace(host)) return null;
        var h = host.Trim().TrimEnd('.').ToLowerInvariant();
        var suffix = "." + PlatformDomain;
        if (!h.EndsWith(suffix, StringComparison.Ordinal)) return null;
        var label = h[..^suffix.Length];
        if (label.Length is < 1 or > 63 || label == "www") return null;
        return label.All(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' or '-') && label[0] != '-' && label[^1] != '-' ? label : null;
    }

    public bool IsServedByOtherTenant(string? twitchId)
        => !string.IsNullOrEmpty(twitchId) && _Get().ServedElsewhere.Contains(twitchId);

    public TenantResolution ByHost(string? host)
    {
        var slug = SlugFromHost(host);
        return slug is not null && _Get().BySlug.TryGetValue(slug, out var t)
            ? new(t, true, TenantSource.Host)
            : new(DefaultTenantId, false, TenantSource.Default);
    }

    private Snapshot _Get()
    {
        if (DateTime.UtcNow - _loadedAt < Refresh) return _snap;
        lock (_gate)
        {
            if (DateTime.UtcNow - _loadedAt < Refresh) return _snap;
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var rows = db.PlatformChannels.AsNoTracking()
                    .Select(c => new { c.TenantId, c.UserId, c.ExternalId, c.Login, c.Platform }).ToList();

                // Un streamer puede tener cuenta (y canal) en el #1 y en el tenant de su proyecto. El bot que lo atiende es el del tenant ≠ 1
                // donde lo tenga activado; si no, el #1. Así la resolución por id o login es siempre la misma y no depende del orden de las filas.
                var served = ReadServedElsewhere(scope, rows.Where(r => r.TenantId != 1 && r.Platform == "twitch").Select(r => (r.TenantId, r.UserId, r.ExternalId)).ToList());
                var byUser = new Dictionary<long, long>();
                var byExt = new Dictionary<string, long>();
                var byLogin = new Dictionary<string, long>();
                foreach (var r in rows.OrderBy(r => r.TenantId))
                {
                    byUser[r.UserId] = r.TenantId;
                    // Con el mismo canal en dos tenants gana el que lo atiende (si hay uno) y, si no, el de menor id (el #1).
                    var wins = served.Contains(r.ExternalId) ? r.TenantId != 1 : !byExt.ContainsKey(r.ExternalId);
                    if (wins) byExt[r.ExternalId] = r.TenantId;
                    var login = r.Login.ToLowerInvariant();
                    if (served.Contains(r.ExternalId) ? r.TenantId != 1 : !byLogin.ContainsKey(login)) byLogin[login] = r.TenantId;
                }
                var byGuild = new Dictionary<string, long>();
                try
                {
                    // discord_guild_configs ya liga cada servidor con su canal y lleva tenant_id: es el mapa guild -> tenant.
                    foreach (var g in db.Database.SqlQueryRaw<GuildRow>(
                        "select guild_id as \"GuildId\", tenant_id as \"TenantId\" from discord_guild_configs").ToList())
                        byGuild[g.GuildId] = g.TenantId;
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "tenant.resolver_guilds_failed");
                }
                var bySlug = new Dictionary<string, long>();
                try
                {
                    // tenants no lleva RLS. Solo los activos y distintos del #1 (el #1 vive en decatron.net, no en un subdominio).
                    foreach (var r in db.Database.SqlQueryRaw<SlugRow>(
                        "select slug as \"Slug\", id as \"TenantId\" from tenants where status = 'active' and id <> 1").ToList())
                        bySlug[r.Slug.ToLowerInvariant()] = r.TenantId;
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "tenant.resolver_slugs_failed");
                }
                _snap = new Snapshot(byUser, byExt, byLogin, byGuild, bySlug, served);
            }
            catch (Exception ex)
            {
                // Si falla la lectura se conserva la copia anterior: la resolución nunca tumba un request.
                _log.LogWarning(ex, "tenant.resolver_refresh_failed");
            }
            _loadedAt = DateTime.UtcNow;
            return _snap;
        }
    }

    /// <summary>
    /// ids de Twitch de canales de tenants ≠ 1 cuyo streamer tiene el bot activado en ese tenant (system_settings lleva RLS: se lee dentro de cada tenant).
    /// Si algo falla devuelve vacío, es decir, el comportamiento de siempre.
    /// </summary>
    private HashSet<string> ReadServedElsewhere(IServiceScope scope, List<(long TenantId, long UserId, string ExternalId)> others)
    {
        var served = new HashSet<string>(StringComparer.Ordinal);
        try
        {
            var cs = scope.ServiceProvider.GetRequiredService<IConfiguration>()["ConnectionStrings:DefaultConnection"];
            foreach (var g in others.GroupBy(o => o.TenantId))
            {
                using var conn = TenantNpgsql.Create(cs, g.Key);
                conn.Open();
                using var cmd = new Npgsql.NpgsqlCommand("SELECT user_id FROM system_settings WHERE bot_enabled", conn);
                var enabled = new HashSet<long>();
                using (var rd = cmd.ExecuteReader()) while (rd.Read()) enabled.Add(rd.GetInt64(0));
                foreach (var o in g) if (enabled.Contains(o.UserId)) served.Add(o.ExternalId);
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "tenant.resolver_served_failed");
            served.Clear();
        }
        return served;
    }

    private sealed record Snapshot(
        Dictionary<long, long> ByUser, Dictionary<string, long> ByExternal, Dictionary<string, long> ByLogin,
        Dictionary<string, long> ByGuild, Dictionary<string, long> BySlug, HashSet<string> ServedElsewhere)
    {
        public static readonly Snapshot Empty = new(new(), new(), new(), new(), new(), new());
    }

    private sealed class SlugRow
    {
        public string Slug { get; set; } = "";
        public long TenantId { get; set; }
    }

    private sealed class GuildRow
    {
        public string GuildId { get; set; } = "";
        public long TenantId { get; set; }
    }
}

/// <summary>Tenant del request/tarea en curso (scoped).</summary>
public sealed class TenantContext : ITenantContext
{
    public long TenantId { get; private set; } = TenantResolver.DefaultTenantId;
    public bool IsResolved { get; private set; }
    public TenantSource Source { get; private set; } = TenantSource.Default;

    public void Set(TenantResolution r)
    {
        TenantId = r.TenantId;
        IsResolved = r.Resolved;
        Source = r.Source;
    }
}
