using Decatron.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// Vuelve a comprobar el nivel de acceso de quien está escuchando: si deja de cumplirlo (dejó de seguir el canal, perdió la
    /// suscripción, el streamer subió el nivel o lo agregó a bloqueados) se le saca con el motivo. Cada 5 minutos para todos los
    /// canales, y al instante para un canal cuando su streamer cambia el acceso. Los rol de Twitch salen de la caché de 10 minutos, así que
    /// no multiplica las consultas. Plan: .dev/plans/TRADUCCION_ACCESO_PLAN.md, Fase 3.
    /// </summary>
    public sealed class TranslationAccessRecheckService : BackgroundService
    {
        private static readonly TimeSpan Every = TimeSpan.FromMinutes(5);
        private readonly IHubContext<TranslationHub> _hub;
        private readonly ITranslationAccessGate _gate;
        private readonly ILogger<TranslationAccessRecheckService> _logger;

        private readonly Decatron.Services.Tenancy.TenantShadow? _tenantShadow;

        public TranslationAccessRecheckService(IHubContext<TranslationHub> hub, ITranslationAccessGate gate, ILogger<TranslationAccessRecheckService> logger,
            Decatron.Services.Tenancy.TenantShadow? tenantShadow = null)
        {
            _tenantShadow = tenantShadow;
            _hub = hub;
            _gate = gate;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try { await Task.Delay(Every, stoppingToken); }
                catch (OperationCanceledException) { return; }
                try { await RecheckAsync(null); }
                catch (Exception ex) when (ex is not OperationCanceledException) { _logger.LogWarning(ex, "[LiveTranslation] Falló la revisión periódica del acceso"); }
            }
        }

        /// <summary>Revisa a quien escucha un canal (o todos si <paramref name="login"/> es null) y saca a quien ya no cumple.</summary>
        public async Task RecheckAsync(string? login)
        {
            var listeners = TranslationHub.SnapshotListeners().Where(l => login == null || l.Login == login.ToLowerInvariant()).ToList();
            foreach (var l in listeners)
            {
                // El acceso se comprueba con la app de Twitch del tenant dueño del canal, no con la del #1
                using var tenantScope = _tenantShadow?.Enter("Bg.TranslationAccessRecheck", l.Login);
                var r = await _gate.CheckViewerAsync(l.Login, l.Who);
                if (r.Reason == null) continue;
                _logger.LogInformation("[LiveTranslation] Se saca a un oyente de {Login} porque ya no cumple el acceso: {Reason}", l.Login, r.Reason);
                await TranslationHub.EvictConnectionAsync(_hub, l.ConnectionId, r);
            }
        }
    }
}
