using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.ClipCommand
{
    /// <summary>
    /// Borra del historial de !clip lo que pasó los días de retención de cada canal (<c>history_retention_days</c>;
    /// vacío = se conserva siempre). Solo toca filas: los videos descargados no se borran aquí.
    /// </summary>
    public class ClipHistoryCleanupService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<ClipHistoryCleanupService> _logger;

        private readonly Decatron.Services.Tenancy.TenantTaskRunner _tenants;

        public ClipHistoryCleanupService(IServiceScopeFactory scopeFactory, ILogger<ClipHistoryCleanupService> logger, Decatron.Services.Tenancy.TenantTaskRunner tenants)
        {
            _tenants = tenants;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try { await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); }
            catch (OperationCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try { await _tenants.ForEachTenantAsync("clip-history", _ => CleanAsync(stoppingToken), stoppingToken); }
                catch (OperationCanceledException) { return; }
                catch (Exception ex) { _logger.LogError(ex, "[Clip] Error limpiando el historial"); }

                try { await Task.Delay(TimeSpan.FromHours(24), stoppingToken); }
                catch (OperationCanceledException) { return; }
            }
        }

        private async Task CleanAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var configs = await db.ClipCommandConfigs.AsNoTracking()
                .Where(c => c.HistoryRetentionDays != null)
                .Select(c => new { c.UserId, Days = c.HistoryRetentionDays!.Value })
                .ToListAsync(ct);

            var total = 0;
            foreach (var c in configs)
            {
                var limit = DateTime.UtcNow.AddDays(-c.Days);
                total += await db.ClipCommandHistory.Where(h => h.UserId == c.UserId && h.CreatedAt < limit).ExecuteDeleteAsync(ct);
            }

            if (total > 0) _logger.LogInformation("[Clip] Historial limpiado: {Count} filas vencidas", total);
        }
    }
}
