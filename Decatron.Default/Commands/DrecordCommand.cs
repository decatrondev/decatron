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
    /// Comando !drecord - Muestra el récord histórico del timer del canal
    /// </summary>
    public class DrecordCommand : ICommand
    {
        private static readonly ConcurrentDictionary<string, DateTime> _cooldowns = new();

        private readonly IConfiguration _configuration;
        private readonly ILogger<DrecordCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IServiceProvider _serviceProvider;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly ICommandMessagesService _messagesService;

        public string Name => "!drecord";
        public string Description => "Muestra el récord histórico del timer";

        public DrecordCommand(
            IConfiguration configuration,
            ILogger<DrecordCommand> logger,
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
                _logger.LogInformation($"Ejecutando comando !drecord por {username} en {channel}");

                var isEnabled = await IsCommandEnabledForChannel(channel);
                if (!isEnabled)
                {
                    _logger.LogDebug($"Comando !drecord deshabilitado para {channel}");
                    return;
                }

                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var channelLower = channel.ToLower();
                var config = await dbContext.TimerConfigs.FirstOrDefaultAsync(c => c.ChannelName == channelLower);

                var cmdCfg = config != null
                    ? TimerTimeFormatter.GetInfoCommandConfig(config.CommandsConfig, "drecord")
                    : null;

                var hasPermission = await CheckPermissionAsync(username, channel,
                    isBroadcaster, isModerator, isVip, isSubscriber, cmdCfg);
                if (!hasPermission)
                {
                    _logger.LogDebug($"❌ {username} no tiene permisos para !drecord en {channel}");
                    return;
                }

                var cooldownSeconds = cmdCfg?.Cooldown ?? 60;
                var cooldownKey = $"{channelLower}:drecord";
                if (_cooldowns.TryGetValue(cooldownKey, out var lastUsed))
                {
                    if (DateTime.UtcNow < lastUsed.AddSeconds(cooldownSeconds))
                    {
                        _logger.LogDebug($"!drecord en cooldown para {channel}");
                        return;
                    }
                }
                _cooldowns[cooldownKey] = TimerDateTimeHelper.NowForDb();

                var recordSession = await dbContext.TimerSessions
                    .Where(s => s.ChannelName == channelLower)
                    .OrderByDescending(s => s.InitialDuration + s.TotalAddedTime)
                    .FirstOrDefaultAsync();

                var lang = await GetChannelLanguageAsync(channel);

                if (recordSession == null)
                {
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("drecord", "no_sessions", lang, channel));
                    return;
                }

                var recordSeconds = (long)(recordSession.InitialDuration + recordSession.TotalAddedTime);
                var recordFormatted = TimerTimeFormatter.FormatSecondsSpanish(recordSeconds, null);

                var timezone = config?.TimeZone ?? "UTC";
                var (fechaRecord, _) = TimerTimeFormatter.FormatDateTimeParts(recordSession.StartedAt, timezone);

                var msgTemplate = cmdCfg?.Template
                    ?? _messagesService.GetMessage("drecord", "record", lang, "{streamer}", "{record}");

                var msg = msgTemplate
                    .Replace("{record}", recordFormatted)
                    .Replace("{fecha_record}", fechaRecord)
                    .Replace("{streamer}", channel);

                await messageSender.SendMessageAsync(channel, msg);
                _logger.LogInformation($"✅ !drecord respondido en {channel}: {recordFormatted}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error ejecutando !drecord en {channel}");
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
                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "drecord");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error verificando si !drecord está habilitado para {channelLogin}");
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
