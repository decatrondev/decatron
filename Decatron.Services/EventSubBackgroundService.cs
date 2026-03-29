using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    public class EventSubBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<EventSubBackgroundService> _logger;

        public EventSubBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<EventSubBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("====================================================");
            _logger.LogInformation("🚀 INICIANDO SERVICIO DE REGISTRO EVENTSUB");
            _logger.LogInformation("====================================================");

            // Esperar 10 segundos para que la app termine de iniciar
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                    var eventSubService = scope.ServiceProvider.GetRequiredService<EventSubService>();

                    // Obtener todos los usuarios activos que tienen el bot habilitado
                    var activeUsers = await dbContext.Users
                        .Where(u => u.IsActive)
                        .ToListAsync(stoppingToken);

                    _logger.LogInformation($"📊 Encontrados {activeUsers.Count} usuarios activos");

                    int registeredCount = 0;
                    int skippedCount = 0;
                    int errorCount = 0;

                    foreach (var user in activeUsers)
                    {
                        if (stoppingToken.IsCancellationRequested)
                            break;

                        try
                        {
                            if (string.IsNullOrEmpty(user.TwitchId))
                            {
                                _logger.LogWarning($"⚠️ Usuario {user.Login} no tiene TwitchId, omitiendo");
                                skippedCount++;
                                continue;
                            }

                            // Verificar si el bot está habilitado para este usuario
                            var systemSettings = await dbContext.SystemSettings
                                .Where(s => s.UserId == user.Id)
                                .FirstOrDefaultAsync(stoppingToken);

                            if (systemSettings == null || !systemSettings.BotEnabled)
                            {
                                _logger.LogDebug($"⏭️ Bot deshabilitado para {user.Login}, omitiendo");
                                skippedCount++;
                                continue;
                            }

                            _logger.LogInformation($"🔄 Verificando suscripciones EventSub para {user.Login} (ID: {user.TwitchId})");

                            // Suscribir a channel.chat.message
                            var result = await eventSubService.EnsureSubscriptionAsync(user.TwitchId);

                            if (result.Success)
                            {
                                if (result.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción chat ya existía");
                                }
                                else
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción chat creada");
                                    registeredCount++;
                                }
                            }
                            else
                            {
                                _logger.LogError($"❌ {user.Login}: Error al registrar suscripción chat - {result.Message}");
                                errorCount++;
                            }

                            // Suscribir a channel.channel_points_custom_reward_redemption.add
                            var channelPointsResult = await eventSubService.EnsureChannelPointsSubscriptionAsync(user.TwitchId);

                            if (channelPointsResult.Success)
                            {
                                if (!channelPointsResult.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción Channel Points creada");
                                    registeredCount++;
                                }
                                else
                                {
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción Channel Points ya existía");
                                }
                            }
                            else
                            {
                                _logger.LogError($"❌ {user.Login}: Error al registrar suscripción Channel Points - {channelPointsResult.Message}");
                                errorCount++;
                            }

                            // Suscribir a channel.follow
                            var followsResult = await eventSubService.EnsureFollowsSubscriptionAsync(user.TwitchId);

                            if (followsResult.Success)
                            {
                                if (!followsResult.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción Follows creada");
                                    registeredCount++;
                                }
                                else
                                {
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción Follows ya existía");
                                }
                            }
                            else
                            {
                                _logger.LogError($"❌ {user.Login}: Error al registrar suscripción Follows - {followsResult.Message}");
                                errorCount++;
                            }

                            // Suscribir a channel.cheer (Bits) - CON VALIDACIÓN
                            var cheerResult = await eventSubService.EnsureCheerSubscriptionAsync(user.TwitchId);

                            if (cheerResult.Success)
                            {
                                if (!cheerResult.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción Bits creada");
                                    registeredCount++;
                                }
                                else
                                {
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción Bits ya existía");
                                }
                            }
                            else
                            {
                                _logger.LogError($"❌ {user.Login}: Error al registrar suscripción Bits - {cheerResult.Message}");
                                errorCount++;
                            }

                            // Suscribir a channel.subscribe (Subscriptions) - CON VALIDACIÓN
                            var subscribeResult = await eventSubService.EnsureSubscriptionsSubscriptionAsync(user.TwitchId);

                            if (subscribeResult.Success)
                            {
                                if (!subscribeResult.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción Subs creada");
                                    registeredCount++;
                                }
                                else
                                {
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción Subs ya existía");
                                }
                            }
                            else
                            {
                                _logger.LogError($"❌ {user.Login}: Error al registrar suscripción Subs - {subscribeResult.Message}");
                                errorCount++;
                            }

                            // Suscribir a channel.subscription.gift (Gift Subs) - CON VALIDACIÓN
                            var giftSubResult = await eventSubService.EnsureGiftSubsSubscriptionAsync(user.TwitchId);

                            if (giftSubResult.Success)
                            {
                                if (!giftSubResult.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción Gift Subs creada");
                                    registeredCount++;
                                }
                                else
                                {
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción Gift Subs ya existía");
                                }
                            }
                            else
                            {
                                _logger.LogError($"❌ {user.Login}: Error al registrar suscripción Gift Subs - {giftSubResult.Message}");
                                errorCount++;
                            }

                            // Suscribir a channel.raid (Raids) - CON VALIDACIÓN
                            var raidResult = await eventSubService.EnsureRaidSubscriptionAsync(user.TwitchId);

                            if (raidResult.Success)
                            {
                                if (!raidResult.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción Raids creada");
                                    registeredCount++;
                                }
                                else
                                {
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción Raids ya existía");
                                }
                            }
                            else
                            {
                                _logger.LogError($"❌ {user.Login}: Error al registrar suscripción Raids - {raidResult.Message}");
                                errorCount++;
                            }

                            // Suscribir a channel.hype_train.begin (Hype Trains) - CON VALIDACIÓN
                            var hypeTrainResult = await eventSubService.EnsureHypeTrainSubscriptionAsync(user.TwitchId);

                            if (hypeTrainResult.Success)
                            {
                                if (!hypeTrainResult.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción Hype Train creada");
                                    registeredCount++;
                                }
                                else
                                {
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción Hype Train ya existía");
                                }
                            }
                            else
                            {
                                _logger.LogError($"❌ {user.Login}: Error al registrar suscripción Hype Train - {hypeTrainResult.Message}");
                                errorCount++;
                            }

                            // Suscribir a stream.online
                            var streamOnlineResult = await eventSubService.EnsureStreamOnlineSubscriptionAsync(user.TwitchId);
                            if (streamOnlineResult.Success)
                            {
                                if (!streamOnlineResult.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción stream.online creada");
                                    registeredCount++;
                                }
                                else
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción stream.online ya existía");
                            }
                            else
                            {
                                _logger.LogError($"❌ {user.Login}: Error al registrar stream.online - {streamOnlineResult.Message}");
                                errorCount++;
                            }

                            // Suscribir a stream.offline
                            var streamOfflineResult = await eventSubService.EnsureStreamOfflineSubscriptionAsync(user.TwitchId);
                            if (streamOfflineResult.Success)
                            {
                                if (!streamOfflineResult.Message.Contains("ya existe"))
                                {
                                    _logger.LogInformation($"🆕 {user.Login}: Nueva suscripción stream.offline creada");
                                    registeredCount++;
                                }
                                else
                                    _logger.LogInformation($"✅ {user.Login}: Suscripción stream.offline ya existía");
                            }
                            else
                            {
                                _logger.LogError($"❌ {user.Login}: Error al registrar stream.offline - {streamOfflineResult.Message}");
                                errorCount++;
                            }

                            // Rate limiting: esperar 500ms entre cada registro
                            await Task.Delay(500, stoppingToken);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, $"❌ Error procesando usuario {user.Login}");
                            errorCount++;
                        }
                    }

                    _logger.LogInformation("====================================================");
                    _logger.LogInformation($"📊 RESUMEN REGISTRO EVENTSUB:");
                    _logger.LogInformation($"   🆕 Nuevas: {registeredCount}");
                    _logger.LogInformation($"   ⏭️ Omitidas (ya existían o bot deshabilitado): {skippedCount}");
                    _logger.LogInformation($"   ❌ Errores: {errorCount}");
                    _logger.LogInformation($"   📋 Total procesados: {activeUsers.Count}");
                    _logger.LogInformation("====================================================");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ ERROR CRÍTICO en servicio de registro EventSub");
            }
        }
    }
}
