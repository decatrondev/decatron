using DSharpPlus;
using DSharpPlus.Entities;
using DSharpPlus.SlashCommands;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using Decatron.Discord.Commands;

namespace Decatron.Discord;

/// <summary>
/// Background service that manages the Discord bot lifecycle.
/// Connects on startup, registers slash commands, sets presence.
/// </summary>
public class DiscordBotService : BackgroundService
{
    private readonly DiscordClientProvider _clientProvider;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DiscordBotService> _logger;

    public DiscordBotService(
        DiscordClientProvider clientProvider,
        IServiceProvider serviceProvider,
        ILogger<DiscordBotService> logger)
    {
        _clientProvider = clientProvider;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var client = _clientProvider.Client;

        try
        {
            var slash = client.UseSlashCommands(new SlashCommandsConfiguration
            {
                Services = _serviceProvider
            });

            slash.SlashCommandErrored += (s, e) =>
            {
                _logger.LogError(e.Exception, "Discord slash command error: {Command}", e.Context.CommandName);
                return Task.CompletedTask;
            };

            // Register globally (required for internal handler routing)
            slash.RegisterCommands<DecatronSlashCommands>();

            // Connect
            await client.ConnectAsync(new DiscordActivity("twitch.decatron.net", ActivityType.Watching));
            _logger.LogInformation("Discord bot conectado exitosamente");

            // Wait for guilds to populate
            await Task.Delay(3000, stoppingToken);

            // Register per-guild for instant visibility
            foreach (var guild in client.Guilds.Values)
            {
                try
                {
                    slash.RegisterCommands<DecatronSlashCommands>(guild.Id);
                    _logger.LogInformation("Slash commands registrados en {Guild} ({Id})", guild.Name, guild.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error registrando slash commands en {Guild}", guild.Name);
                }
            }

            // Keep alive
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (TaskCanceledException)
        {
            _logger.LogInformation("Discord bot deteniendo...");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en Discord bot");
        }
        finally
        {
            await client.DisconnectAsync();
            _logger.LogInformation("Discord bot desconectado");
        }
    }
}
