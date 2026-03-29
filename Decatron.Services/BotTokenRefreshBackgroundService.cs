using Decatron.Core.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class BotTokenRefreshBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<BotTokenRefreshBackgroundService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(30); // Check every 30 minutes

        public BotTokenRefreshBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<BotTokenRefreshBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Bot Token Refresh Background Service is starting");

            // Wait a bit before starting the first check
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("Bot Token Refresh Background Service is running token refresh check");

                    // Create a scope to resolve scoped services
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var refreshService = scope.ServiceProvider.GetRequiredService<IBotTokenRefreshService>();
                        await refreshService.RefreshExpiringTokensAsync();
                    }

                    _logger.LogInformation($"Next token refresh check in {_checkInterval.TotalMinutes} minutes");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while refreshing bot tokens");
                }

                // Wait for the next interval
                await Task.Delay(_checkInterval, stoppingToken);
            }

            _logger.LogInformation("Bot Token Refresh Background Service is stopping");
        }
    }
}
