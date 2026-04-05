using Microsoft.AspNetCore.SignalR;
using Decatron.Hubs;

namespace Decatron.Services
{
    public class OverlayNotificationService
    {
        private readonly IHubContext<OverlayHub> _hubContext;
        private readonly ILogger<OverlayNotificationService> _logger;

        public OverlayNotificationService(
            IHubContext<OverlayHub> hubContext,
            ILogger<OverlayNotificationService> logger)
        {
            _hubContext = hubContext;
            _logger = logger;
        }

        /// <summary>
        /// Envía un evento de shoutout al overlay del canal
        /// </summary>
        public async Task SendShoutoutAsync(string channel, ShoutoutData shoutoutData, string? clipLocalPath)
        {
            try
            {
                _logger.LogInformation($"📡 Enviando shoutout a overlay_{channel} para @{shoutoutData.Username}");

                var payload = new
                {
                    targetUser = shoutoutData.Username,
                    displayName = shoutoutData.DisplayName,
                    gameName = shoutoutData.GameName,
                    profileImageUrl = shoutoutData.ProfileImageUrl,
                    clipUrl = clipLocalPath, // URL local del clip descargado
                    clipId = shoutoutData.ClipId,
                    timestamp = DateTime.UtcNow
                };

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("ShowShoutout", payload);

                _logger.LogInformation($"✅ Shoutout enviado a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando shoutout al overlay para {channel}");
            }
        }

        /// <summary>
        /// Notifica cambio de configuración al overlay
        /// </summary>
        public async Task NotifyConfigurationChanged(string channel)
        {
            try
            {
                _logger.LogInformation($"📡 Notificando cambio de configuración para canal: {channel}");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("ConfigurationChanged", new
                    {
                        channel = channel,
                        timestamp = DateTime.UtcNow
                    });

                _logger.LogInformation($"✅ Notificación enviada a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error notificando cambio de configuración para {channel}");
            }
        }

        /// <summary>
        /// Notifica cambio de configuración al overlay (alias async)
        /// </summary>
        public Task NotifyConfigurationChangedAsync(string channel)
        {
            return NotifyConfigurationChanged(channel);
        }

        /// <summary>
        /// Solicita refresh del overlay
        /// </summary>
        public async Task NotifyOverlayRefresh(string channel)
        {
            try
            {
                _logger.LogInformation($"Solicitando refresh del overlay para: {channel}");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("RefreshOverlay");

                _logger.LogInformation($"Refresh solicitado para overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error solicitando refresh para {channel}");
            }
        }

        /// <summary>
        /// Envía actualización del estado del timer al overlay
        /// </summary>
        public async Task SendTimerStateUpdateAsync(string channel, object state)
        {
            try
            {
                _logger.LogDebug($"📡 Enviando timer state update a overlay_{channel}");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("TimerStateUpdate", state);

                _logger.LogDebug($"✅ Timer state update enviado a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando timer state update a overlay_{channel}");
            }
        }

        /// <summary>
        /// Notifica que se ejecutó un comando de timer desde chat
        /// </summary>
        public async Task SendTimerCommandAsync(string channel, string command, object? parameters = null)
        {
            try
            {
                _logger.LogDebug($"📡 Enviando timer command '{command}' a overlay_{channel}");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("TimerCommandExecuted", new
                    {
                        command,
                        parameters,
                        timestamp = DateTime.UtcNow
                    });

                _logger.LogDebug($"✅ Timer command '{command}' enviado a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando timer command a overlay_{channel}");
            }
        }

        /// <summary>
        /// Notifica cambio en la configuración del timer
        /// </summary>
        public async Task NotifyTimerConfigChangedAsync(string channel)
        {
            try
            {
                _logger.LogDebug($"📡 Notificando timer config changed a overlay_{channel}");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("ConfigurationChanged", new
                    {
                        timestamp = DateTime.UtcNow
                    });

                _logger.LogDebug($"✅ Timer config changed enviado a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando timer config changed a overlay_{channel}");
            }
        }

        /// <summary>
        /// Inicia el timer en el overlay
        /// </summary>
        public async Task SendStartTimerAsync(string channel, int targetSeconds)
        {
            try
            {
                _logger.LogDebug($"📡 Enviando StartTimer a overlay_{channel} con {targetSeconds}s");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("StartTimer", new { targetSeconds });

                _logger.LogDebug($"✅ StartTimer enviado a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando StartTimer a overlay_{channel}");
            }
        }

