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
    /// Comando !dstart - Iniciar el timer con una duración específica
    /// Uso: !dstart 5m
    ///      !dstart 1h30m
    ///      !dstart 300 (segundos)
    /// </summary>
    public class DStartCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<DStartCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceProvider _serviceProvider;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly ICommandMessagesService _messagesService;

        public string Name => "!dstart";
        public string Description => "Inicia el timer con una duración (ej: !dstart 5m, !dstart 1h30m)";

        public DStartCommand(
            IConfiguration configuration,
            ILogger<DStartCommand> logger,
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
                _logger.LogInformation($"Ejecutando comando !dstart por {username} en {channel}");

                var isCommandEnabled = await IsCommandEnabledForChannel(channel);
                if (!isCommandEnabled)
                {
                    _logger.LogDebug($"Comando !dstart deshabilitado para el canal {channel}");
                    return;
                }

                // Obtener idioma del canal
                var lang = await GetChannelLanguageAsync(channel);

                // Verificar permisos (solo broadcaster/mods)
                var hasPermission = await HasPermissionAsync(username, channel);
                if (!hasPermission)
                {
                    _logger.LogDebug($"❌ {username} no tiene permisos para ejecutar !dstart en {channel}");
                    return;
                }

                var messageWithoutPrefix = message.StartsWith("!") ? message.Substring(1) : message;
                var parts = messageWithoutPrefix.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);

                if (parts.Length < 2)
                {
                    await messageSender.SendMessageAsync(channel,
                        _messagesService.GetMessage("dstart_cmd", "usage", lang));
                    return;
                }

                var timeArg = parts[1];

                if (!TimeParser.TryParseTimeToSeconds(timeArg, out var seconds))
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dstart_cmd", "invalid_time", lang));
                    return;
                }

                if (seconds > 604800) // Máximo 7 días
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dstart_cmd", "max_duration", lang));
                    return;
                }

                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var channelLower = channel.ToLower();
                var state = await dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

                if (state == null)
                {
                    state = new TimerState
                    {
                        ChannelName = channelLower,
                        Status = "running",
                        CurrentTime = seconds,
                        TotalTime = seconds,
                        StartedAt = TimerDateTimeHelper.NowForDb(),
                        IsVisible = true,
                        ElapsedPausedTime = 0,
                        CreatedAt = TimerDateTimeHelper.NowForDb(),
                        UpdatedAt = DateTime.UtcNow
                    };
                    dbContext.TimerStates.Add(state);
                }
                else
                {
                    state.Status = "running";
                    state.CurrentTime = seconds;
                    state.TotalTime = seconds;
                    state.StartedAt = TimerDateTimeHelper.NowForDb();
                    state.PausedAt = null;
                    state.StoppedAt = null;
                    state.IsVisible = true;
                    state.ElapsedPausedTime = 0;
                    state.UpdatedAt = TimerDateTimeHelper.NowForDb();
                }

                // SINCRONIZACIÓN: Actualizar también DefaultDuration en la configuración
                var config = await dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);
                if (config != null)
                {
                    config.DefaultDuration = seconds;
                    config.UpdatedAt = TimerDateTimeHelper.NowForDb();
                }

                await dbContext.SaveChangesAsync();

                // Emitir evento SignalR para iniciar el timer en el overlay
                await _overlayNotificationService.SendStartTimerAsync(channelLower, seconds);

                var timeString = TimeParser.FormatSeconds(seconds);
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dstart_cmd", "started", lang, timeString));
                _logger.LogInformation($"✅ Timer iniciado en {channel}: {timeString}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !dstart en {channel}");
                var lang = await GetChannelLanguageAsync(channel);
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dstart_cmd", "error_generic", lang));
            }
        }

        private async Task<string> GetChannelLanguageAsync(string channelLogin)
        {
            try
            {
                var channelUser = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                if (channelUser == null)
                {
                    _logger.LogWarning($"[DStartCommand] No se pudo obtener info del canal: {channelLogin}");
                    return "es";
                }

                var language = channelUser.PreferredLanguage ?? "es";
                _logger.LogDebug($"[DStartCommand] Idioma del canal {channelLogin}: '{language}'");
                return language;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[DStartCommand] Error obteniendo idioma del canal: {channelLogin}");
                return "es";
            }
        }

        private async Task<bool> HasPermissionAsync(string username, string channel)
        {
            try
            {
                // El broadcaster siempre tiene permiso
                if (username.Equals(channel, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                // Verificar si es moderador
                var isMod = await GameUtils.HasPermissionToChangeCategoryAsync(_configuration, username, channel, _logger);
                if (isMod)
                {
                    _logger.LogDebug($"✅ {username} es moderador en {channel}");
                    return true;
                }

                _logger.LogDebug($"❌ {username} no tiene permisos para usar !dstart en {channel}");
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

                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "dstart");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si comando !dstart está habilitado para {channelLogin}");
                return true;
            }
        }
    }
}
