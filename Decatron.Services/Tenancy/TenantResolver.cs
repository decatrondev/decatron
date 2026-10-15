using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

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

    public TenantResolution ByHost(string? host)
    {
        // Fase 8 traerá subdominios por tenant; hoy ningún Host elige un tenant distinto.
        return new(DefaultTenantId, false, TenantSource.Default);
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
                    .Select(c => new { c.TenantId, c.UserId, c.ExternalId, c.Login }).ToList();
                var byUser = new Dictionary<long, long>();
                var byExt = new Dictionary<string, long>();
                var byLogin = new Dictionary<string, long>();
                foreach (var r in rows)
                {
                    byUser[r.UserId] = r.TenantId;
                    byExt[r.ExternalId] = r.TenantId;
                    byLogin[r.Login.ToLowerInvariant()] = r.TenantId;
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
                _snap = new Snapshot(byUser, byExt, byLogin, byGuild);
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

    private sealed record Snapshot(
        Dictionary<long, long> ByUser, Dictionary<string, long> ByExternal, Dictionary<string, long> ByLogin,
        Dictionary<string, long> ByGuild)
    {
        public static readonly Snapshot Empty = new(new(), new(), new(), new());
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
