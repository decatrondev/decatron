using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Moderation
{
    /// <summary>
    /// Apaga los pánicos vencidos (cada 15 s) y, al arrancar, recarga los que siguen activos.
    /// Como el estado está en la base, un reinicio en medio de un pánico no deja el chat trabado.
    /// </summary>
    public class PanicModeBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<PanicModeBackgroundService> _logger;

        public PanicModeBackgroundService(IServiceScopeFactory scopeFactory, ILogger<PanicModeBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                await scope.ServiceProvider.GetRequiredService<PanicModeService>().LoadActiveAsync();
            }
            catch (Exception ex) { _logger.LogError(ex, "[PÁNICO] No se pudieron cargar los pánicos activos"); }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var panic = scope.ServiceProvider.GetRequiredService<PanicModeService>();
                    foreach (var channel in await panic.GetExpiredAsync())
                        await panic.DeactivateAsync(channel, "decatron");
                }
                catch (Exception ex) { _logger.LogError(ex, "[PÁNICO] Error apagando pánicos vencidos"); }

                try { await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); }
                catch (TaskCanceledException) { }
            }
        }
    }
}
