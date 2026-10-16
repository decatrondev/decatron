using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Decatron.Discord.Events;

namespace Decatron.Discord;

/// <summary>
/// Background service that periodically updates active live alert messages
/// with fresh viewer counts, thumbnails, and game info.
/// Runs every 1 minute, but each alert respects its own update_interval_minutes.
/// </summary>
public class DiscordAlertPollingService : BackgroundService
{
    private readonly LiveAlertHandler _alertHandler;
    private readonly ILogger<DiscordAlertPollingService> _logger;
    private static readonly TimeSpan PollingInterval = TimeSpan.FromMinutes(1);

    private readonly Decatron.Services.Tenancy.TenantTaskRunner _tenants;

    public DiscordAlertPollingService(LiveAlertHandler alertHandler, ILogger<DiscordAlertPollingService> logger, Decatron.Services.Tenancy.TenantTaskRunner tenants)
    {
        _tenants = tenants;
        _alertHandler = alertHandler;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait for bot to connect
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        _logger.LogInformation("Discord alert polling service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _tenants.ForEachTenantAsync("discord-alerts", _ => _alertHandler.UpdateActiveAlerts(), stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in alert polling cycle");
            }

            await Task.Delay(PollingInterval, stoppingToken);
        }
    }
}