        /// <summary>
        /// Pausa el timer en el overlay
        /// </summary>
        public async Task SendPauseTimerAsync(string channel)
        {
            try
            {
                _logger.LogDebug($"📡 Enviando PauseTimer a overlay_{channel}");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("PauseTimer");

                _logger.LogDebug($"✅ PauseTimer enviado a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando PauseTimer a overlay_{channel}");
            }
        }

        /// <summary>
        /// Reanuda el timer en el overlay
        /// </summary>
        public async Task SendResumeTimerAsync(string channel)
        {
            try
            {
                _logger.LogDebug($"📡 Enviando ResumeTimer a overlay_{channel}");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("ResumeTimer");

                _logger.LogDebug($"✅ ResumeTimer enviado a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando ResumeTimer a overlay_{channel}");
            }
        }

        /// <summary>
        /// Reinicia el timer en el overlay
        /// </summary>
        public async Task SendResetTimerAsync(string channel)
        {
            try
            {
                _logger.LogDebug($"📡 Enviando ResetTimer a overlay_{channel}");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("ResetTimer");

                _logger.LogDebug($"✅ ResetTimer enviado a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando ResetTimer a overlay_{channel}");
            }
        }

        /// <summary>
        /// Detiene el timer en el overlay
        /// </summary>
        public async Task SendStopTimerAsync(string channel)
        {
            try
            {
                _logger.LogDebug($"📡 Enviando StopTimer a overlay_{channel}");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("StopTimer");

                _logger.LogDebug($"✅ StopTimer enviado a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando StopTimer a overlay_{channel}");
            }
        }

        /// <summary>
        /// Añade tiempo al timer en el overlay
        /// </summary>
        public async Task SendAddTimeAsync(string channel, int seconds)
        {
            try
            {
                _logger.LogDebug($"📡 Enviando AddTime a overlay_{channel} con {seconds}s");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("AddTime", new { seconds });

                _logger.LogDebug($"✅ AddTime enviado a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando AddTime a overlay_{channel}");
            }
        }

        /// <summary>
        /// Envía una alerta de evento del timer (bits, subs, raids, etc.) al overlay
        /// </summary>
        public async Task SendTimerEventAlertAsync(string channel, object eventData)
        {
            try
            {
                _logger.LogDebug($"📡 Enviando TimerEventAlert a overlay_{channel}");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("TimerEventAlert", eventData);

                _logger.LogDebug($"✅ TimerEventAlert enviado a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando TimerEventAlert a overlay_{channel}");
            }
        }

        /// <summary>
        /// Emite el tiempo restante actual cada segundo para sincronizar todos los clientes
        /// </summary>
        public async Task SendTimerTickAsync(string channel, int remainingSeconds)
        {
            try
            {
                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("TimerTick", new { remainingSeconds });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando TimerTick a timer_{channel}");
            }
        }

        /// <summary>
        /// Notifica al overlay que un usuario se unió al giveaway
        /// </summary>
        public async Task SendGiveawayParticipantJoinedAsync(string channel, object participant)
        {
            try
            {
                _logger.LogDebug($"📡 Enviando GiveawayParticipantJoined a overlay_{channel}");

                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("GiveawayParticipantJoined", participant);

                _logger.LogDebug($"✅ GiveawayParticipantJoined enviado a overlay_{channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando GiveawayParticipantJoined a overlay_{channel}");
            }
        }

        /// <summary>
        /// Notifica al overlay de gacha que hubo un pull
        /// </summary>
        public async Task SendGachaPullAsync(string channel, object pullResult)
        {
            try
            {
                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync("GachaPull", pullResult);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando GachaPull a overlay_{channel}");
            }
        }

        /// <summary>
        /// Envía un evento genérico al overlay del canal
        /// </summary>
        public async Task SendToChannel(string channel, string eventName, object data)
        {
            try
            {
                await _hubContext.Clients
                    .Group($"overlay_{channel}")
                    .SendAsync(eventName, data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error enviando {eventName} a overlay_{channel}");
            }
        }
    }
}
