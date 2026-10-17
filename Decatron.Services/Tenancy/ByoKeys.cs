using System.Collections.Concurrent;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Fase 5.8: puerta única a las llaves de terceros. #1 = appsettings (como siempre, sin tocar la base); otro tenant = su propia llave del almacén
/// con caché (5 min; 30 s si no hay) y solo si su plan admite el proveedor. Falla cerrado: sin llave, <c>null</c>.
/// </summary>
public sealed class ByoKeys : IByoKeys
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5), NegativeTtl = TimeSpan.FromSeconds(30);
    private readonly IConfiguration _cfg;
    private readonly ITenantByoStore? _store;
    private readonly IEntitlements? _entitlements;
    private readonly ILogger<ByoKeys>? _log;
    private readonly ConcurrentDictionary<(long, string), (DateTime Expires, ByoKey? Key)> _cache = new();

    public ByoKeys(IConfiguration cfg, ITenantByoStore? store = null, IEntitlements? entitlements = null, ILogger<ByoKeys>? log = null)
    { _cfg = cfg; _store = store; _entitlements = entitlements; _log = log; }

    /// <summary>Llave del #1 en appsettings (la misma que leían los servicios en su constructor).</summary>
    private ByoKey? Legacy(string provider)
    {
        var key = provider switch
        {
            ByoProviders.Ai => _cfg["OpenRouterSettings:ApiKey"],
            ByoProviders.Deepgram => _cfg["Deepgram:ApiKey"],
            ByoProviders.FishAudio => _cfg["FishAudio:ApiKey"],
            _ => null,
        };
        return string.IsNullOrWhiteSpace(key) ? null : new ByoKey(key, new Dictionary<string, string>());
    }

    public async Task<ByoKey?> GetAsync(string provider, long? tenantId = null, CancellationToken ct = default)
    {
        var tenant = tenantId ?? TenantAmbient.Current ?? 1;
        if (tenant == 1) return Legacy(provider);
        if (!ByoProviders.IsKnown(provider) || _store is null) return null;

        if (_cache.TryGetValue((tenant, provider), out var hit) && hit.Expires > DateTime.UtcNow) return hit.Key;

        ByoKey? key = null;
        try
        {
            var allowed = false;
            if (_entitlements is null) allowed = true;
            else foreach (var cap in ByoProviders.Capabilities(provider))
                if (await _entitlements.HasAsync(cap, tenant, live: false, ct)) { allowed = true; break; }
            if (allowed) key = await _store.GetAsync(tenant, provider, "runtime", ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _log?.LogWarning("byo.key.failed tenant={Tenant} provider={Provider} {Type}", tenant, provider, ex.GetType().Name);
            return null; // falla cerrado y no se cachea el error
        }
        _cache[(tenant, provider)] = (DateTime.UtcNow + (key is null ? NegativeTtl : Ttl), key);
        return key;
    }

    public void Invalidate(long tenantId)
    {
        foreach (var k in _cache.Keys.Where(k => k.Item1 == tenantId).ToList()) _cache.TryRemove(k, out _);
    }
}
