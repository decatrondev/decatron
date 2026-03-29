using Decatron.Core.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class UserTokenRefreshBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<UserTokenRefreshBackgroundService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(30); // Check every 30 minutes

        public UserTokenRefreshBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<UserTokenRefreshBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("User Token Refresh Background Service is starting");

            // Wait a bit before starting the first check
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("User Token Refresh Background Service is running token refresh check");

                    // Create a scope to resolve scoped services
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var refreshService = scope.ServiceProvider.GetRequiredService<IUserTokenRefreshService>();
                        await refreshService.RefreshExpiringTokensAsync();
                    }

                    _logger.LogInformation($"Next user token refresh check in {_checkInterval.TotalMinutes} minutes");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while refreshing user tokens");
                }

                // Wait for the next interval
                await Task.Delay(_checkInterval, stoppingToken);
            }

            _logger.LogInformation("User Token Refresh Background Service is stopping");
        }
    }
}
