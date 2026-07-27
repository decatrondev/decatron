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
    /// Background service que trackea "lurkers" (viewers conectados al chat que no escriben)
    /// vía polling del endpoint /chat/chatters de Twitch, para los canales que tengan
    /// "Contar Lurkers" activado en su configuración de !watchtime.
    /// </summary>
    public class WatchtimeLurkerTrackingService : BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<WatchtimeLurkerTrackingService> _logger;
        private const int POLL_INTERVAL_SECONDS = 90; // Respeta rate limits de Twitch

        public WatchtimeLurkerTrackingService(
            IServiceScopeFactory serviceScopeFactory,
            ILogger<WatchtimeLurkerTrackingService> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("👀 WatchtimeLurkerTrackingService iniciado");

            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await PollLurkersAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error en WatchtimeLurkerTrackingService");
                }

                await Task.Delay(TimeSpan.FromSeconds(POLL_INTERVAL_SECONDS), stoppingToken);
            }

            _logger.LogInformation("👀 WatchtimeLurkerTrackingService detenido");
        }

        private async Task PollLurkersAsync()
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<Decatron.Data.DecatronDbContext>();
            var streamStatusService = scope.ServiceProvider.GetRequiredService<IStreamStatusService>();
            var twitchApiService = scope.ServiceProvider.GetRequiredService<TwitchApiService>();
            var watchTimeService = scope.ServiceProvider.GetRequiredService<IWatchTimeTrackingService>();

            // Canales con "Contar Lurkers" activo
            var channels = await db.WatchtimeCommandConfigs
                .AsNoTracking()
                .Where(c => c.Enabled && c.TrackLurkers)
                .Join(db.Users.AsNoTracking(), c => c.UserId, u => u.Id, (c, u) => new { u.TwitchId, u.Login })
                .ToListAsync();

            foreach (var channel in channels)
            {
                if (string.IsNullOrEmpty(channel.Login) || string.IsNullOrEmpty(channel.TwitchId))
                    continue;

                if (!streamStatusService.IsLive(channel.TwitchId))
                    continue;

                try
                {
                    var chatters = await twitchApiService.GetChattersWithIdsAsync(channel.Login);
                    foreach (var chatter in chatters)
                    {
                        if (string.IsNullOrEmpty(chatter.user_id)) continue;
                        await watchTimeService.TrackUserPresence(channel.TwitchId, chatter.user_id, chatter.user_login);
                    }

                    if (chatters.Count > 0)
                    {
                        _logger.LogDebug("👀 [Lurkers] {Channel}: {Count} chatters trackeados", channel.Login, chatters.Count);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error trackeando lurkers para canal {Channel}", channel.Login);
                }
            }
        }
    }
}
