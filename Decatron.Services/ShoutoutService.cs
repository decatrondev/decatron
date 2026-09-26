using System.Collections.Concurrent;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>
    /// Hace un shoutout: lista negra, espera, datos de Twitch, clip, historial, mensaje en el chat, overlay
    /// y (opcional) el shoutout nativo de Twitch. Lo usan el comando !so y el shoutout automático por raid.
    /// Ver .dev/plans/SHOUTOUT_REDESIGN_PLAN.md (fase 3).
    /// </summary>
    public class ShoutoutService
    {
        public enum Trigger { Command, Raid }

        private readonly ILogger<ShoutoutService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly TwitchApiService _twitchApiService;
        private readonly ClipDownloadService _clipDownloadService;
        private readonly OverlayNotificationService _overlayNotificationService;
        private readonly IMessageSender _messageSender;

        private const int DefaultCooldownSeconds = 30;
        /// <summary>Canal → persona → último shoutout.</summary>
        private static readonly ConcurrentDictionary<string, ConcurrentDictionary<string, DateTime>> _cooldowns = new();
        /// <summary>Límites de Twitch del nativo: 2 min por canal, 60 min a la misma persona.</summary>
        private static readonly ConcurrentDictionary<string, DateTime> _nativeByChannel = new();
        private static readonly ConcurrentDictionary<string, DateTime> _nativeByTarget = new();
        /// <summary>Último resultado del nativo por canal (para mostrarlo en la vista).</summary>
        private static readonly ConcurrentDictionary<string, NativeResult> _lastNative = new();

        public record NativeResult(DateTime At, bool Ok, int Status, string? Error, string Target);

        public ShoutoutService(
            ILogger<ShoutoutService> logger,
            IServiceScopeFactory scopeFactory,
            TwitchApiService twitchApiService,
            ClipDownloadService clipDownloadService,
            OverlayNotificationService overlayNotificationService,
            IMessageSender messageSender)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _twitchApiService = twitchApiService;
            _clipDownloadService = clipDownloadService;
            _overlayNotificationService = overlayNotificationService;
            _messageSender = messageSender;
        }

        public static NativeResult? LastNativeResult(string channel) =>
            _lastNative.TryGetValue(channel.ToLowerInvariant(), out var r) ? r : null;

        /// <summary>
        /// Hace el shoutout. Con el comando, avisa en el chat si está bloqueado, en espera o no existe;
        /// con un raid, esos casos se saltan en silencio.
        /// </summary>
        public async Task RunAsync(string channel, string targetUser, string executedBy, Trigger trigger, long? channelUserId = null, string? lang = null)
        {
            channel = channel.ToLowerInvariant();
            targetUser = targetUser.TrimStart('@').ToLowerInvariant();
            var isCommand = trigger == Trigger.Command;

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var messages = scope.ServiceProvider.GetRequiredService<ICommandMessagesService>();

            var owner = await db.Users
                .Where(u => channelUserId != null ? u.Id == channelUserId : u.Login == channel)
                .Select(u => new { u.Id, u.PreferredLanguage })
                .FirstOrDefaultAsync();
            channelUserId ??= owner?.Id;
            lang ??= owner?.PreferredLanguage ?? "es";

            var config = await db.ShoutoutConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.Username == channel);
            var settings = ShoutoutSettings.Parse(config?.Settings);

            // Lista negra
            if (IsBlacklisted(config?.Blacklist, targetUser))
            {
                _logger.LogInformation("🚫 {Target} está en la blacklist de {Channel} ({Trigger})", targetUser, channel, trigger);
                if (isCommand)
                {
                    var keys = new[] { "blacklist_1", "blacklist_2", "blacklist_3", "blacklist_4", "blacklist_5" };
                    await _messageSender.SendMessageAsync(channel, messages.GetMessage("so_cmd", keys[Random.Shared.Next(keys.Length)], lang, targetUser));
                }
                return;
            }

            // Espera para repetir a la misma persona
            var cooldown = TimeSpan.FromSeconds(config?.Cooldown ?? DefaultCooldownSeconds);
            var remaining = RemainingCooldown(channel, targetUser, cooldown);
            if (remaining > TimeSpan.Zero)
            {
                if (isCommand)
                    await _messageSender.SendMessageAsync(channel, messages.GetMessage("so_cmd", "cooldown", lang, remaining.TotalSeconds.ToString("F0"), targetUser));
                return;
            }

            _logger.LogInformation("🔥 Procesando shoutout a {Target} en {Channel} ({Trigger})", targetUser, channel, trigger);

            var data = await _twitchApiService.GetShoutoutDataAsync(targetUser, new ShoutoutClipOptions
            {
                Mode = settings.ClipMode,
                Days = settings.ClipDays,
                Fallback = settings.ClipFallback
            });
            if (data == null)
            {
                if (isCommand)
                    await _messageSender.SendMessageAsync(channel, messages.GetMessage("so_cmd", "user_not_found", lang, targetUser));
                return;
            }

            // Se marca antes de lo lento (descarga), así dos pedidos seguidos no hacen dos shoutouts
            RegisterCooldown(channel, targetUser);

            string? clipLocalPath = null;
            if (!string.IsNullOrEmpty(data.ClipUrl))
            {
                var download = await _clipDownloadService.DownloadClipAsync(data.ClipUrl!, targetUser);
                if (download.Success) clipLocalPath = download.LocalPath;
                else _logger.LogWarning("⚠️ No se pudo descargar clip: {Error}", download.Error);
            }

            await SaveHistoryAsync(db, channel, targetUser, trigger == Trigger.Raid ? $"raid:{executedBy}" : executedBy, data, clipLocalPath, channelUserId);

            if (settings.ChatEnabled)
                await _messageSender.SendMessageAsync(channel, BuildChatMessage(settings.ChatMessage, data, messages, lang));

            await _overlayNotificationService.SendShoutoutAsync(channel, data, clipLocalPath);

            if (settings.NativeEnabled)
                await TryNativeAsync(channel, data);

            _logger.LogInformation("✅ Shoutout completado: {Target} en {Channel} ({Trigger}, clip: {HasClip})", targetUser, channel, trigger, clipLocalPath != null ? "Sí" : "No");
        }

        /// <summary>Raid recibido: shoutout automático si está prendido y llega al mínimo de espectadores.</summary>
        public async Task HandleRaidAsync(string channel, string fromLogin, int viewers)
        {
            try
            {
                channel = channel.ToLowerInvariant();
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var json = await db.ShoutoutConfigs.AsNoTracking().Where(c => c.Username == channel).Select(c => c.Settings).FirstOrDefaultAsync();
                var settings = ShoutoutSettings.Parse(json);
                if (!settings.RaidEnabled || viewers < settings.RaidMinViewers) return;

                _logger.LogInformation("🚀 [SHOUTOUT] Automático por raid de {From} ({Viewers}) en {Channel}, en {Delay}s", fromLogin, viewers, channel, settings.RaidDelaySeconds);
                if (settings.RaidDelaySeconds > 0) await Task.Delay(TimeSpan.FromSeconds(settings.RaidDelaySeconds));
                await RunAsync(channel, fromLogin, "raid", Trigger.Raid);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SHOUTOUT] Error en el shoutout automático por raid de {From} en {Channel}", fromLogin, channel);
            }
        }

        private async Task TryNativeAsync(string channel, ShoutoutData data)
        {
            var now = DateTime.UtcNow;
            var targetKey = $"{channel}|{data.Username}";
            // Límites de Twitch: mejor no pedirlo que recibir un error
            if (_nativeByChannel.TryGetValue(channel, out var lastChannel) && now - lastChannel < TimeSpan.FromMinutes(2))
            {
                _lastNative[channel] = new NativeResult(now, false, 429, "channel_cooldown", data.Username);
                return;
            }
            if (_nativeByTarget.TryGetValue(targetKey, out var lastTarget) && now - lastTarget < TimeSpan.FromMinutes(60))
            {
                _lastNative[channel] = new NativeResult(now, false, 429, "target_cooldown", data.Username);
                return;
            }

            var broadcaster = await _twitchApiService.GetUserByLoginAsync(channel);
            if (broadcaster == null) return;
            var (ok, status, error) = await _twitchApiService.SendNativeShoutoutAsync(broadcaster.id, data.UserId);
            _lastNative[channel] = new NativeResult(now, ok, status, error, data.Username);
            if (ok)
            {
                _nativeByChannel[channel] = now;
                _nativeByTarget[targetKey] = now;
            }
        }

        /// <summary>El mensaje del chat: el del streamer con variables, o el de siempre.</summary>
        public static string BuildChatMessage(string template, ShoutoutData data, ICommandMessagesService messages, string lang)
        {
            if (!string.IsNullOrWhiteSpace(template))
            {
                var values = new (string Key, string Value)[]
                {
                    ("@displayname", string.IsNullOrEmpty(data.DisplayName) ? data.Username : data.DisplayName),
                    ("@username", data.Username),
                    ("@game", data.GameName),
                    ("@title", data.Title),
                    ("@tags", string.Join(" · ", data.Tags)),
                    ("@followers", data.Followers?.ToString("N0", new System.Globalization.CultureInfo("es")) ?? ""),
                    ("@clipTitle", data.ClipTitle ?? ""),
                    ("@clipViews", data.ClipViews?.ToString("N0", new System.Globalization.CultureInfo("es")) ?? ""),
                    ("@clipCreator", data.ClipCreator ?? ""),
                    ("@url", $"twitch.tv/{data.Username}"),
                };
                return values.Aggregate(template, (s, v) => s.Replace(v.Key, v.Value, StringComparison.Ordinal));
            }
            if (!string.IsNullOrEmpty(data.GameName) && data.GameName != "Sin categoría")
                return messages.GetMessage("so_cmd", "message_with_game", lang, data.Username, data.GameName, data.Username);
            return messages.GetMessage("so_cmd", "message_no_game", lang, data.Username, data.Username);
        }

        private static bool IsBlacklisted(string? json, string target)
        {
            if (string.IsNullOrWhiteSpace(json) || json == "[]") return false;
            try
            {
                var list = System.Text.Json.JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
                return list.Any(u => u.Equals(target, StringComparison.OrdinalIgnoreCase));
            }
            catch { return false; }
        }

        private static TimeSpan RemainingCooldown(string channel, string target, TimeSpan cooldown)
        {
            if (cooldown <= TimeSpan.Zero) return TimeSpan.Zero;
            if (_cooldowns.TryGetValue(channel, out var byTarget) && byTarget.TryGetValue(target, out var last))
            {
                var left = last + cooldown - DateTime.UtcNow;
                return left > TimeSpan.Zero ? left : TimeSpan.Zero;
            }
            return TimeSpan.Zero;
        }

        private static void RegisterCooldown(string channel, string target) =>
            _cooldowns.GetOrAdd(channel, _ => new ConcurrentDictionary<string, DateTime>())[target] = DateTime.UtcNow;

        private async Task SaveHistoryAsync(DecatronDbContext db, string channel, string target, string executedBy, ShoutoutData data, string? clipLocalPath, long? channelUserId)
        {
            try
            {
                if (channelUserId == null || channelUserId == 0)
                {
                    _logger.LogWarning("⚠️ No se pudo guardar historial de shoutout: ChannelUserId no disponible para {Channel}", channel);
                    return;
                }
                db.Set<ShoutoutHistory>().Add(new ShoutoutHistory
                {
                    ChannelName = channel,
                    TargetUser = target,
                    ExecutedBy = executedBy.Length > 100 ? executedBy[..100] : executedBy,
                    ClipUrl = data.ClipUrl,
                    ClipId = data.ClipId,
                    ClipLocalPath = clipLocalPath,
                    ProfileImageUrl = data.ProfileImageUrl,
                    GameName = data.GameName,
                    ExecutedAt = DateTime.UtcNow,
                    UserId = channelUserId.Value
                });
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando historial de shoutout");
            }
        }
    }
}
