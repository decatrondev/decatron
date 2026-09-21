using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Decatron.Services
{
    /// <summary>
    /// Barrido periodico de avisos de Fortnite Spirits (Twitch chat + Discord DM).
    /// El aviso de Twitch tambien se dispara al toque con stream.online, pero
    /// eso solo cubre a quien PRENDE stream despues de que salio lo nuevo — si
    /// ya estaba en vivo de antes, ese evento no vuelve a pasar hasta que corte
    /// y prenda de nuevo. Este barrido tapa ese caso: a cualquiera con el aviso
    /// prendido que este en vivo AHORA, con algo pendiente, se lo manda, sin
    /// importar cuando arranco el stream. Discord no tiene evento del que
    /// colgarse, asi que para eso este barrido es la unica via.
    /// </summary>
    public class SpiritNotifySweepBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<SpiritNotifySweepBackgroundService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(15);

        public SpiritNotifySweepBackgroundService(
            IServiceScopeFactory serviceScopeFactory,
            ILogger<SpiritNotifySweepBackgroundService> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🎃 SpiritNotifySweepBackgroundService iniciado");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceScopeFactory.CreateScope();
                    var delivery = scope.ServiceProvider.GetRequiredService<ISpiritNotificationDeliveryService>();
                    await delivery.RunTwitchSweepAsync();
                    await delivery.RunDiscordSweepAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error en SpiritNotifySweepBackgroundService");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }

            _logger.LogInformation("🎃 SpiritNotifySweepBackgroundService detenido");
        }
    }
}
