using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>
    /// Vigila el estado de Happy Hour de cada canal y avisa al overlay cuando cambia.
    ///
    /// El overlay siempre escuchó "HappyHourStarted" y "HappyHourEnded", pero nadie los
    /// emitía: el indicador aparecía y desaparecía recién con el resync periódico de 30s.
    /// Esto cubre los tres casos que ese resync tardaba en notar:
    ///   - el Happy Hour programado que entra en su franja horaria,
    ///   - el programado que sale de la franja,
    ///   - el manual que se vence solo (activar y desactivar a mano ya avisan directo
    ///     desde el endpoint, sin esperar a este ciclo).
    /// </summary>
    public class HappyHourWatcherService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<HappyHourWatcherService> _logger;

        private const int CHECK_INTERVAL_SECONDS = 10;

        // Último estado conocido por canal, para emitir solo en los cambios y no en cada vuelta.
        private readonly Dictionary<string, bool> _lastKnownActive = new();

        public HappyHourWatcherService(
            IServiceProvider serviceProvider,
            ILogger<HappyHourWatcherService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🔥 HappyHourWatcherService iniciado");

            // Dar tiempo a que el resto del arranque termine.
            await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckTransitionsAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Error en HappyHourWatcherService");
                }

                await Task.Delay(TimeSpan.FromSeconds(CHECK_INTERVAL_SECONDS), stoppingToken);
            }
        }

        private async Task CheckTransitionsAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var timerEventService = scope.ServiceProvider.GetRequiredService<TimerEventService>();
            var overlayService = scope.ServiceProvider.GetRequiredService<OverlayNotificationService>();

            var channels = await GetCandidateChannelsAsync(dbContext);

            foreach (var channel in channels)
            {
                try
                {
                    var info = await timerEventService.GetActiveHappyHourInfoAsync(channel);
                    var wasActive = _lastKnownActive.TryGetValue(channel, out var prev) && prev;

                    if (info.Active == wasActive) continue;

                    if (info.Active)
                        await overlayService.SendHappyHourStartedAsync(channel, info.Multiplier, info.EndsAt);
                    else
                        await overlayService.SendHappyHourEndedAsync(channel);

                    _lastKnownActive[channel] = info.Active;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error revisando Happy Hour de {channel}");
                }
            }
        }

        /// <summary>
        /// Canales que vale la pena revisar: los que tienen un Happy Hour manual guardado,
        /// los que tienen alguno programado y habilitado, y los que este servicio dejó
        /// marcados como activos (para poder emitir el fin aunque ya no tengan config).
        /// </summary>
        private async Task<HashSet<string>> GetCandidateChannelsAsync(DecatronDbContext dbContext)
        {
            var channels = new HashSet<string>(_lastKnownActive.Where(kv => kv.Value).Select(kv => kv.Key));

            var manualChannels = await dbContext.TimerManualHappyHours
                .Select(m => m.ChannelName)
                .ToListAsync();
            foreach (var c in manualChannels) channels.Add(c);

            var scheduledChannels = await dbContext.TimerHappyHours
                .Where(hh => hh.Enabled)
                .Join(dbContext.Users, hh => hh.UserId, u => u.Id, (hh, u) => u.Login)
                .Distinct()
                .ToListAsync();
            foreach (var c in scheduledChannels)
                if (!string.IsNullOrEmpty(c)) channels.Add(c.ToLower());

            return channels;
        }
    }
}
