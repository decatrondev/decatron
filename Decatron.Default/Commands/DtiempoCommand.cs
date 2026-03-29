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
    /// Comando !dtiempo - Muestra el tiempo restante del timer formateado
    /// </summary>
    public class DtiempoCommand : ICommand
    {
        private static readonly ConcurrentDictionary<string, DateTime> _cooldowns = new();

        private readonly IConfiguration _configuration;
        private readonly ILogger<DtiempoCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceProvider _serviceProvider;
        private readonly OverlayNotificationService _overlayNotificationService;

        public string Name => "!dtiempo";
        public string Description => "Muestra el tiempo restante del timer";

        public DtiempoCommand(
            IConfiguration configuration,
            ILogger<DtiempoCommand> logger,
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
                _logger.LogInformation($"Ejecutando comando !dtiempo por {username} en {channel}");

                var isEnabled = await IsCommandEnabledForChannel(channel);
                if (!isEnabled)
                {
                    _logger.LogDebug($"Comando !dtiempo deshabilitado para {channel}");
                    return;
                }

                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var channelLower = channel.ToLower();
                var config = await dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);

                var cmdCfg = config != null
                    ? TimerTimeFormatter.GetInfoCommandConfig(config.CommandsConfig, "dtiempo")
                    : null;

                // Permission check usando jerarquía configurable
                var hasPermission = await CheckPermissionAsync(username, channel,
                    isBroadcaster, isModerator, isVip, isSubscriber, cmdCfg);
                if (!hasPermission)
                {
                    _logger.LogDebug($"❌ {username} no tiene permisos para !dtiempo en {channel}");
                    return;
                }

                // Cooldown check
                var cooldownSeconds = cmdCfg?.Cooldown ?? 30;
                var cooldownKey = $"{channelLower}:dtiempo";
                if (_cooldowns.TryGetValue(cooldownKey, out var lastUsed))
                {
                    if (DateTime.UtcNow < lastUsed.AddSeconds(cooldownSeconds))
                    {
                        _logger.LogDebug($"!dtiempo en cooldown para {channel}");
                        return;
                    }
                }
                _cooldowns[cooldownKey] = TimerDateTimeHelper.NowForDb();

                var state = await dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

                if (state == null || state.Status == "stopped")
                {
                    var template = cmdCfg?.Template ?? "⏱ El timer no está activo";
                    var response = template
                        .Replace("{tiempo}", "detenido")
                        .Replace("{streamer}", channel)
                        .Replace("{estado}", "detenido");
                    await messageSender.SendMessageAsync(channel, response);
                    return;
                }

                // Calcular tiempo restante
                long remainingSeconds;
                string estado;

                if (state.Status == "running" && state.StartedAt.HasValue)
                {
                    var elapsed = (DateTime.UtcNow - TimerDateTimeHelper.NormalizeToUtc(state.StartedAt.Value)).TotalSeconds - state.ElapsedPausedTime;
                    remainingSeconds = Math.Max(0, state.TotalTime - (long)elapsed);
                    estado = "corriendo";
                }
                else
                {
                    remainingSeconds = state.CurrentTime;
                    estado = "pausado";
                }

                var displayCfg = config != null
                    ? TimerTimeFormatter.ParseDisplayConfig(config.DisplayConfig)
                    : null;

                var tiempoFormateado = TimerTimeFormatter.FormatSecondsSpanish(remainingSeconds, displayCfg);

                var msgTemplate = cmdCfg?.Template ?? "⏱ Al extensible le quedan {tiempo}";
                var msg = msgTemplate
                    .Replace("{tiempo}", tiempoFormateado)
                    .Replace("{streamer}", channel)
                    .Replace("{estado}", estado);

                await messageSender.SendMessageAsync(channel, msg);
                _logger.LogInformation($"✅ !dtiempo respondido en {channel}: {tiempoFormateado}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !dtiempo en {channel}");
            }
        }

        private async Task<bool> CheckPermissionAsync(string username, string channel,
            bool isBroadcaster, bool isModerator, bool isVip, bool isSubscriber,
            InfoCommandConfigDto? cmdCfg)
        {
            try
            {
                // Para "mods" el badge puede no venir en el contexto, verificar vía API
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
                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "dtiempo");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si !dtiempo está habilitado para {channelLogin}");
                return true;
            }
        }
    }
}
