using Decatron.Core.Interfaces;
using Decatron.Data;
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
    /// Restaura el status de moderador cuando expira un timeout aplicado por !ruleta
    /// contra un mod (ver RuletaCommand). Persistente en BD en vez de un Task.Delay
    /// en memoria: si el backend reinicia dentro de la ventana del timeout, un delay
    /// en memoria se pierde y el mod se queda desmodeado para siempre.
    ///
    /// Idempotente: si el streamer ya lo re-modeó a mano antes de que expire, el
    /// AddModeratorAsync de acá simplemente no hace nada distinto (Twitch ya lo
    /// tiene como mod) — no hace falta distinguir el caso.
    /// </summary>
    public class RuletaBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<RuletaBackgroundService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromSeconds(10);

        public RuletaBackgroundService(IServiceScopeFactory serviceScopeFactory, ILogger<RuletaBackgroundService> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🔫 RuletaBackgroundService iniciado");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RestorePendingModsAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error en RuletaBackgroundService");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }

            _logger.LogInformation("🔫 RuletaBackgroundService detenido");
        }

        private async Task RestorePendingModsAsync()
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var twitchApiService = scope.ServiceProvider.GetRequiredService<TwitchApiService>();

            var now = DateTime.UtcNow;
            var pending = await db.RuletaModRestores
                .Where(r => !r.Processed && r.ExpiresAt <= now)
                .ToListAsync();

            foreach (var restore in pending)
            {
                try
                {
                    var restored = await twitchApiService.AddModeratorAsync(restore.ChannelLogin, restore.TargetUsername);
                    if (restored)
                    {
                        _logger.LogInformation("🔫 Mod restaurado: {Username} en {Channel}", restore.TargetUsername, restore.ChannelLogin);
                    }
                    else
                    {
                        _logger.LogWarning("🔫 No se pudo restaurar mod de {Username} en {Channel} — se reintentará", restore.TargetUsername, restore.ChannelLogin);
                        continue; // no marcar como procesado, se reintenta en el próximo ciclo
                    }

                    restore.Processed = true;
                    await db.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error restaurando mod para {Username} en {Channel}", restore.TargetUsername, restore.ChannelLogin);
                }
            }
        }
    }
}
