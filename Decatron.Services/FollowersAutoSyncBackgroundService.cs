using Decatron.Data;
using Decatron.Services.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>
    /// Red de seguridad de los seguidores: cada cierto tiempo compara, canal por canal, la lista real de Twitch con la guardada.
    /// El aviso de follow en vivo puede perderse (bot o conduit caídos) y Twitch no avisa los unfollows; esta tarea recupera
    /// los follows que sigan vigentes y detecta los unfollows dentro de la ventana del intervalo (antes dependía de que alguien
    /// tuviera abierta la pantalla). Solo toca canales que ya tienen seguidores guardados. La regla de FollowersSyncPlanner
    /// evita marcar unfollows con una lista de Twitch dudosa.
    /// Nunca hace importaciones grandes (más de 500 seguidores nuevos de golpe): esas se hacen a mano con el botón.
    /// Config: Followers:AutoSyncEnabled (true), Followers:AutoSyncMinutes (60, mínimo 15).
    /// </summary>
    public class FollowersAutoSyncBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly TenantTaskRunner _tenants;
        private readonly IConfiguration _config;
        private readonly ILogger<FollowersAutoSyncBackgroundService> _logger;

        public FollowersAutoSyncBackgroundService(
            IServiceScopeFactory scopeFactory,
            TenantTaskRunner tenants,
            IConfiguration config,
            ILogger<FollowersAutoSyncBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _tenants = tenants;
            _config = config;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_config.GetValue("Followers:AutoSyncEnabled", true))
            {
                _logger.LogInformation("👥 FollowersAutoSync apagado por configuración");
                return;
            }

            var minutes = Math.Max(15, _config.GetValue("Followers:AutoSyncMinutes", 60));
            _logger.LogInformation("👥 FollowersAutoSync iniciado (cada {Minutes} min)", minutes);

            // Deja que el bot termine de arrancar (tokens, conduit) antes del primer barrido
            try { await Task.Delay(TimeSpan.FromMinutes(3), stoppingToken); } catch (OperationCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await _tenants.ForEachTenantAsync("followers-autosync", async _ => await SweepTenantAsync(stoppingToken), stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError(ex, "Error en FollowersAutoSyncBackgroundService");
                }

                try { await Task.Delay(TimeSpan.FromMinutes(minutes), stoppingToken); } catch (OperationCanceledException) { break; }
            }
        }

        private async Task SweepTenantAsync(CancellationToken ct)
        {
            List<string> channels;
            using (var scope = _scopeFactory.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                // Canales activos con Twitch que ya tienen seguidores guardados
                var withRows = await db.ChannelFollowers.Where(f => f.Platform == Decatron.Core.Helpers.FollowerPlatforms.Twitch).Select(f => f.BroadcasterId).Distinct().ToListAsync(ct);
                channels = await db.Users
                    .Where(u => u.IsActive && u.TwitchId != null && withRows.Contains(u.TwitchId))
                    .Select(u => u.TwitchId!)
                    .ToListAsync(ct);
            }

            int ok = 0, failed = 0, changed = 0;
            foreach (var broadcasterId in channels)
            {
                if (ct.IsCancellationRequested) return;
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var sync = scope.ServiceProvider.GetRequiredService<FollowersSyncService>();
                    var r = await sync.SyncAsync(broadcasterId, maxNewFollowers: 500, source: "auto");
                    if (r.Success) { ok++; changed += r.NewFollowers + r.Returned + r.Unfollowed + r.Renamed; }
                    else failed++;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    failed++;
                    _logger.LogWarning(ex, "FollowersAutoSync: falló el canal {Broadcaster}", broadcasterId);
                }

                // Sin ráfagas contra Twitch
                try { await Task.Delay(TimeSpan.FromSeconds(2), ct); } catch (OperationCanceledException) { return; }
            }

            _logger.LogInformation("👥 FollowersAutoSync: {Ok} canales sincronizados, {Failed} sin poder leer a Twitch, {Changed} cambios", ok, failed, changed);
        }
    }
}
