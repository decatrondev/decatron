using DSharpPlus;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Decatron.Discord.Models;

namespace Decatron.Discord;

/// <summary>
/// Singleton provider for the DSharpPlus DiscordClient instance.
/// </summary>
public class DiscordClientProvider
{
    public DiscordClient Client { get; }

    public DiscordClientProvider(IOptions<DiscordSettings> settings, ILoggerFactory loggerFactory)
    {
        var config = new DiscordConfiguration
        {
            Token = settings.Value.BotToken,
            TokenType = TokenType.Bot,
            Intents = DiscordIntents.AllUnprivileged | DiscordIntents.GuildMembers | DiscordIntents.GuildMessages | DiscordIntents.MessageContents,
            LoggerFactory = loggerFactory,
            AutoReconnect = true
        };

        Client = new DiscordClient(config);
    }
}
