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
    /// Comando !dreset - Reinicia el timer al tiempo total
    /// </summary>
    public class DResetCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<DResetCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceProvider _serviceProvider;
        private readonly OverlayNotificationService _overlayNotificationService;

        public string Name => "!dreset";
        public string Description => "Reinicia el timer al tiempo total";

        public DResetCommand(
            IConfiguration configuration,
            ILogger<DResetCommand> logger,
            ICommandStateService commandStateService,
            IServiceProvider serviceProvider,
            OverlayNotificationService overlayNotificationService)
        {
            _configuration = configuration;
            _logger = logger;
            _commandStateService = commandStateService;
            _serviceProvider = serviceProvider;
            _overlayNotificationService = overlayNotificationService;
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
                _logger.LogInformation($"Ejecutando comando !dreset por {username} en {channel}");

                var isCommandEnabled = await IsCommandEnabledForChannel(channel);
                if (!isCommandEnabled)
                {
                    _logger.LogDebug($"Comando !dreset deshabilitado para el canal {channel}");
                    return;
                }

                // Verificar permisos (solo broadcaster/mods)
                var hasPermission = await HasPermissionAsync(username, channel);
                if (!hasPermission)
                {
                    _logger.LogDebug($"❌ {username} no tiene permisos para ejecutar !dreset en {channel}");
                    return;
                }

                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var channelLower = channel.ToLower();
                var state = await dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

                if (state == null)
                {
                    await messageSender.SendMessageAsync(channel, "❌ No hay un timer activo.");
                    return;
                }

                // Reset al tiempo total
                state.Status = "stopped";
                state.CurrentTime = state.TotalTime;
                state.StartedAt = null;
                state.PausedAt = null;
                state.StoppedAt = TimerDateTimeHelper.NowForDb();
                state.ElapsedPausedTime = 0;
                state.UpdatedAt = TimerDateTimeHelper.NowForDb();

                await dbContext.SaveChangesAsync();

                // Emitir evento SignalR para reiniciar el timer
                await _overlayNotificationService.SendResetTimerAsync(channelLower);

                var minutes = state.TotalTime / 60;
                var remainingSeconds = state.TotalTime % 60;
                var timeString = minutes > 0
                    ? $"{minutes}m {remainingSeconds}s"
                    : $"{state.TotalTime}s";

                await messageSender.SendMessageAsync(channel, $"🔄 Timer reiniciado a {timeString}");
                _logger.LogInformation($"✅ Timer reiniciado en {channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !dreset en {channel}");
                await messageSender.SendMessageAsync(channel, "❌ Error al ejecutar el comando.");
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

                _logger.LogDebug($"❌ {username} no tiene permisos para usar !dreset en {channel}");
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

                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "dreset");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si comando !dreset está habilitado para {channelLogin}");
                return true;
            }
        }
    }
}
