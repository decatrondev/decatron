using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Services.Accounts;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Platforms.Kick
{
    /// <summary>
    /// Lleva los eventos de Kick ya traducidos a Event Alerts. La cuenta se resuelve por el id de Kick y la alerta se
    /// configura y se dispara sobre su fila principal, igual que en Twitch. Nunca lanza: un fallo aquí no debe romper el webhook.
    /// </summary>
    public class KickAlertDispatcher
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly AccountChannelResolver _accounts;
        private readonly ILogger<KickAlertDispatcher> _logger;

        public KickAlertDispatcher(IServiceScopeFactory scopes, AccountChannelResolver accounts, ILogger<KickAlertDispatcher> logger)
        {
            _scopes = scopes;
            _accounts = accounts;
            _logger = logger;
        }

        /// <summary>
        /// Apagado a propósito (2026-11-03) hasta tener la configuración separada por plataforma: encendido, un canal con el
        /// enlace «Todo» recibiría alertas de Kick con los valores de Twitch. Plan: .dev/plans/kick-completo/PLAN.md, decisión 15.
        /// </summary>
        private static readonly bool Enabled = false;

        public async Task DispatchAsync(PlatformEvent evt)
        {
            if (!Enabled) return;
            try
            {
                var call = KickAlertMapper.Map(evt);
                if (call == null) return;

                var resolved = await _accounts.ResolveKickIdAsync(evt.BroadcasterId);
                if (resolved == null)
                {
                    _logger.LogWarning("[Kick Alertas] Evento {Type} de un canal sin cuenta (id {Id}), ignorado", evt.Type, evt.BroadcasterId);
                    return;
                }

                using var scope = _scopes.CreateScope();
                var alerts = scope.ServiceProvider.GetRequiredService<IEventAlertsService>();

                // Modo de configuración de la cuenta (se guarda en la configuración de la fila principal)
                var principalConfig = await alerts.GetConfigByChannel(resolved.Account.OverlayKey);
                var mode = EventAlertsPlatformMode.Parse(principalConfig?.ConfigJson);
                var configChannel = EventAlertsPlatformMode.PreferredConfigChannel(mode, "kick", resolved.Matched.Login, resolved.Account.OverlayKey);

                await alerts.TriggerAlertAsync(
                    resolved.Account.OverlayKey, call.EventType, call.Username,
                    userMessage: call.UserMessage, amount: call.Amount, subTier: call.SubTier, months: call.Months,
                    platform: "kick", eventId: evt.Id, chatChannel: evt.BroadcasterId, configChannel: configChannel);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick Alertas] Error disparando la alerta de {Type}", evt.Type);
            }
        }
    }
}
