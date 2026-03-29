using System.Collections.Concurrent;
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
    /// Comando !dcuando - Muestra la fecha/hora estimada de finalización del timer
    /// </summary>
    public class DcuandoCommand : ICommand
    {
        private static readonly ConcurrentDictionary<string, DateTime> _cooldowns = new();

        private readonly IConfiguration _configuration;
        private readonly ILogger<DcuandoCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceProvider _serviceProvider;
        private readonly OverlayNotificationService _overlayNotificationService;

        public string Name => "!dcuando";
        public string Description => "Muestra la fecha/hora de finalización del timer";

        public DcuandoCommand(
            IConfiguration configuration,
            ILogger<DcuandoCommand> logger,
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
            await ExecuteInternalAsync(context.Username, context.Channel,
                context.IsBroadcaster, context.IsModerator, context.IsVip, context.IsSubscriber,
                messageSender);
        }

        private async Task ExecuteInternalAsync(string username, string channel,
            bool isBroadcaster, bool isModerator, bool isVip, bool isSubscriber,
            IMessageSender messageSender)
        {
            try
            {
                _logger.LogInformation($"Ejecutando comando !dcuando por {username} en {channel}");

                var isEnabled = await IsCommandEnabledForChannel(channel);
                if (!isEnabled)
                {
                    _logger.LogDebug($"Comando !dcuando deshabilitado para {channel}");
                    return;
                }

                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var channelLower = channel.ToLower();
                var config = await dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);

                var cmdCfg = config != null
                    ? TimerTimeFormatter.GetInfoCommandConfig(config.CommandsConfig, "dcuando")
                    : null;

                var hasPermission = await CheckPermissionAsync(username, channel,
                    isBroadcaster, isModerator, isVip, isSubscriber, cmdCfg);
                if (!hasPermission)
                {
                    _logger.LogDebug($"❌ {username} no tiene permisos para !dcuando en {channel}");
                    return;
                }

                var cooldownSeconds = cmdCfg?.Cooldown ?? 30;
                var cooldownKey = $"{channelLower}:dcuando";
                if (_cooldowns.TryGetValue(cooldownKey, out var lastUsed))
                {
                    if (DateTime.UtcNow < lastUsed.AddSeconds(cooldownSeconds))
                    {
                        _logger.LogDebug($"!dcuando en cooldown para {channel}");
                        return;
                    }
                }
                _cooldowns[cooldownKey] = TimerDateTimeHelper.NowForDb();

                var state = await dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

                if (state == null || state.Status == "stopped")
                {
                    var noActiveTemplate = cmdCfg?.Template ?? "📅 El timer no está activo";
                    var noActiveMsg = noActiveTemplate
                        .Replace("{fecha}", "desconocida")
                        .Replace("{hora}", "desconocida")
                        .Replace("{tiempo}", "detenido")
                        .Replace("{streamer}", channel);
                    await messageSender.SendMessageAsync(channel, noActiveMsg);
                    return;
                }

                // Calcular tiempo restante
                long remainingSeconds;
                if (state.Status == "running" && state.StartedAt.HasValue)
                {
                    var elapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds - state.ElapsedPausedTime;
                    remainingSeconds = Math.Max(0, state.TotalTime - (long)elapsed);
                }
                else
                {
                    remainingSeconds = state.CurrentTime;
                }

                var endTime = DateTime.UtcNow.AddSeconds(remainingSeconds);
                var timezone = config?.TimeZone ?? "UTC";
                var (fecha, hora) = TimerTimeFormatter.FormatDateTimeParts(endTime, timezone);

                var displayCfg = config != null
                    ? TimerTimeFormatter.ParseDisplayConfig(config.DisplayConfig)
                    : null;
                var tiempoFormateado = TimerTimeFormatter.FormatSecondsSpanish(remainingSeconds, displayCfg);

                var msgTemplate = cmdCfg?.Template
                    ?? "📅 El extensible de {streamer} terminaría el {fecha} a las {hora}";
                var msg = msgTemplate
                    .Replace("{fecha}", fecha)
                    .Replace("{hora}", hora)
                    .Replace("{tiempo}", tiempoFormateado)
                    .Replace("{streamer}", channel);

                await messageSender.SendMessageAsync(channel, msg);
                _logger.LogInformation($"✅ !dcuando respondido en {channel}: {fecha} a las {hora}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !dcuando en {channel}");
            }
        }

        private async Task<bool> CheckPermissionAsync(string username, string channel,
            bool isBroadcaster, bool isModerator, bool isVip, bool isSubscriber,
            InfoCommandConfigDto? cmdCfg)
        {
            try
            {
                var level = cmdCfg?.PermissionLevel ?? "everyone";
                if (!isModerator && (level == "mods" || level == "vips"))
                {
                    isModerator = await GameUtils.HasPermissionToChangeCategoryAsync(_configuration, username, channel, _logger);
                }
                return InfoCommandPermissions.HasAccess(username, channel,
                    isBroadcaster, isModerator, isVip, isSubscriber, cmdCfg);
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
                if (userInfo == null) return true;
                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "dcuando");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si !dcuando está habilitado para {channelLogin}");
                return true;
            }
        }
    }
}
