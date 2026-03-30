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
    /// Comando !dtimer - Iniciar timer con duración o añadir/remover tiempo
    /// Uso: !dtimer 5m (5 minutos)
    ///      !dtimer 1h30m (1 hora 30 minutos)
    ///      !dtimer add 1h (añadir 1 hora)
    ///      !dtimer remove 30s (remover 30 segundos)
    ///      !dtimer +1h (añadir 1 hora - sintaxis alternativa)
    ///      !dtimer -30s (remover 30 segundos - sintaxis alternativa)
    /// </summary>
    public class DTimerCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<DTimerCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceProvider _serviceProvider;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly ICommandMessagesService _messagesService;

        public string Name => "!dtimer";
        public string Description => "Inicia el timer o añade/remueve tiempo (ej: !dtimer 5m, !dtimer add 1h)";

        public DTimerCommand(
            IConfiguration configuration,
            ILogger<DTimerCommand> logger,
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
                _logger.LogInformation($"Ejecutando comando !dtimer por {username} en {channel}");

                var isCommandEnabled = await IsCommandEnabledForChannel(channel);
                if (!isCommandEnabled)
                {
                    _logger.LogDebug($"Comando !dtimer deshabilitado para el canal {channel}");
                    return;
                }

                // Obtener idioma del canal
                var lang = await GetChannelLanguageAsync(channel);

                // Verificar permisos (solo broadcaster/mods)
                var hasPermission = await HasPermissionAsync(username, channel);
                if (!hasPermission)
                {
                    _logger.LogDebug($"❌ {username} no tiene permisos para ejecutar !dtimer en {channel}");
                    return;
                }

                var messageWithoutPrefix = message.StartsWith("!") ? message.Substring(1) : message;
                var parts = messageWithoutPrefix.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);

                if (parts.Length < 2)
                {
                    await messageSender.SendMessageAsync(channel,
                        _messagesService.GetMessage("dtimer_cmd", "usage", lang));
                    return;
                }

                var argumentsString = parts[1];

                // Detectar si es add/remove time
                if (TimeParser.IsAddTimeCommand(argumentsString, out var addTimeValue))
                {
                    await HandleAddTimeAsync(channel, addTimeValue, messageSender);
                }
                else if (TimeParser.IsRemoveTimeCommand(argumentsString, out var removeTimeValue))
                {
                    await HandleRemoveTimeAsync(channel, removeTimeValue, messageSender);
                }
                else
                {
                    // Start timer
                    await HandleStartTimerAsync(channel, argumentsString, messageSender);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !dtimer en {channel}");
                var errorLang = await GetChannelLanguageAsync(channel);
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dtimer_cmd", "error_generic", errorLang));
            }
        }

        private async Task HandleStartTimerAsync(string channel, string timeArg, IMessageSender messageSender)
        {
            var lang = await GetChannelLanguageAsync(channel);

            if (!TimeParser.TryParseTimeToSeconds(timeArg, out var seconds))
            {
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dtimer_cmd", "invalid_time", lang));
                return;
            }

            if (seconds > 604800) // Máximo 7 días
            {
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dtimer_cmd", "max_duration", lang));
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
                // Bloquear si el timer ya está activo para evitar resetear tiempo acumulado
                if (state.Status == "running" || state.Status == "paused" || state.Status == "auto_paused")
                {
                    var currentTimeStr = TimeParser.FormatSeconds(state.CurrentTime);
                    await messageSender.SendMessageAsync(channel,
                        _messagesService.GetMessage("dtimer_cmd", "already_active", lang, currentTimeStr, timeArg));
                    return;
                }

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

            // Cerrar sesión activa anterior si existe
            if (state.CurrentSessionId.HasValue)
            {
                var oldSession = await dbContext.TimerSessions.FindAsync(state.CurrentSessionId.Value);
                if (oldSession != null && !oldSession.EndedAt.HasValue)
                    oldSession.EndedAt = TimerDateTimeHelper.NowForDb();
                state.CurrentSessionId = null;
            }

            await dbContext.SaveChangesAsync(); // Guarda estado + config + cierre de sesión anterior

            // Crear nueva sesión para este timer
            var newSession = new TimerSession
            {
                ChannelName = channelLower,
                StartedAt = TimerDateTimeHelper.NowForDb(),
                InitialDuration = seconds,
                TotalAddedTime = 0
            };
            dbContext.TimerSessions.Add(newSession);
            await dbContext.SaveChangesAsync(); // Obtener ID de la nueva sesión

            // Vincular estado al ID de la nueva sesión
            state.CurrentSessionId = newSession.Id;
            await dbContext.SaveChangesAsync();

            // Emitir evento SignalR para iniciar el timer en el overlay
            await _overlayNotificationService.SendStartTimerAsync(channelLower, seconds);

            var timeString = TimeParser.FormatSeconds(seconds);
            await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dtimer_cmd", "started", lang, timeString));
            _logger.LogInformation($"✅ Timer iniciado en {channel}: {timeString}");
        }

        private async Task HandleAddTimeAsync(string channel, string timeValue, IMessageSender messageSender)
        {
            var lang = await GetChannelLanguageAsync(channel);

            if (!TimeParser.TryParseTimeToSeconds(timeValue, out var seconds))
            {
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dtimer_cmd", "invalid_time", lang));
                return;
            }

            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var channelLower = channel.ToLower();
            var state = await dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

            if (state == null)
            {
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dtimer_cmd", "no_active", lang));
                return;
            }

            // Calcular tiempo restante actual si está corriendo
            if (state.Status == "running" && state.StartedAt.HasValue)
            {
                var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                var elapsedSeconds = (int)(totalElapsed - state.ElapsedPausedTime);
                var remainingSeconds = Math.Max(0, state.TotalTime - elapsedSeconds);
                state.CurrentTime = remainingSeconds + seconds;
            }
            else
            {
                state.CurrentTime += seconds;
            }

            state.TotalTime += seconds;
            state.UpdatedAt = TimerDateTimeHelper.NowForDb();

            // SINCRONIZACIÓN: Actualizar también DefaultDuration en la configuración
            var config = await dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);
            if (config != null)
            {
                config.DefaultDuration = state.TotalTime;
                config.UpdatedAt = TimerDateTimeHelper.NowForDb();
            }

            await dbContext.SaveChangesAsync();

            // Emitir evento SignalR para añadir tiempo
            await _overlayNotificationService.SendAddTimeAsync(channelLower, seconds);

            var timeString = TimeParser.FormatSeconds(seconds);
            await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dtimer_cmd", "time_added", lang, timeString));
            _logger.LogInformation($"✅ Tiempo añadido en {channel}: +{timeString}");
        }

        private async Task HandleRemoveTimeAsync(string channel, string timeValue, IMessageSender messageSender)
        {
            var lang = await GetChannelLanguageAsync(channel);

            if (!TimeParser.TryParseTimeToSeconds(timeValue, out var seconds))
            {
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dtimer_cmd", "invalid_time", lang));
                return;
            }

            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

            var channelLower = channel.ToLower();
            var state = await dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

            if (state == null)
            {
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dtimer_cmd", "no_active", lang));
                return;
            }

            // Calcular tiempo restante actual si está corriendo
            var currentRemainingSeconds = state.CurrentTime;
            if (state.Status == "running" && state.StartedAt.HasValue)
            {
                var totalElapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds;
                var elapsedSeconds = (int)(totalElapsed - state.ElapsedPausedTime);
                currentRemainingSeconds = Math.Max(0, state.TotalTime - elapsedSeconds);
            }

            var newTime = Math.Max(0, currentRemainingSeconds - seconds);
            var removedSeconds = currentRemainingSeconds - newTime;

            state.CurrentTime = newTime;
            state.TotalTime = Math.Max(0, state.TotalTime - seconds);
            state.UpdatedAt = TimerDateTimeHelper.NowForDb();

            // SINCRONIZACIÓN: Actualizar también DefaultDuration en la configuración
            var config = await dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);
            if (config != null)
            {
                config.DefaultDuration = state.TotalTime;
                config.UpdatedAt = TimerDateTimeHelper.NowForDb();
            }

            await dbContext.SaveChangesAsync();

            // Emitir evento SignalR para remover tiempo (usando valor negativo)
            await _overlayNotificationService.SendAddTimeAsync(channelLower, -removedSeconds);

            var timeString = TimeParser.FormatSeconds(removedSeconds);
            await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dtimer_cmd", "time_removed", lang, timeString));
            _logger.LogInformation($"✅ Tiempo removido en {channel}: -{timeString}");
        }

        private async Task<string> GetChannelLanguageAsync(string channelLogin)
        {
            try
            {
                var channelUser = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                if (channelUser == null)
                {
                    _logger.LogWarning($"[DTimerCommand] No se pudo obtener info del canal: {channelLogin}");
                    return "es";
                }

                var language = channelUser.PreferredLanguage ?? "es";
                _logger.LogDebug($"[DTimerCommand] Idioma del canal {channelLogin}: '{language}'");
                return language;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[DTimerCommand] Error obteniendo idioma del canal: {channelLogin}");
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

                _logger.LogDebug($"❌ {username} no tiene permisos para usar !dtimer en {channel}");
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

                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "dtimer");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si comando !dtimer está habilitado para {channelLogin}");
                return true;
            }
        }
    }
}
