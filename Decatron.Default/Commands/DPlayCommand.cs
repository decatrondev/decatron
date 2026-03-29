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
    /// Comando !dplay - Resume/Play del timer
    /// </summary>
    public class DPlayCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<DPlayCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceProvider _serviceProvider;
        private readonly OverlayNotificationService _overlayNotificationService;

        public string Name => "!dplay";
        public string Description => "Resume/inicia el timer pausado";

        public DPlayCommand(
            IConfiguration configuration,
            ILogger<DPlayCommand> logger,
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
                _logger.LogInformation($"Ejecutando comando !dplay por {username} en {channel}");

                var isCommandEnabled = await IsCommandEnabledForChannel(channel);
                if (!isCommandEnabled)
                {
                    _logger.LogDebug($"Comando !dplay deshabilitado para el canal {channel}");
                    return;
                }

                // Verificar permisos (solo broadcaster/mods)
                var hasPermission = await HasPermissionAsync(username, channel);
                if (!hasPermission)
                {
                    _logger.LogDebug($"❌ {username} no tiene permisos para ejecutar !dplay en {channel}");
                    return;
                }

                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var channelLower = channel.ToLower();
                var state = await dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

                if (state == null)
                {
                    await messageSender.SendMessageAsync(channel, "❌ No hay un timer activo. Usa !dtimer <segundos> para iniciarlo.");
                    return;
                }

                if (state.Status == "running")
                {
                    await messageSender.SendMessageAsync(channel, "⏱️ El timer ya está corriendo.");
                    return;
                }

                if (state.Status == "paused")
                {
                    // Resume desde pausa
                    if (state.PausedAt.HasValue && state.StartedAt.HasValue)
                    {
                        var pausedDuration = (int)(DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.PausedAt.Value)).TotalSeconds;
                        state.ElapsedPausedTime += pausedDuration;
                    }

                    state.Status = "running";
                    state.PausedAt = null;
                    state.UpdatedAt = TimerDateTimeHelper.NowForDb();

                    await dbContext.SaveChangesAsync();

                    // Emitir evento SignalR para reanudar el timer
                    await _overlayNotificationService.SendResumeTimerAsync(channelLower);

                    await messageSender.SendMessageAsync(channel, "▶️ Timer reanudado");
                    _logger.LogInformation($"✅ Timer reanudado en {channel}");
                }
                else if (state.Status == "stopped")
                {
                    // Start desde stopped
                    state.Status = "running";
                    state.StartedAt = TimerDateTimeHelper.NowForDb();
                    state.PausedAt = null;
                    state.StoppedAt = null;
                    state.IsVisible = true;
                    state.ElapsedPausedTime = 0;
                    state.UpdatedAt = TimerDateTimeHelper.NowForDb();

                    await dbContext.SaveChangesAsync();

                    // Emitir evento SignalR para iniciar el timer
                    await _overlayNotificationService.SendStartTimerAsync(channelLower, state.CurrentTime);

                    await messageSender.SendMessageAsync(channel, "▶️ Timer iniciado");
                    _logger.LogInformation($"✅ Timer iniciado en {channel}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !dplay en {channel}");
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

                _logger.LogDebug($"❌ {username} no tiene permisos para usar !dplay en {channel}");
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

                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "dplay");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si comando !dplay está habilitado para {channelLogin}");
                return true;
            }
        }
    }
}
