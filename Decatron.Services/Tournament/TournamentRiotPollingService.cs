using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tournament
{
    /// <summary>
    /// Poller minimo de Milestone 0 — Recorre los canales con Riot API key activa y
    /// sus ediciones "in_progress". Modo solo_q_climb delega en TournamentRiotSyncService
    /// (trackeo de LP), modo aram_teams delega en TournamentWinConditionSyncService
    /// (deteccion de condicion de victoria, agregado 24-08-2026 — Tema 2). Ambos son
    /// el mismo codigo que usa el boton "Resincronizar ahora" del panel, para no
    /// tener implementaciones paralelas que se desincronizan.
    ///
    /// Simplificacion deliberada de Milestone 0 vs. el diseno completo de
    /// .dev/torneos/03-riot-api-integracion.md: un solo intervalo fijo para todos los
    /// tenants, sin scheduler que reparta el rate limit por KeyType/cantidad de
    /// participantes todavia (fase 3 seccion 3) — valido mientras haya pocos tenants
    /// de prueba, hay que revisar antes de abrir el modulo a mas de un puñado de
    /// canales reales en simultaneo.
    /// </summary>
    public class TournamentRiotPollingService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<TournamentRiotPollingService> _logger;
        private readonly TimeSpan _pollInterval = TimeSpan.FromMinutes(3);

        public TournamentRiotPollingService(IServiceProvider serviceProvider, ILogger<TournamentRiotPollingService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🏆 TournamentRiotPollingService iniciado (solo_q_climb + condicion de victoria ARAM)");

            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await PollOnceAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error en el ciclo de polling de Riot API para torneos");
                }

                await Task.Delay(_pollInterval, stoppingToken);
            }
        }

        private async Task PollOnceAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var syncService = scope.ServiceProvider.GetRequiredService<TournamentRiotSyncService>();
            var winConditionSyncService = scope.ServiceProvider.GetRequiredService<TournamentWinConditionSyncService>();

            var activeConfigs = await db.TournamentRiotConfigs
                .Where(c => c.IsActive)
                .ToListAsync(stoppingToken);

            foreach (var config in activeConfigs)
            {
                var editions = await db.TournamentEditions
                    .Where(e => e.ChannelOwnerId == config.ChannelOwnerId && e.Status == "in_progress")
                    .ToListAsync(stoppingToken);

                foreach (var edition in editions)
                {
                    if (edition.Mode == "solo_q_climb")
                        await syncService.SyncEditionAsync(db, config, edition, stoppingToken);
                    else if (edition.Mode == "aram_teams")
                        await winConditionSyncService.SyncEditionAsync(db, config, edition, stoppingToken);
                }
            }
        }
    }
}
