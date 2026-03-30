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
    /// Comando !dtop - Muestra los top contribuidores de la sesión activa
    /// </summary>
    public class DtopCommand : ICommand
    {
        private static readonly ConcurrentDictionary<string, DateTime> _cooldowns = new();

        private readonly IConfiguration _configuration;
        private readonly ILogger<DtopCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceProvider _serviceProvider;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly ICommandMessagesService _messagesService;

        public string Name => "!dtop";
        public string Description => "Top contribuidores de la sesión activa";

        public DtopCommand(
            IConfiguration configuration,
            ILogger<DtopCommand> logger,
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
                _logger.LogInformation($"Ejecutando comando !dtop por {username} en {channel}");

                var isEnabled = await IsCommandEnabledForChannel(channel);
                if (!isEnabled)
                {
                    _logger.LogDebug($"Comando !dtop deshabilitado para {channel}");
                    return;
                }

                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var channelLower = channel.ToLower();
                var config = await dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);

                var cmdCfg = config != null
                    ? TimerTimeFormatter.GetInfoCommandConfig(config.CommandsConfig, "dtop")
                    : null;

                var hasPermission = await CheckPermissionAsync(username, channel,
                    isBroadcaster, isModerator, isVip, isSubscriber, cmdCfg);
                if (!hasPermission)
                {
                    _logger.LogDebug($"❌ {username} no tiene permisos para !dtop en {channel}");
                    return;
                }

                var cooldownSeconds = cmdCfg?.Cooldown ?? 60;
                var cooldownKey = $"{channelLower}:dtop";
                if (_cooldowns.TryGetValue(cooldownKey, out var lastUsed))
                {
                    if (DateTime.UtcNow < lastUsed.AddSeconds(cooldownSeconds))
                    {
                        _logger.LogDebug($"!dtop en cooldown para {channel}");
                        return;
                    }
                }
                _cooldowns[cooldownKey] = TimerDateTimeHelper.NowForDb();

                var lang = await GetChannelLanguageAsync(channel);

                var state = await dbContext.TimerStates.FirstOrDefaultAsync(s => s.ChannelName == channelLower);

                if (state == null || state.Status == "stopped" || state.CurrentSessionId == null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dtop", "no_active_session", lang));
                    return;
                }

                var sessionId = state.CurrentSessionId.Value;

                var topContributors = await dbContext.TimerEventLogs
                    .Where(e => e.ChannelName == channelLower && e.TimerSessionId == sessionId && e.TimeAdded > 0)
                    .GroupBy(e => e.Username)
                    .Select(g => new { Username = g.Key, Total = (long)g.Sum(e => e.TimeAdded) })
                    .OrderByDescending(x => x.Total)
                    .Take(3)
                    .ToListAsync();

                if (!topContributors.Any())
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("dtop", "no_contributors", lang));
                    return;
                }

                var medals = new[] { "🥇", "🥈", "🥉" };
                var topList = topContributors
                    .Select((c, i) => $"{medals[i]} {c.Username} ({TimerTimeFormatter.FormatSecondsSpanish(c.Total, null)})")
                    .ToList();
                var topText = string.Join(" · ", topList);

                var msgTemplate = cmdCfg?.Template ?? _messagesService.GetMessage("dtop", "top_contributors", lang, "{top}");
                var msg = msgTemplate
                    .Replace("{top}", topText)
                    .Replace("{periodo}", _messagesService.GetMessage("dtop", "current_session", lang))
                    .Replace("{streamer}", channel);

                await messageSender.SendMessageAsync(channel, msg);
                _logger.LogInformation($"✅ !dtop respondido en {channel}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !dtop en {channel}");
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
                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "dtop");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si !dtop está habilitado para {channelLogin}");
                return true;
            }
        }

        private async Task<string> GetChannelLanguageAsync(string channel)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var lang = await db.Users
                    .Where(u => u.Login == channel.ToLower())
                    .Select(u => u.PreferredLanguage)
                    .FirstOrDefaultAsync();
                return lang ?? "es";
            }
            catch { return "es"; }
        }
    }
}
