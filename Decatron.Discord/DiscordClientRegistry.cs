using Decatron.Core.Interfaces;
using DSharpPlus;

namespace Decatron.Discord;

/// <summary>El tenant pidió un cliente de Discord y no tiene bot propio conectado. Nunca se usa el del tenant #1.</summary>
public sealed class DiscordNotConfiguredException : InvalidOperationException
{
    public long TenantId { get; }
    public DiscordNotConfiguredException(long tenantId) : base($"El tenant {tenantId} no tiene un bot de Discord conectado.") => TenantId = tenantId;
}

/// <summary>Clientes de Discord (gateway) de los tenants distintos del #1. El #1 sigue siendo <see cref="DiscordClientProvider.PrimaryClient"/>.</summary>
public sealed class DiscordClientRegistry : TenantClientRegistry<DiscordClient> { }
