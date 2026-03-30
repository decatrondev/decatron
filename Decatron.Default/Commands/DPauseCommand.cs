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
    /// Comando !dpause - Pausa el timer
    /// </summary>
    public class DPauseCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<DPauseCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceProvider _serviceProvider;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly ICommandMessagesService _messagesService;

        public string Name => "!dpause";
        public string Description => "Pausa el timer";

        public DPauseCommand(
            IConfiguration configuration,
            ILogger<DPauseCommand> logger,
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
                _logger.LogInformation($"Ejecutando comando !dpause por {username} en {channel}");

                var isCommandEnabled = await IsCommandEnabledForChannel(channel);
                if (!isCommandEnabled)
                {
                    _logger.LogDebug($"Comando !dpause deshabilitado para el canal {channel}");
                    return;
                }

                // Obtener idioma del canal
                var lang = await GetChannelLanguageAsync(channel);

                // Verificar permisos (solo broadcaster/mods)
                var hasPermission = await HasPermissionAsync(username, channel);
                if (!hasPermission)
                {
                    _logger.LogDebug($"❌ {username} no tiene permisos para ejecutar !dpause en {channel}");
                    return;
                }

                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var channelLower = channel.ToLower();
                var state = await dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

                if (state == null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dpause_cmd", "no_active", lang));
                    return;
                }

                if (state.Status != "running")
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dpause_cmd", "not_running", lang));
                    return;
                }

                // Calcular tiempo restante actual antes de pausar
                if (state.StartedAt.HasValue)
                {
                    var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                    var elapsedSeconds = (int)(totalElapsed - state.ElapsedPausedTime);
                    var remainingSeconds = Math.Max(0, state.TotalTime - elapsedSeconds);
                    state.CurrentTime = remainingSeconds;
                }

                state.Status = "paused";
                state.PausedAt = TimerDateTimeHelper.NowForDb();
                state.UpdatedAt = TimerDateTimeHelper.NowForDb();

                await dbContext.SaveChangesAsync();

                // Emitir evento SignalR para pausar el timer
                await _overlayNotificationService.SendPauseTimerAsync(channelLower);

                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dpause_cmd", "paused", lang));
                _logger.LogInformation($"✅ Timer pausado en {channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !dpause en {channel}");
                var lang = await GetChannelLanguageAsync(channel);
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dpause_cmd", "error_generic", lang));
            }
        }

        private async Task<string> GetChannelLanguageAsync(string channelLogin)
        {
            try
            {
                var channelUser = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                if (channelUser == null)
                {
                    _logger.LogWarning($"[DPauseCommand] No se pudo obtener info del canal: {channelLogin}");
                    return "es";
                }

                var language = channelUser.PreferredLanguage ?? "es";
                _logger.LogDebug($"[DPauseCommand] Idioma del canal {channelLogin}: '{language}'");
                return language;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[DPauseCommand] Error obteniendo idioma del canal: {channelLogin}");
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

                _logger.LogDebug($"❌ {username} no tiene permisos para usar !dpause en {channel}");
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

                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "dpause");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si comando !dpause está habilitado para {channelLogin}");
                return true;
            }
        }
    }
}
