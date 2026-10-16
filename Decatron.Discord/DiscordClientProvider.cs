using DSharpPlus;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Decatron.Discord.Models;

namespace Decatron.Discord;

/// <summary>
/// Singleton provider for the DSharpPlus DiscordClient instance.
/// Plataforma (Fase 4, paso 6c): <see cref="Client"/> devuelve el cliente del tenant ambiente. El #1 (o sin tenant) recibe el de siempre;
/// otro tenant recibe SU cliente del registro y, si no lo tiene, falla cerrado (nunca el bot de Decatron).
/// </summary>
public class DiscordClientProvider
{
    private readonly DiscordClientRegistry? _registry;

    /// <summary>El cliente del tenant #1 (el bot de Decatron).</summary>
    public DiscordClient PrimaryClient { get; }

    public DiscordClient Client => (_registry ?? Empty).Resolve(PrimaryClient, t => new DiscordNotConfiguredException(t));

    /// <summary>Como <see cref="Client"/> pero devuelve null si el tenant ambiente no tiene bot de Discord (para tareas que recorren todos los tenants).</summary>
    public DiscordClient? TryGetClient()
    {
        try { return Client; }
        catch (DiscordNotConfiguredException) { return null; }
    }

    private static readonly DiscordClientRegistry Empty = new();

    /// <summary>
    /// Para los manejadores de eventos: fija el tenant ambiente al del cliente que disparó el evento (los eventos llegan en hilos del
    /// gateway, sin contexto). El cliente del #1 no cambia nada (null).
    /// </summary>
    public IDisposable? EnterTenantOf(DiscordClient sender)
        => (_registry ?? Empty).TenantOf(sender) is long t ? Decatron.Core.Interfaces.TenantAmbient.Push(t) : null;

    public DiscordClientRegistry? Registry => _registry;

    public DiscordClientProvider(IOptions<DiscordSettings> settings, ILoggerFactory loggerFactory, DiscordClientRegistry? registry = null)
    {
        _registry = registry;
        var config = new DiscordConfiguration
        {
            Token = settings.Value.BotToken,
            TokenType = TokenType.Bot,
            Intents = DiscordIntents.AllUnprivileged | DiscordIntents.GuildMembers | DiscordIntents.GuildMessages | DiscordIntents.MessageContents,
            LoggerFactory = loggerFactory,
            AutoReconnect = true
        };

        PrimaryClient = new DiscordClient(config);
    }
}
