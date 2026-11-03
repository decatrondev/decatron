using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Platforms.Kick
{
    /// <summary>
    /// Mantiene a los canales de Kick vinculados suscriptos a los eventos de alertas (follows, subs, regalos, Kicks,
    /// estado del directo). Antes solo se suscribía al iniciar sesión, así que las cuentas ya vinculadas no los
    /// recibían, y Kick desuscribe solo si el webhook falla más de un día. Un canal a la vez, con pausa entre ellos.
    /// </summary>
    public class KickEventSubscriptionService : BackgroundService
    {
        private static readonly TimeSpan StartDelay = TimeSpan.FromMinutes(2);
        private static readonly TimeSpan Interval = TimeSpan.FromHours(6);
        private static readonly TimeSpan PauseBetweenChannels = TimeSpan.FromSeconds(1.5);

        /// <summary>Los eventos de alertas más los que ya existían (chat y canjes), para que ninguno se pierda en silencio.</summary>
        public static readonly string[] WantedEvents =
            KickEventTranslator.AlertEvents.Concat(new[] { "chat.message.sent", "channel.reward.redemption.updated" }).ToArray();
        private static string[] Wanted => WantedEvents;

        private readonly IServiceProvider _sp;
        private readonly KickEventSubscriptionStatus _status;
        private readonly ILogger<KickEventSubscriptionService> _logger;

        public KickEventSubscriptionService(IServiceProvider sp, KickEventSubscriptionStatus status, ILogger<KickEventSubscriptionService> logger)
        {
            _sp = sp;
            _status = status;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try { await Task.Delay(StartDelay, stoppingToken); } catch (OperationCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try { await RunOnceAsync(stoppingToken); }
                catch (OperationCanceledException) { return; }
                catch (Exception ex) { _logger.LogError(ex, "[Kick EventSub] Fallo el ciclo de suscripciones"); }

                try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { return; }
            }
        }

        private async Task RunOnceAsync(CancellationToken ct)
        {
            List<Decatron.Core.Models.User> users;
            using (var scope = _sp.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                users = await db.Users.AsNoTracking()
                    .Where(u => u.IsActive && u.KickId != null && u.KickRefreshToken != null)
                    .ToListAsync(ct);
            }

            int ok = 0, failed = 0, created = 0;
            foreach (var user in users)
            {
                ct.ThrowIfCancellationRequested();
                try
                {
                    using var scope = _sp.CreateScope();
                    var token = await KickChannelTokens.GetValidAsync(scope.ServiceProvider, user, _logger);
                    if (string.IsNullOrEmpty(token))
                    {
                        _status.Set(user.KickId!, new KickEventSubscriptionState(DateTime.UtcNow, false, Wanted, "sin token valido"));
                        failed++;
                        continue;
                    }

                    var svc = scope.ServiceProvider.GetRequiredService<IKickEventSubService>();
                    var result = await svc.EnsureSubscriptionsAsync(user.KickId!, token, Wanted);
                    _status.Set(user.KickId!, new KickEventSubscriptionState(DateTime.UtcNow, result.Success, result.Missing, result.Error));
                    if (result.Success) { ok++; created += result.Created.Count; } else failed++;
                }
                catch (Exception ex)
                {
                    failed++;
                    _logger.LogError(ex, "[Kick EventSub] Error con el canal {KickId}", user.KickId);
                }

                await Task.Delay(PauseBetweenChannels, ct);
            }

            _logger.LogInformation("[Kick EventSub] Ciclo listo: {Total} canal(es), {Ok} al dia ({Created} suscripcion(es) nuevas), {Failed} con problemas", users.Count, ok, created, failed);
        }
    }
}
