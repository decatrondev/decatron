using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;

namespace Decatron.Services.Commands
{
    /// <summary>
    /// !watchtime — Muestra cuánto tiempo lleva un viewer viendo el stream actual.
    /// Se resetea automáticamente cuando el stream termina (ver WatchTimeTrackingService.ResetStreamWatchTime).
    /// </summary>
    public class WatchtimeCommand : ICommand
    {
        private readonly ILogger<WatchtimeCommand> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        // Cooldown tracking: key = "channel:global" o "channel:username" — mismo patrón que GachaCommand
        private static readonly ConcurrentDictionary<string, DateTime> _cooldowns = new();

        public string Name => "!watchtime";
        public string Description => "Muestra cuánto tiempo llevas viendo el stream actual";

        public WatchtimeCommand(ILogger<WatchtimeCommand> logger, IServiceScopeFactory serviceScopeFactory)
        {
            _logger = logger;
            _serviceScopeFactory = serviceScopeFactory;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var streamStatusService = scope.ServiceProvider.GetRequiredService<IStreamStatusService>();
                var twitchApiService = scope.ServiceProvider.GetRequiredService<TwitchApiService>();

                var channelInfo = await ChannelResolver.ResolveChannelInfoAsync(db, context.Channel);
                if (channelInfo == null)
                {
                    _logger.LogWarning($"[Watchtime] Canal {context.Channel} no resuelto");
                    return;
                }

                var config = await db.WatchtimeCommandConfigs
                    .FirstOrDefaultAsync(c => c.UserId == channelInfo.UserId)
                    ?? new WatchtimeCommandConfig();

                if (!config.Enabled)
                {
                    _logger.LogDebug($"[Watchtime] {context.Channel}: comando deshabilitado");
                    return;
                }

                // Permisos jerárquicos: everyone < subscriber < vip < moderator < lead_moderator < broadcaster
                var userLevel = GetUserLevel(context);
                if (!HasPermission(userLevel, config.Permission))
                {
                    _logger.LogDebug($"[Watchtime] {context.Channel}: {context.Username} sin permiso ({userLevel} < {config.Permission})");
                    return;
                }

                // Cooldowns
                var now = DateTime.UtcNow;
                var channelKey = context.Channel.ToLower();
                if (config.CooldownGlobal > 0)
                {
                    var globalKey = $"{channelKey}:watchtime:global";
                    if (_cooldowns.TryGetValue(globalKey, out var lastGlobal) && (now - lastGlobal).TotalSeconds < config.CooldownGlobal)
                    {
                        _logger.LogDebug($"[Watchtime] {context.Channel}: cooldown global activo");
                        return;
                    }
                    _cooldowns[globalKey] = now;
                }
                if (config.CooldownUser > 0)
                {
                    var userKey = $"{channelKey}:watchtime:{context.Username.ToLower()}";
                    if (_cooldowns.TryGetValue(userKey, out var lastUser) && (now - lastUser).TotalSeconds < config.CooldownUser)
                    {
                        _logger.LogDebug($"[Watchtime] {context.Channel}: cooldown de usuario activo para {context.Username}");
                        return;
                    }
                    _cooldowns[userKey] = now;
                }

                // Stream offline
                // IStreamStatusService solo se actualiza vía webhooks (stream.online/offline) — si el webhook
                // no llega (falla de suscripción, delay, etc.) el estado en memoria queda desactualizado.
                // Para !watchtime consultamos la API de Twitch en tiempo real en vez de confiar en el caché,
                // ya que hay cooldowns que limitan la frecuencia de esta llamada.
                if (config.OnlyWhenLive)
                {
                    var isLive = streamStatusService.IsLive(channelInfo.TwitchId);
                    if (!isLive)
                    {
                        // Doble-check en vivo por si el caché en memoria quedó desactualizado
                        var liveStream = await twitchApiService.GetStreamAsync(channelInfo.TwitchId);
                        isLive = liveStream != null;
                        _logger.LogInformation($"[Watchtime] {context.Channel}: caché decía offline, verificación directa con Twitch = {(isLive ? "EN VIVO" : "offline")}");
                    }

                    if (!isLive)
                    {
                        if (config.UseOfflineMessage)
                        {
                            var offlineMsg = ApplyVariables(config.OfflineMessage, context.Username, 0, 0, 0, 0, null);
                            await messageSender.SendMessageAsync(context.Channel, offlineMsg);
                        }
                        return;
                    }
                }

                // Watch time del row real (para poder calcular segundos, no solo minutos)
                var watchTimeRow = await db.StreamWatchTimes
                    .AsNoTracking()
                    .FirstOrDefaultAsync(w => w.ChannelId == channelInfo.TwitchId && w.UserId == context.UserId);

                var totalSeconds = ComputeTotalSeconds(watchTimeRow, now);
                var totalMinutes = totalSeconds / 60;
                var hours = totalMinutes / 60;
                var minutes = totalMinutes % 60;
                var seconds = totalSeconds % 60;

                // Tiempo mínimo para responder
                if (config.MinMinutesToRespond > 0 && totalMinutes < config.MinMinutesToRespond)
                {
                    if (config.UseNotEnoughTimeMessage)
                    {
                        var notEnoughMsg = ApplyVariables(config.NotEnoughTimeMessage, context.Username, hours, minutes, seconds, totalMinutes, null);
                        await messageSender.SendMessageAsync(context.Channel, notEnoughMsg);
                    }
                    return;
                }

                // Primera vez (aún no acumula tiempo)
                if (totalMinutes <= 0 && config.UseFirstTimeMessage)
                {
                    var firstTimeMsg = ApplyVariables(config.FirstTimeMessage, context.Username, hours, minutes, seconds, totalMinutes, null);
                    await messageSender.SendMessageAsync(context.Channel, firstTimeMsg);
                    return;
                }

                // Posición en el ranking del stream actual
                int? position = null;
                if (config.ShowPosition)
                {
                    position = await ComputePositionAsync(db, channelInfo.TwitchId, context.UserId, now);
                }

                var message = ApplyVariables(config.CustomMessage, context.Username, hours, minutes, seconds, totalMinutes, position);
                await messageSender.SendMessageAsync(context.Channel, message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Watchtime] Error ejecutando comando para {context.Username} en {context.Channel}");
            }
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private static int ComputeTotalSeconds(Core.Models.StreamWatchTime? row, DateTime now)
        {
            if (row == null) return 0;

            var seconds = row.TotalMinutes * 60;
            if (row.IsActive && row.SessionStartedAt.HasValue)
            {
                seconds += (int)(now - row.SessionStartedAt.Value).TotalSeconds;
            }
            return Math.Max(0, seconds);
        }

