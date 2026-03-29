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
    /// Comando !dstats - Muestra estadísticas por tipo de evento de la sesión activa
    /// </summary>
    public class DstatsCommand : ICommand
    {
        private static readonly ConcurrentDictionary<string, DateTime> _cooldowns = new();

        private readonly IConfiguration _configuration;
        private readonly ILogger<DstatsCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceProvider _serviceProvider;
        private readonly OverlayNotificationService _overlayNotificationService;

        public string Name => "!dstats";
        public string Description => "Estadísticas de la sesión activa del timer";

        public DstatsCommand(
            IConfiguration configuration,
            ILogger<DstatsCommand> logger,
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
                _logger.LogInformation($"Ejecutando comando !dstats por {username} en {channel}");

                var isEnabled = await IsCommandEnabledForChannel(channel);
                if (!isEnabled)
                {
                    _logger.LogDebug($"Comando !dstats deshabilitado para {channel}");
                    return;
                }

                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var channelLower = channel.ToLower();
                var config = await dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);

                var cmdCfg = config != null
                    ? TimerTimeFormatter.GetInfoCommandConfig(config.CommandsConfig, "dstats")
                    : null;

                var hasPermission = await CheckPermissionAsync(username, channel,
                    isBroadcaster, isModerator, isVip, isSubscriber, cmdCfg);
                if (!hasPermission)
                {
                    _logger.LogDebug($"❌ {username} no tiene permisos para !dstats en {channel}");
                    return;
                }

                var cooldownSeconds = cmdCfg?.Cooldown ?? 30;
                var cooldownKey = $"{channelLower}:dstats";
                if (_cooldowns.TryGetValue(cooldownKey, out var lastUsed))
                {
                    if (DateTime.UtcNow < lastUsed.AddSeconds(cooldownSeconds))
                    {
                        _logger.LogDebug($"!dstats en cooldown para {channel}");
                        return;
                    }
                }
                _cooldowns[cooldownKey] = TimerDateTimeHelper.NowForDb();

                var state = await dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

                if (state == null || state.Status == "stopped" || state.CurrentSessionId == null)
                {
                    await messageSender.SendMessageAsync(channel, "📊 No hay sesión activa del timer.");
                    return;
                }

                var sessionId = state.CurrentSessionId.Value;

                var stats = await dbContext.TimerEventLogs
                    .Where(e => e.ChannelName == channelLower && e.TimerSessionId == sessionId && e.TimeAdded > 0)
                    .GroupBy(e => e.EventType)
                    .Select(g => new { Type = g.Key, Total = (long)g.Sum(e => e.TimeAdded) })
                    .ToListAsync();

                long totalSeconds = stats.Sum(s => s.Total);
                long subsSeconds = stats
                    .Where(s => s.Type.StartsWith("sub", StringComparison.OrdinalIgnoreCase))
                    .Sum(s => s.Total);
                long bitsSeconds = stats
                    .Where(s => s.Type.Equals("bits", StringComparison.OrdinalIgnoreCase))
                    .Sum(s => s.Total);
                long raidsSeconds = stats
                    .Where(s => s.Type.Equals("raid", StringComparison.OrdinalIgnoreCase))
                    .Sum(s => s.Total);
                long followsSeconds = stats
                    .Where(s => s.Type.Equals("follow", StringComparison.OrdinalIgnoreCase))
                    .Sum(s => s.Total);
                long tipsSeconds = stats
                    .Where(s => s.Type.Equals("tips", StringComparison.OrdinalIgnoreCase))
                    .Sum(s => s.Total);

                var msgTemplate = cmdCfg?.Template
                    ?? "📊 Esta sesión: Subs {subs} · Bits {bits} · Raids {raids} · Total {total}";

                var msg = msgTemplate
                    .Replace("{total}", TimerTimeFormatter.FormatSecondsSpanish(totalSeconds, null))
                    .Replace("{subs}", TimerTimeFormatter.FormatSecondsSpanish(subsSeconds, null))
                    .Replace("{bits}", TimerTimeFormatter.FormatSecondsSpanish(bitsSeconds, null))
                    .Replace("{raids}", TimerTimeFormatter.FormatSecondsSpanish(raidsSeconds, null))
                    .Replace("{follows}", TimerTimeFormatter.FormatSecondsSpanish(followsSeconds, null))
                    .Replace("{tips}", TimerTimeFormatter.FormatSecondsSpanish(tipsSeconds, null))
                    .Replace("{streamer}", channel);

                await messageSender.SendMessageAsync(channel, msg);
                _logger.LogInformation($"✅ !dstats respondido en {channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !dstats en {channel}");
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
                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "dstats");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si !dstats está habilitado para {channelLogin}");
                return true;
            }
        }
    }
}
