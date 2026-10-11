using System.Collections.Concurrent;
using Decatron.Core.Models;
using Decatron.Core.Models.ClipCommand;
using Decatron.Core.Settings;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Decatron.Services.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.ClipCommand
{
    /// <summary>
    /// Lógica de !clip (plan: .dev/plans/CLIP_COMANDO_PLAN.md). Valida, crea el clip en Twitch con el token del
    /// streamer, espera a que exista, lo anota en el historial y, si el canal lo pidió, lo baja al archivo.
    /// Devuelve el texto ya armado para el chat; null = no responder (modo silencioso de plataformas sin soporte).
    /// </summary>
    public class ClipCommandService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly TwitchApiService _twitch;
        private readonly ClipDownloadService _downloads;
        private readonly IOptionsMonitor<ClipCommandSettings> _settings;
        private readonly string _downloadsPath;
        private readonly AccountChannelResolver _accounts;
        private readonly ILogger<ClipCommandService> _logger;

        // Cooldowns en memoria: se reinician con el backend, que es aceptable para 30 s / 2 min.
        private readonly ConcurrentDictionary<long, DateTime> _lastByChannel = new();
        private readonly ConcurrentDictionary<(long, string), DateTime> _lastByUser = new();

        public ClipCommandService(
            IServiceScopeFactory scopeFactory,
            TwitchApiService twitch,
            ClipDownloadService downloads,
            IOptionsMonitor<ClipCommandSettings> settings,
            IConfiguration configuration,
            AccountChannelResolver accounts,
            ILogger<ClipCommandService> logger)
        {
            _scopeFactory = scopeFactory;
            _twitch = twitch;
            _downloads = downloads;
            _settings = settings;
            _downloadsPath = configuration["ClipSettings:DownloadsPath"] ?? "/var/www/html/decatron/clips";
            _accounts = accounts;
            _logger = logger;
        }

        // Config por canal en memoria unos segundos: este chequeo corre en cada mensaje que empieza con "!".
        private static readonly TimeSpan ConfigCacheTtl = TimeSpan.FromSeconds(20);
        private readonly ConcurrentDictionary<long, (DateTime At, ClipCommandConfig? Config)> _configCache = new();

        /// <summary>El panel llama esto al guardar para que el cambio se note de inmediato.</summary>
        public void InvalidateConfig(long channelUserId) => _configCache.TryRemove(channelUserId, out _);

        /// <summary>Config del canal si el comando está activado, o null.</summary>
        public async Task<ClipCommandConfig?> GetActiveConfigAsync(long channelUserId)
        {
            if (!_settings.CurrentValue.Enabled) return null;
            if (_configCache.TryGetValue(channelUserId, out var hit) && DateTime.UtcNow - hit.At < ConfigCacheTtl)
                return hit.Config;

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var cfg = await db.ClipCommandConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.UserId == channelUserId);
            var active = cfg is { Enabled: true } ? cfg : null;
            _configCache[channelUserId] = (DateTime.UtcNow, active);
            return active;
        }

        /// <summary>
        /// Punto de entrada del chat. Devuelve true si el mensaje era un !clip (o un alias) de un canal que lo tiene activado
        /// y ya se atendió; false si no, para que siga su camino (por ejemplo un !clip propio del streamer).
        /// </summary>
        public async Task<bool> TryHandleAsync(CommandContext ctx, IMessageSender sender)
        {
            var parts = ctx.Message.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0 || !parts[0].StartsWith('!') || ctx.ChannelUserId is not long rowUserId) return false;
            var name = parts[0].ToLowerInvariant();

            try
            {
                // En Kick la config vive en la fila principal de la cuenta (patrón multiplataforma)
                var isKick = ctx.Metadata != null && ctx.Metadata.TryGetValue("platform", out var p)
                    && string.Equals(p?.ToString(), "kick", StringComparison.OrdinalIgnoreCase);
                var configUserId = rowUserId;
                if (isKick)
                {
                    var account = await _accounts.ResolveByUserIdAsync(rowUserId);
                    if (account != null) configUserId = account.Principal.UserId;
                }

                var config = await GetActiveConfigAsync(configUserId);
                if (config == null || !MatchesName(config, name)) return false;

                var reply = await HandleAsync(ctx, parts.Length > 1 ? parts[1].Trim() : "", config,
                    text => sender.SendMessageAsync(ctx.Channel, text));
                if (reply != null) await sender.SendMessageAsync(ctx.Channel, reply);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "!clip falló en {Channel}", ctx.Channel);
                return true;
            }
        }

        private static bool MatchesName(ClipCommandConfig config, string commandName)
        {
            if (commandName == "!clip") return true;
            var bare = commandName[1..];
            return config.Aliases
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Any(a => string.Equals(a.TrimStart('!'), bare, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Atiende un !clip. <paramref name="args"/> es lo que viene después del comando.
        /// </summary>
        public async Task<string?> HandleAsync(CommandContext ctx, string args, ClipCommandConfig config, Func<string, Task>? sendInterim = null)
        {
            var lang = config.Language == "en" ? "en" : "es";
            var values = new Dictionary<string, object?> { ["user"] = ctx.Username };
            string Say(string key) => ClipMessages.Render(config.Messages, key, lang, values);

            var platform = ctx.Metadata != null && ctx.Metadata.TryGetValue("platform", out var p) ? p?.ToString() ?? "twitch" : "twitch";
            if (!string.Equals(platform, "twitch", StringComparison.OrdinalIgnoreCase))
                return config.UnsupportedPlatformMode == "silent" ? null : Say(ClipMessages.UnsupportedPlatform);

            if (ctx.ChannelUserId is not long channelUserId || string.IsNullOrEmpty(ctx.ChannelTwitchId))
            {
                _logger.LogWarning("!clip sin canal resuelto: {Channel}", ctx.Channel);
                return Say(ClipMessages.Failed);
            }

            var role = RoleOf(ctx);
            var isStaff = Array.IndexOf(ClipRoles.Ordered, role) >= Array.IndexOf(ClipRoles.Ordered, ClipRoles.Moderator);

            // 1. Bloqueados
            using (var scope = _scopeFactory.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                if (await db.ClipCommandBlocks.AnyAsync(b => b.UserId == channelUserId && b.TwitchUserId == ctx.UserId))
                    return Say(ClipMessages.Blocked);
            }

            // 2. Rango mínimo
            if (!await MeetsRoleAsync(ctx, config, role))
            {
                values["role"] = RoleLabel(config.MinRole, lang);
                return Say(ClipMessages.NoPermission);
            }

            // 3. Argumentos: duración y título según lo que el canal permita
            var parsed = ClipArgsParser.Parse(args);
            decimal duration = config.DefaultDuration;
            if (parsed.Duration.HasValue)
            {
                if (!config.AllowViewerDuration && !isStaff) return Say(ClipMessages.DurationNotAllowed);
                if (parsed.Duration < config.MinDuration || parsed.Duration > config.MaxDuration)
                {
                    values["min"] = Trim(config.MinDuration);
                    values["max"] = Trim(config.MaxDuration);
                    return Say(ClipMessages.DurationRange);
                }
                duration = Math.Round(parsed.Duration.Value, 1);
            }
            if (!string.IsNullOrWhiteSpace(parsed.Title))
            {
                if (!config.AllowTitle) return Say(ClipMessages.TitleNotAllowed);
                if (parsed.Title.Length > config.MaxTitleLength)
                {
                    values["limit"] = config.MaxTitleLength;
                    return Say(ClipMessages.TitleTooLong);
                }
            }

            // 4. Cooldowns (se reservan al empezar para que dos !clip seguidos no pasen a la vez)
            var now = DateTime.UtcNow;
            var userKey = (channelUserId, ctx.UserId);
            var skipUser = isStaff && config.StaffSkipUserCooldown;
            if (_lastByChannel.TryGetValue(channelUserId, out var lastChannel))
            {
                var left = Remaining(lastChannel, config.GlobalCooldownSeconds, now);
                if (left > 0) { values["seconds"] = left; return Say(ClipMessages.CooldownGlobal); }
            }
            if (!skipUser && _lastByUser.TryGetValue(userKey, out var lastUser))
            {
                var left = Remaining(lastUser, config.UserCooldownSeconds, now);
                if (left > 0) { values["seconds"] = left; return Say(ClipMessages.CooldownUser); }
            }

            // 5. ¿Está en vivo? Se mira antes para no gastar la llamada de crear (y de paso saber desde cuándo)
            var stream = await _twitch.GetStreamAsync(ctx.ChannelTwitchId);
            if (stream == null) return Say(ClipMessages.Offline);

            // 6. Tope por usuario en este stream
            if (config.MaxPerUserPerStream is int perStream
                && DateTime.TryParse(stream.started_at, null, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var startedAt))
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var made = await db.ClipCommandHistory.CountAsync(h =>
                    h.UserId == channelUserId && h.RequestedById == ctx.UserId
                    && h.Status == ClipCommandHistoryItem.StatusCreated && h.CreatedAt >= startedAt);
                if (made >= perStream)
                {
                    values["limit"] = perStream;
                    return Say(ClipMessages.UserLimit);
                }
            }

            _lastByChannel[channelUserId] = now;
            _lastByUser[userKey] = now;

            // 7. Crear en Twitch y esperar a que exista
            var title = string.IsNullOrWhiteSpace(parsed.Title) ? null : parsed.Title.Trim();
            var created = await _twitch.CreateClipAsync(ctx.ChannelTwitchId, title, duration);
            if (!created.Success)
            {
                await SaveAsync(channelUserId, ctx, role, title, duration, status: ClipCommandHistoryItem.StatusFailed, errorCode: created.ErrorCode);
                return Say(KeyFor(created.ErrorCode));
            }

            var clip = await WaitForClipAsync(created.ClipId!, sendInterim == null ? null : () => sendInterim(Say(ClipMessages.Waiting)));
            if (clip == null)
            {
                await SaveAsync(channelUserId, ctx, role, title, duration, ClipCommandHistoryItem.StatusFailed, created.ClipId, null, "timeout");
                return Say(ClipMessages.NotReady);
            }

            // 8. Descarga opcional al archivo de la plataforma
            var (downloaded, localPath) = await TryDownloadAsync(config, channelUserId, ctx.Channel, clip.url);

            await SaveAsync(channelUserId, ctx, role, clip.title ?? title, duration, ClipCommandHistoryItem.StatusCreated,
                clip.id, clip.url, null, downloaded, localPath);

            values["url"] = clip.url;
            values["duration"] = Trim(duration);
            values["title"] = clip.title ?? title ?? "";
            return Say(ClipMessages.Success);
        }

        // ---------------------------------------------------------------- roles

        private static string RoleOf(CommandContext c) =>
            c.IsBroadcaster ? ClipRoles.Broadcaster
            : c.IsLeadModerator ? ClipRoles.LeadModerator
            : c.IsModerator ? ClipRoles.Moderator
            : c.IsVip ? ClipRoles.Vip
            : c.IsSubscriber ? ClipRoles.Subscriber
            : ClipRoles.Everyone;

        private async Task<bool> MeetsRoleAsync(CommandContext ctx, ClipCommandConfig config, string role)
        {
            var order = ClipRoles.Ordered.ToList();
            var need = order.IndexOf(config.MinRole);
            if (need <= 0) return true;

            // "follower" no es una insignia: se consulta a Twitch. Un sub, VIP o mod ya pasan por rango.
            if (config.MinRole == ClipRoles.Follower)
            {
                if (order.IndexOf(role) >= order.IndexOf(ClipRoles.Subscriber)) return true;
                return await _twitch.IsFollowerAsync(ctx.ChannelTwitchId!, ctx.UserId) == true;
            }
            return order.IndexOf(role) >= need;
        }

        private static string RoleLabel(string role, string lang) => (role, lang) switch
        {
            (ClipRoles.Follower, "en") => "followers",
            (ClipRoles.Follower, _) => "seguidores",
            (ClipRoles.Subscriber, "en") => "subscribers",
            (ClipRoles.Subscriber, _) => "suscriptores",
            (ClipRoles.Vip, _) => "VIP",
            (ClipRoles.Moderator, "en") => "moderators",
            (ClipRoles.Moderator, _) => "moderadores",
            (ClipRoles.LeadModerator, "en") => "lead moderators",
            (ClipRoles.LeadModerator, _) => "moderadores líderes",
            (ClipRoles.Broadcaster, "en") => "the streamer",
            (ClipRoles.Broadcaster, _) => "el streamer",
            _ => role
        };

        // ---------------------------------------------------------------- helpers

        private static int Remaining(DateTime last, int cooldownSeconds, DateTime now) =>
            cooldownSeconds <= 0 ? 0 : (int)Math.Ceiling(cooldownSeconds - (now - last).TotalSeconds);

        private static string Trim(decimal d) => d.ToString("0.#", System.Globalization.CultureInfo.InvariantCulture);

        private static string KeyFor(string? code) => code switch
        {
            "offline" => ClipMessages.Offline,
            "no_scope" or "no_token" => ClipMessages.NoScope,
            "clips_disabled" => ClipMessages.ClipsDisabled,
            "clips_restricted" => ClipMessages.ClipsRestricted,
            "automod_title" => ClipMessages.AutomodTitle,
            "not_clippable" => ClipMessages.NotClippable,
            "rate_limited" => ClipMessages.RateLimited,
            "twitch_unavailable" => ClipMessages.TwitchDown,
            _ => ClipMessages.Failed
        };

        /// <summary>Twitch da el clip por fallido si a los 60 s no aparece en Get Clips.</summary>
        private async Task<TwitchClipData?> WaitForClipAsync(string clipId, Func<Task>? onSlow)
        {
            var s = _settings.CurrentValue;
            var deadline = DateTime.UtcNow.AddSeconds(Math.Clamp(s.ConfirmTimeoutSeconds, 5, 60));
            var poll = TimeSpan.FromSeconds(Math.Clamp(s.ConfirmPollSeconds, 1, 10));
            // Si Twitch tarda, se avisa una sola vez en el chat para que no parezca que no pasó nada
            var slowAt = DateTime.UtcNow.AddSeconds(Math.Clamp(s.ConfirmNoticeSeconds, 3, 30));
            var noticed = false;
            while (true)
            {
                await Task.Delay(poll);
                var clip = await _twitch.GetClipByIdAsync(clipId);
                if (clip != null) return clip;
                var now = DateTime.UtcNow;
                if (now >= deadline) return null;
                if (!noticed && onSlow != null && now >= slowAt)
                {
                    noticed = true;
                    try { await onSlow(); }
                    catch (Exception ex) { _logger.LogWarning(ex, "!clip: no se pudo enviar el aviso de espera"); }
                }
            }
        }

        private async Task<(bool, string?)> TryDownloadAsync(ClipCommandConfig config, long channelUserId, string channel, string url)
        {
            if (!config.DownloadEnabled) return (false, null);
            try
            {
                // Válvula de seguridad: poco espacio libre → solo el enlace
                var minFree = _settings.CurrentValue.MinFreeDiskGb;
                if (minFree > 0)
                {
                    var free = new DriveInfo(Path.GetFullPath(_downloadsPath)).AvailableFreeSpace;
                    if (free < (long)minFree * 1024 * 1024 * 1024)
                    {
                        _logger.LogWarning("!clip: descarga pausada, quedan {FreeGb:F1} GB libres (umbral {MinGb} GB)",
                            free / 1024d / 1024 / 1024, minFree);
                        return (false, null);
                    }
                }

                if (config.DownloadMonthlyCap is int cap)
                {
                    var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                    var done = await db.ClipCommandHistory.CountAsync(h =>
                        h.UserId == channelUserId && h.Downloaded && h.CreatedAt >= monthStart);
                    if (done >= cap) return (false, null);
                }

                var result = await _downloads.DownloadClipAsync(url, channel);
                return (result.Success, result.LocalPath);
            }
            catch (Exception ex)
            {
                // Que la descarga falle no debe tumbar el !clip: el enlace ya existe
                _logger.LogError(ex, "!clip: falló la descarga opcional de {Url}", url);
                return (false, null);
            }
        }

        private async Task SaveAsync(long channelUserId, CommandContext ctx, string role, string? title, decimal duration,
            string status, string? clipId = null, string? clipUrl = null, string? errorCode = null,
            bool downloaded = false, string? localPath = null)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                db.ClipCommandHistory.Add(new ClipCommandHistoryItem
                {
                    UserId = channelUserId,
                    ChannelName = ctx.Channel,
                    Status = status,
                    ClipId = clipId,
                    ClipUrl = clipUrl,
                    ErrorCode = errorCode,
                    Title = title?.Length > 200 ? title[..200] : title,
                    DurationSeconds = duration,
                    RequestedById = ctx.UserId,
                    RequestedByLogin = ctx.Username,
                    RequestedByRole = role,
                    Downloaded = downloaded,
                    LocalPath = localPath
                });
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "!clip: no se pudo guardar el historial de {Channel}", ctx.Channel);
            }
        }
    }
}
