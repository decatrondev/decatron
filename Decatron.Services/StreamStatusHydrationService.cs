using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
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
    ///
    /// Con ~40 canales el bot tarda varios minutos en terminar de unirse a todos
    /// (cada uno hace su propia ronda de setup de EventSub espaciada, se ve en el
    /// log). Antes esto corria una sola vez a los 20s y, si todavia no habia
    /// canales conectados, se rendia para siempre — cualquiera que ya estuviera
    /// en vivo antes del reinicio quedaba invisible hasta que cortara y prendiera
    /// de nuevo. Ahora hace pasadas repetidas mientras se van conectando, hasta
    /// que estan todos o se cumple el tiempo maximo.
    /// </summary>
    public class StreamStatusHydrationService : BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<StreamStatusHydrationService> _logger;
        private static readonly TimeSpan MaxWait = TimeSpan.FromMinutes(20);
        private static readonly TimeSpan PassInterval = TimeSpan.FromSeconds(30);

        public StreamStatusHydrationService(
            IServiceScopeFactory serviceScopeFactory,
            ILogger<StreamStatusHydrationService> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

            var alreadyChecked = new HashSet<string>();
            var deadline = DateTime.UtcNow.Add(MaxWait);

            try
            {
                int totalRegistered;
                using (var scope = _serviceScopeFactory.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<Decatron.Data.DecatronDbContext>();
                    totalRegistered = await db.Users.CountAsync(u => u.TwitchId != null, stoppingToken);
                }

                while (DateTime.UtcNow < deadline && !stoppingToken.IsCancellationRequested)
                {
                    var checkedNow = await HydratePassAsync(alreadyChecked, stoppingToken);
                    if (checkedNow == 0 && alreadyChecked.Count >= totalRegistered)
                        break; // ya se paso por todos los canales registrados, no hay mas nada que hacer

                    await Task.Delay(PassInterval, stoppingToken);
                }

                _logger.LogInformation("🔄 [StreamStatusHydration] Terminado — {Checked}/{Total} canales revisados",
                    alreadyChecked.Count, totalRegistered);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error hidratando estado de streams en vivo");
            }
        }

        /// <summary>Revisa los canales conectados que todavia no se chequearon. Devuelve cuantos chequeo en esta pasada.</summary>
        private async Task<int> HydratePassAsync(HashSet<string> alreadyChecked, CancellationToken stoppingToken)
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var botService = scope.ServiceProvider.GetRequiredService<TwitchBotService>();
            var db = scope.ServiceProvider.GetRequiredService<Decatron.Data.DecatronDbContext>();
            var twitchApiService = scope.ServiceProvider.GetRequiredService<TwitchApiService>();
            var streamStatusService = scope.ServiceProvider.GetRequiredService<IStreamStatusService>();

            var pending = botService.GetConnectedChannels()
                .Where(c => !alreadyChecked.Contains(c))
                .ToList();

            if (pending.Count == 0)
                return 0;

            var channelInfos = await db.Users
                .AsNoTracking()
                .Where(u => pending.Contains(u.Login))
                .Select(u => new { u.Login, u.TwitchId })
                .ToListAsync(stoppingToken);

            var liveCount = 0;
            foreach (var channel in channelInfos)
            {
                if (stoppingToken.IsCancellationRequested) break;
                alreadyChecked.Add(channel.Login);
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
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error consultando estado de stream para {Channel}", channel.Login);
                    alreadyChecked.Remove(channel.Login); // reintentar en la proxima pasada
                }

                // Pequeño delay entre llamadas para no golpear el rate limit de Twitch
                await Task.Delay(TimeSpan.FromMilliseconds(200), stoppingToken);
            }

            _logger.LogInformation("🔄 [StreamStatusHydration] Pasada: {Live}/{Checked} en vivo ({Total} acumulado)",
                liveCount, channelInfos.Count, alreadyChecked.Count);
            return channelInfos.Count;
        }
    }
}
