using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// Al arrancar el backend cierra las sesiones de traducción que quedaron abiertas: una sesión solo vive en memoria, así que si el
    /// servidor se reinició, ninguna de las abiertas sigue viva. Sin esto quedaban filas sin fecha de fin (se vieron de hace 22 días) y
    /// las horas de sesión se inflaban. Se cierran con la hora del arranque (hasta ahí estuvieron vivas) y el motivo
    /// <c>server_restart</c>. Corre antes de que ninguna app pueda conectarse.
    /// </summary>
    public sealed class LiveTranslationOrphanCleaner : IHostedService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<LiveTranslationOrphanCleaner> _logger;

        public LiveTranslationOrphanCleaner(IServiceScopeFactory scopes, ILogger<LiveTranslationOrphanCleaner> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var n = await db.Database.ExecuteSqlRawAsync(
                    "UPDATE live_translation_sessions SET ended_at = NOW(), end_reason = 'server_restart' WHERE ended_at IS NULL", cancellationToken);
                if (n > 0) _logger.LogInformation("[LiveTranslation] Se cerraron {Count} sesiones que habían quedado abiertas por un reinicio", n);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "[LiveTranslation] No se pudieron cerrar las sesiones huérfanas");
            }
        }

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
