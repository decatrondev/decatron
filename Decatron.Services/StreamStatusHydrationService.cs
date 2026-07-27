using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Decatron.Services
{
    /// <summary>
    /// Hidrata el estado "en vivo" de los canales al arrancar el proceso.
    /// IStreamStatusService guarda el estado solo en memoria y se actualiza vía webhooks
    /// (stream.online/stream.offline) — al reiniciar el bot, ese estado se pierde para
    /// cualquier canal que ya estuviera en vivo, hasta que llegue un nuevo evento.
    /// Este servicio corre una sola vez al inicio y consulta a Twitch el estado real.
    /// </summary>
    public class StreamStatusHydrationService : BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<StreamStatusHydrationService> _logger;

        public StreamStatusHydrationService(
            IServiceScopeFactory serviceScopeFactory,
            ILogger<StreamStatusHydrationService> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Esperar a que el bot termine de unirse a los canales
            await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);

            try
            {
                await HydrateAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error hidratando estado de streams en vivo");
            }
        }

        private async Task HydrateAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var botService = scope.ServiceProvider.GetRequiredService<TwitchBotService>();
            var db = scope.ServiceProvider.GetRequiredService<Decatron.Data.DecatronDbContext>();
            var twitchApiService = scope.ServiceProvider.GetRequiredService<TwitchApiService>();
            var streamStatusService = scope.ServiceProvider.GetRequiredService<IStreamStatusService>();

            var connectedChannels = botService.GetConnectedChannels();
            if (connectedChannels.Count == 0)
            {
                _logger.LogInformation("🔄 [StreamStatusHydration] Sin canales conectados aún, nada que hidratar");
                return;
            }

            var channelInfos = await db.Users
                .AsNoTracking()
                .Where(u => connectedChannels.Contains(u.Login))
                .Select(u => new { u.Login, u.TwitchId })
                .ToListAsync(stoppingToken);

            var liveCount = 0;
            foreach (var channel in channelInfos)
            {
                if (stoppingToken.IsCancellationRequested) break;
                if (string.IsNullOrEmpty(channel.TwitchId)) continue;

                try
                {
                    var stream = await twitchApiService.GetStreamAsync(channel.TwitchId);
                    if (stream != null)
                    {
                        await streamStatusService.SetStreamOnlineAsync(channel.TwitchId, channel.Login);
                        liveCount++;
                        _logger.LogInformation("🔄 [StreamStatusHydration] {Channel} → EN VIVO", channel.Login);
                    }
                    else
                    {
                        _logger.LogInformation("🔄 [StreamStatusHydration] {Channel} → offline", channel.Login);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error consultando estado de stream para {Channel}", channel.Login);
                }

                // Pequeño delay entre llamadas para no golpear el rate limit de Twitch
                await Task.Delay(TimeSpan.FromMilliseconds(200), stoppingToken);
            }

            _logger.LogInformation("🔄 [StreamStatusHydration] {Live}/{Total} canales en vivo hidratados", liveCount, channelInfos.Count);
        }
    }
}
