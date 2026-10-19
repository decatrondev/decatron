namespace Decatron.Core.Interfaces;

/// <summary>De dónde salió el tenant de una resolución.</summary>
public enum TenantSource
{
    /// <summary>No se pudo resolver; se usa el tenant por defecto (1) y queda registrado en modo sombra.</summary>
    Default = 0,
    User,
    Channel,
    Host,
    OverlayToken,
    Guild,
    Background
}

/// <summary>Resultado de resolver un tenant. <see cref="Resolved"/> es false cuando se cayó al tenant por defecto.</summary>
public readonly record struct TenantResolution(long TenantId, bool Resolved, TenantSource Source);

/// <summary>
/// Tenant del request, evento o tarea en curso (scoped). Mientras exista el DEFAULT 1 de la Fase 1 siempre vale 1;
/// hoy solo se calcula y se registra (modo sombra, Fase 2): ningún filtro lo usa todavía.
/// </summary>
public interface ITenantContext
{
    long TenantId { get; }
    bool IsResolved { get; }
    TenantSource Source { get; }
    void Set(TenantResolution resolution);
}

/// <summary>
/// Único lugar donde se decide el tenant. Acepta las claves de canal mixtas del código actual:
/// users.id, id de Twitch (texto), kick_{id} / id de Kick, y login.
/// </summary>
public interface ITenantResolver
{
    TenantResolution ByUserId(long userId);

    /// <summary>users.id, id de Twitch, id de Kick, kick_{id} o login (sin distinguir mayúsculas).</summary>
    TenantResolution ByChannelKey(string? key);

    /// <summary>Servidor de Discord (guild_id), según discord_guild_configs.</summary>
    TenantResolution ByGuildId(string? guildId);

    /// <summary>Host del request (decatron.top y subdominios llegarán en la Fase 8).</summary>
    TenantResolution ByHost(string? host);

    /// <summary>
    /// El canal de Twitch con ese id lo atiende el bot de OTRO tenant (distinto del #1) porque su streamer lo tiene activado allí.
    /// El #1 lo usa para no suscribirlo ni procesar sus eventos y así no responder dos veces (su cuenta puede existir en los dos tenants).
    /// Ante cualquier fallo al leer devuelve false: el #1 sigue como siempre.
    /// </summary>
    bool IsServedByOtherTenant(string? twitchId);

    /// <summary>Subdominio (slug.decatron.top) de un tenant activo distinto del #1; null para el #1 o si no existe.</summary>
    string? SlugOf(long tenantId);
}
