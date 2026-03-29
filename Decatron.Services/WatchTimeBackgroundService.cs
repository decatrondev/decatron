using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Decatron.Services
{
    /// <summary>
    /// Background service que actualiza los watch times cada minuto
    /// Marca como inactivos a usuarios que no se han visto en 5 minutos
    /// </summary>
    public class WatchTimeBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<WatchTimeBackgroundService> _logger;
        private const int UPDATE_INTERVAL_SECONDS = 60; // Actualizar cada minuto

        public WatchTimeBackgroundService(
            IServiceScopeFactory serviceScopeFactory,
            ILogger<WatchTimeBackgroundService> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("⏱️ WatchTimeBackgroundService iniciado");

            // Esperar 30 segundos antes de empezar
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await UpdateWatchTimes();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error en WatchTimeBackgroundService");
                }

                await Task.Delay(TimeSpan.FromSeconds(UPDATE_INTERVAL_SECONDS), stoppingToken);
            }

            _logger.LogInformation("⏱️ WatchTimeBackgroundService detenido");
        }

        private async Task UpdateWatchTimes()
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var watchTimeService = scope.ServiceProvider.GetRequiredService<IWatchTimeTrackingService>();

            await watchTimeService.UpdateWatchTimes();
        }
    }
}