        private static async Task<int> ComputePositionAsync(DecatronDbContext db, string channelTwitchId, string userId, DateTime now)
        {
            var rows = await db.StreamWatchTimes
                .AsNoTracking()
                .Where(w => w.ChannelId == channelTwitchId)
                .ToListAsync();

            var ranked = rows
                .Select(r => new { r.UserId, Seconds = ComputeTotalSeconds(r, now) })
                .OrderByDescending(r => r.Seconds)
                .ToList();

            var index = ranked.FindIndex(r => r.UserId == userId);
            return index >= 0 ? index + 1 : ranked.Count + 1;
        }

        private static string ApplyVariables(string template, string user, int hours, int minutes, int seconds, int totalMinutes, int? position)
        {
            return template
                .Replace("{user}", user)
                .Replace("{hours}", hours.ToString())
                .Replace("{minutes}", minutes.ToString())
                .Replace("{seconds}", seconds.ToString())
                .Replace("{total_minutes}", totalMinutes.ToString())
                .Replace("{position}", position.HasValue ? $"#{position}" : "");
        }

        private static string GetUserLevel(CommandContext context)
        {
            if (context.IsBroadcaster) return "broadcaster";
            if (context.IsLeadModerator) return "lead_moderator";
            if (context.IsModerator) return "moderator";
            if (context.IsVip) return "vip";
            if (context.IsSubscriber) return "subscriber";
            return "everyone";
        }

        private static bool HasPermission(string userLevel, string requiredPermission)
        {
            var levels = new[] { "everyone", "subscriber", "vip", "moderator", "lead_moderator", "broadcaster" };
            var userIdx = Array.IndexOf(levels, userLevel);
            var reqIdx = Array.IndexOf(levels, requiredPermission);
            if (userIdx < 0 || reqIdx < 0) return true;
            return userIdx >= reqIdx;
        }
    }
}
