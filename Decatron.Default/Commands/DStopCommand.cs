using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Default.Helpers;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Commands
{
    /// <summary>
    /// Comando !dstop - Detiene el timer completamente y lo oculta
    /// </summary>
    public class DStopCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<DStopCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceProvider _serviceProvider;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly ICommandMessagesService _messagesService;

        public string Name => "!dstop";
        public string Description => "Detiene el timer completamente y lo oculta";

        public DStopCommand(
            IConfiguration configuration,
            ILogger<DStopCommand> logger,
            ICommandStateService commandStateService,
            IServiceProvider serviceProvider,
            OverlayNotificationService overlayNotificationService,
            ICommandMessagesService messagesService)
        {
            _configuration = configuration;
            _logger = logger;
            _commandStateService = commandStateService;
            _serviceProvider = serviceProvider;
            _overlayNotificationService = overlayNotificationService;
            _messagesService = messagesService;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            var username = context.Username;
            var channel = context.Channel;
            var message = context.Message;
            await ExecuteInternalAsync(username, channel, message, messageSender);
        }

        private async Task ExecuteInternalAsync(string username, string channel, string message, IMessageSender messageSender)
        {
            try
            {
                _logger.LogInformation($"Ejecutando comando !dstop por {username} en {channel}");

                var isCommandEnabled = await IsCommandEnabledForChannel(channel);
                if (!isCommandEnabled)
                {
                    _logger.LogDebug($"Comando !dstop deshabilitado para el canal {channel}");
                    return;
                }

                // Obtener idioma del canal
                var lang = await GetChannelLanguageAsync(channel);

                // Verificar permisos (solo broadcaster/mods)
                var hasPermission = await HasPermissionAsync(username, channel);
                if (!hasPermission)
                {
                    _logger.LogDebug($"❌ {username} no tiene permisos para ejecutar !dstop en {channel}");
                    return;
                }

                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var channelLower = channel.ToLower();
                var state = await dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

                if (state == null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dstop_cmd", "no_active", lang));
                    return;
                }

                // Guardar backup antes de zerear el estado
                int remainingSeconds = state.CurrentTime;
                int totalElapsedSeconds = 0;

                if (state.Status == "running" && state.StartedAt.HasValue)
                {
                    var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                    var elapsedSecs = (int)(totalElapsed - state.ElapsedPausedTime);
                    remainingSeconds = Math.Max(0, state.TotalTime - elapsedSecs);
                    totalElapsedSeconds = elapsedSecs;
                }
                else if ((state.Status == "paused" || state.Status == "auto_paused") && state.TotalTime > 0)
                {
                    remainingSeconds = state.CurrentTime;
                    totalElapsedSeconds = state.TotalTime - state.CurrentTime;
                }

                // Cerrar la sesión activa antes de zerear
                var sessionIdForBackup = state.CurrentSessionId;
                if (sessionIdForBackup.HasValue)
                {
                    var activeSession = await dbContext.TimerSessions.FindAsync(sessionIdForBackup.Value);
                    if (activeSession != null && !activeSession.EndedAt.HasValue)
                        activeSession.EndedAt = TimerDateTimeHelper.NowForDb();
                }

                if (remainingSeconds > 0 || totalElapsedSeconds > 0)
                {
                    var stopBackup = new TimerSessionBackup
                    {
                        ChannelName = channelLower,
                        RemainingSeconds = remainingSeconds,
                        TotalElapsedSeconds = totalElapsedSeconds,
                        TotalDurationAtSnapshot = state.TotalTime,
                        TimerSessionId = sessionIdForBackup,
                        Reason = "manual_stop",
                        CreatedAt = DateTime.UtcNow
                    };
                    dbContext.TimerSessionBackups.Add(stopBackup);
                }

                // Stop completamente y ocultar
                state.CurrentSessionId = null;
                state.Status = "stopped";
                state.CurrentTime = 0;
                state.StartedAt = null;
                state.PausedAt = null;
                state.StoppedAt = TimerDateTimeHelper.NowForDb();
                state.IsVisible = false;
                state.ElapsedPausedTime = 0;
                state.UpdatedAt = TimerDateTimeHelper.NowForDb();

                await dbContext.SaveChangesAsync();

                // Emitir evento SignalR para detener el timer
                await _overlayNotificationService.SendStopTimerAsync(channelLower);

                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dstop_cmd", "stopped", lang));
                _logger.LogInformation($"✅ Timer detenido en {channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !dstop en {channel}");
                var lang = await GetChannelLanguageAsync(channel);
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dstop_cmd", "error_generic", lang));
            }
        }

        private async Task<string> GetChannelLanguageAsync(string channelLogin)
        {
            try
            {
                var channelUser = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                if (channelUser == null)
                {
                    _logger.LogWarning($"[DStopCommand] No se pudo obtener info del canal: {channelLogin}");
                    return "es";
                }

                var language = channelUser.PreferredLanguage ?? "es";
                _logger.LogDebug($"[DStopCommand] Idioma del canal {channelLogin}: '{language}'");
                return language;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[DStopCommand] Error obteniendo idioma del canal: {channelLogin}");
                return "es";
            }
        }

        private async Task<bool> HasPermissionAsync(string username, string channel)
        {
            try
            {
                if (username.Equals(channel, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                var isMod = await GameUtils.HasPermissionToChangeCategoryAsync(_configuration, username, channel, _logger);
                if (isMod)
                {
                    _logger.LogDebug($"✅ {username} es moderador en {channel}");
                    return true;
                }

                _logger.LogDebug($"❌ {username} no tiene permisos para usar !dstop en {channel}");
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando permisos para {username} en {channel}");
                return false;
            }
        }

        private async Task<bool> IsCommandEnabledForChannel(string channelLogin)
        {
            try
            {
                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                if (userInfo == null)
                {
                    return true;
                }

                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "dstop");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si comando !dstop está habilitado para {channelLogin}");
                return true;
            }
        }
    }
}
