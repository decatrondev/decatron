using System.Collections.Concurrent;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Despacha por tenant: el #1 lee de appsettings (legacy, como siempre); los demas leen del almacen (tenant_credentials) y, si no tienen
/// app cargada y validada, fallan cerrado. Nunca se cae a las credenciales del #1.
/// El almacen es asincrono y esta interfaz no: se cachea por tenant (5 min; 30 s si no hay credenciales) y la carga en frio bloquea una vez.
/// </summary>
public sealed class CredentialProvider : ICredentialProvider
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5), NegativeTtl = TimeSpan.FromSeconds(30);
    private readonly IConfiguration _cfg;
    private readonly ITenantCredentialStore? _store;
    private readonly ConcurrentDictionary<long, (TwitchAppCredentials? App, DateTime Expires)> _cache = new();
    private readonly ConcurrentDictionary<long, (string? Name, DateTime Expires)> _botCache = new();

    public CredentialProvider(IConfiguration cfg, ITenantCredentialStore? store = null) { _cfg = cfg; _store = store; }

    private long Tenant => TenantAmbient.Current ?? 1;

    public TwitchAppCredentials GetTwitchApp()
    {
        var tenant = Tenant;
        if (tenant == 1) return LegacyApp();
        if (_store is null) throw new CredentialsNotConfiguredException(tenant, "la app de Twitch");

        if (!_cache.TryGetValue(tenant, out var hit) || hit.Expires < DateTime.UtcNow)
        {
            var app = _store.GetTwitchAppAsync(tenant).GetAwaiter().GetResult();
            // Los permisos que pide la plataforma son del sistema, no secretos del tenant: sin los suyos propios se usan los del sistema.
            if (app is not null && string.IsNullOrWhiteSpace(app.Scopes)) app = app with { Scopes = _cfg["TwitchSettings:Scopes"] };
            hit = (app, DateTime.UtcNow + (app is null ? NegativeTtl : Ttl));
            _cache[tenant] = hit;
        }
        return hit.App ?? throw new CredentialsNotConfiguredException(tenant, "la app de Twitch");
    }

    private TwitchAppCredentials LegacyApp() => new(
        _cfg["TwitchSettings:ClientId"] ?? "",
        _cfg["TwitchSettings:ClientSecret"],
        _cfg["TwitchSettings:RedirectUri"],
        _cfg["TwitchSettings:WebhookSecret"],
        _cfg["TwitchSettings:WebhookCallbackUrl"],
        _cfg["TwitchSettings:Scopes"]);

    public string? GetTwitchBotUsername()
    {
        var tenant = Tenant;
        if (tenant == 1) return _cfg["TwitchSettings:BotUsername"];
        // Otro tenant: el nombre de SU cuenta de bot (autorizada por OAuth), o falla cerrado. Nunca el bot de Decatron.
        if (_store is null) throw new CredentialsNotConfiguredException(tenant, "la cuenta de bot de Twitch");
        if (!_botCache.TryGetValue(tenant, out var hit) || hit.Expires < DateTime.UtcNow)
        {
            var bot = _store.GetTwitchBotAsync(tenant).GetAwaiter().GetResult();
            hit = (bot?.Username, DateTime.UtcNow + (bot is null ? NegativeTtl : Ttl));
            _botCache[tenant] = hit;
        }
        return hit.Name ?? throw new CredentialsNotConfiguredException(tenant, "la cuenta de bot de Twitch");
    }

    public void Invalidate(long tenantId) { _cache.TryRemove(tenantId, out _); _botCache.TryRemove(tenantId, out _); }
}
