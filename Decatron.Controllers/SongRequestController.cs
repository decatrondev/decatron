using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Controllers.Extensions;
using Decatron.Core.Helpers;
using Decatron.Core.Models.SongRequest;
using Decatron.Data;
using Decatron.Services;
using Decatron.Services.SongRequest;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>Song Request (.dev/plans/SONG_REQUEST_PLAN.md).</summary>
    [ApiController]
    [Authorize]
    public class SongRequestController : ControllerBase
    {
        private static readonly string[] Roles = { "everyone", "subscriber", "vip", "moderator", "lead_moderator", "broadcaster" };

        private readonly SongResolverService _resolver;
        private readonly SongRequestService _songs;
        private readonly DecatronDbContext _db;
        private readonly ICommandMessagesService _messages;
        private readonly SongRequestLibraryService _library;

        /// <summary>Tope del JSON del editor: sobra para dos layouts con plantillas.</summary>
        private const int MaxOverlayConfigLength = 300_000;

        public SongRequestController(SongResolverService resolver, SongRequestService songs, DecatronDbContext db, ICommandMessagesService messages, SongRequestLibraryService library)
        {
            _library = library;
            _resolver = resolver;
            _songs = songs;
            _db = db;
            _messages = messages;
        }

        // ── Dashboard ────────────────────────────────────────────────────────

        [HttpGet("api/song-request/config")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetConfig(CancellationToken ct)
        {
            var userId = this.GetChannelOwnerId();
            var channel = await ChannelResolver.ResolveChannelInfoByIdAsync(_db, userId);
            if (channel == null)
                return NotFound(new { success = false });

            var config = await _songs.GetOrCreateConfigAsync(userId, channel.Login, ct);
            var key = await _songs.GetOrCreatePlayerKeyAsync(config, ct: ct);
            var language = await _db.Users.AsNoTracking().Where(u => u.Id == userId)
                .Select(u => u.PreferredLanguage).FirstOrDefaultAsync(ct) ?? "es";

            return Ok(new
            {
                success = true,
                channel = channel.Login,
                publicUrl = _songs.PublicQueueUrl(channel.Login),
                playerKey = key,
                enabled = config.Enabled,
                requestsOpen = config.RequestsOpen,
                paused = config.IsPaused,
                volume = config.Volume,
                settings = SongRequestService.ParseSettings(config),
                overlayConfig = ParseJson(config.OverlayConfig),
                commands = SongRequestChatHandler.CommandNames,
                messageDefaults = SongRequestChatHandler.MessageKeys
                    .ToDictionary(k => k, k => _messages.GetMessage("songrequest", k, language))
            });
        }

        public sealed class SaveConfigRequest
        {
            public bool? Enabled { get; set; }
            public bool? RequestsOpen { get; set; }
            public SongRequestSettings? Settings { get; set; }
            /// <summary>Lo que arma el editor. El backend solo lo guarda.</summary>
            public JsonElement? OverlayConfig { get; set; }
        }

        [HttpPut("api/song-request/config")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveConfig([FromBody] SaveConfigRequest body, CancellationToken ct)
        {
            var userId = this.GetChannelOwnerId();
            var channel = await ChannelResolver.ResolveChannelInfoByIdAsync(_db, userId);
            if (channel == null)
                return NotFound(new { success = false });

            var config = await _songs.GetOrCreateConfigAsync(userId, channel.Login, ct);
            if (body.Enabled.HasValue) config.Enabled = body.Enabled.Value;
            if (body.RequestsOpen.HasValue) config.RequestsOpen = body.RequestsOpen.Value;
            if (body.Settings != null)
            {
                var error = Validate(body.Settings);
                if (error != null)
                    return BadRequest(new { success = false, error });
                config.Settings = JsonSerializer.Serialize(body.Settings);
            }
            if (body.OverlayConfig is { ValueKind: JsonValueKind.Object } overlay)
            {
                var raw = overlay.GetRawText();
                if (raw.Length > MaxOverlayConfigLength)
                    return BadRequest(new { success = false, error = "overlay_config_too_large" });
                config.OverlayConfig = raw;
            }
            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await _songs.NotifyAsync(config, ct);
            if (body.OverlayConfig.HasValue)
                await _songs.NotifyConfigChangedAsync(config, ct);
            return Ok(new { success = true });
        }

        private static string? Validate(SongRequestSettings s)
        {
            var p = s.Permissions ?? new SongRequestPermissions();
            if (new[] { p.Request, p.Skip, p.Manage }.Any(r => !Roles.Contains(r)))
                return "invalid_role";
            s.Permissions = p;
            s.MaxQueueSize = Math.Clamp(s.MaxQueueSize, 0, 500);
            s.MaxPerUser = Math.Clamp(s.MaxPerUser, 0, 100);
            s.SkipVotesRequired = Math.Clamp(s.SkipVotesRequired, 1, 1000);
            s.QueuePreviewCount = Math.Clamp(s.QueuePreviewCount, 1, 10);
            s.MaxDurationSeconds = Math.Clamp(s.MaxDurationSeconds, 0, 6 * 3600);
            s.MinViews = Math.Clamp(s.MinViews, 0, 10_000_000_000);
            s.NoRepeatMinutes = Math.Clamp(s.NoRepeatMinutes, 0, 7 * 24 * 60);
            s.Messages ??= new();
            if (s.Messages.Values.Any(m => m != null && m.Length > 400))
                return "message_too_long";
            return null;
        }

        [HttpPost("api/song-request/player-key/regenerate")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> RegenerateKey(CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null)
                return NotFound(new { success = false });
            // El reproductor viejo sigue conectado hasta que se recargue; la URL vieja ya no registra uno nuevo
            var key = await _songs.GetOrCreatePlayerKeyAsync(config, regenerate: true, ct);
            return Ok(new { success = true, playerKey = key });
        }

        public sealed class ControlRequest
        {
            /// <summary>pause | resume | skip | open | close | volume</summary>
            public string Action { get; set; } = "";
            public int? Value { get; set; }
        }

        /// <summary>El control remoto del dashboard.</summary>
        [HttpPost("api/song-request/control")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Control([FromBody] ControlRequest body, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null)
                return NotFound(new { success = false });

            switch (body.Action)
            {
                case "pause": await _songs.SetPausedAsync(config, true, ct); break;
                case "resume": await _songs.SetPausedAsync(config, false, ct); break;
                case "skip": await _songs.AdvanceAsync(config, "skipped", ct); break;
                case "open": await _songs.SetOpenAsync(config, true, ct); break;
                case "close": await _songs.SetOpenAsync(config, false, ct); break;
                case "volume" when body.Value.HasValue: await _songs.SetVolumeAsync(config, body.Value.Value, ct); break;
                default: return BadRequest(new { success = false, error = "invalid_action" });
            }
            return Ok(new { success = true });
        }

        public sealed class AddRequest
        {
            public string Input { get; set; } = "";
        }

        /// <summary>Agregar desde el dashboard: sin límites, a nombre de quien está logueado.</summary>
        [HttpPost("api/song-request/queue")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Add([FromBody] AddRequest body, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(body.Input) || body.Input.Length > 500)
                return BadRequest(new { success = false, error = "invalid_input" });
            var config = await OwnConfigAsync(ct);
            if (config == null)
                return NotFound(new { success = false });

            var me = await _db.Users.AsNoTracking().Where(u => u.Id == this.GetAuthenticatedUserId())
                .Select(u => new { u.Login, u.DisplayName }).FirstOrDefaultAsync(ct);
            var requester = new SongRequester(SongRequestPlatforms.Dashboard, null, me?.Login ?? config.ChannelName, me?.DisplayName ?? config.ChannelName);
            var result = await _songs.AddAsync(config, requester, body.Input, unlimited: true, ct);
            return Ok(result.Success
                ? new { success = true, error = (string?)null, position = result.Position }
                : new { success = false, error = result.ErrorKey, position = 0 });
        }

        public sealed class ReorderRequest
        {
            public long[] Ids { get; set; } = Array.Empty<long>();
        }

        [HttpPut("api/song-request/queue/order")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Reorder([FromBody] ReorderRequest body, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null)
                return NotFound(new { success = false });
            await _songs.ReorderAsync(config, body.Ids, ct);
            return Ok(new { success = true });
        }

        [HttpDelete("api/song-request/queue/{id:long}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Remove(long id, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null)
                return NotFound(new { success = false });
            var removed = await _songs.RemoveByIdAsync(config, id, ct);
            return removed == null ? NotFound(new { success = false }) : Ok(new { success = true });
        }

        public sealed class BanRequest
        {
            /// <summary>track | author | user</summary>
            public string Type { get; set; } = "";
        }

        /// <summary>Vetar la canción, su autor o a quien la pidió. Si era la que sonaba, se salta; si estaba en cola, se quita.</summary>
        [HttpPost("api/song-request/queue/{id:long}/ban")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Ban(long id, [FromBody] BanRequest body, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null)
                return NotFound(new { success = false });
            var item = await _songs.GetItemAsync(config.UserId, id, ct);
            if (item?.Track == null)
                return NotFound(new { success = false });

            var by = await _db.Users.AsNoTracking().Where(u => u.Id == this.GetAuthenticatedUserId())
                .Select(u => u.Login).FirstOrDefaultAsync(ct);
            var track = item.Track;
            switch (body.Type)
            {
                case "track":
                    await _songs.BanAsync(config.UserId, "track", $"{track.Source}:{track.SourceId}", track.Title, by, ct);
                    break;
                case "author" when track.AuthorId != null:
                    await _songs.BanAsync(config.UserId, "author", $"{track.Source}:{track.AuthorId}", track.Artist, by, ct);
                    break;
                case "user" when item.RequestedPlatform is not (SongRequestPlatforms.Dashboard or SongRequestPlatforms.Fallback):
                    await _songs.BanAsync(config.UserId, "user", $"{item.RequestedPlatform}:{item.RequestedByLogin}", item.RequestedByLogin, by, ct);
                    await _songs.RemoveAllByUserAsync(config, item.RequestedPlatform, item.RequestedByLogin, ct);
                    break;
                default:
                    return BadRequest(new { success = false, error = "invalid_type" });
            }

            if (item.Status == "playing")
                await _songs.AdvanceIfCurrentAsync(config, item.Id, "skipped", ct);
            else if (body.Type != "user")
                await _songs.RemoveByIdAsync(config, item.Id, ct);
            return Ok(new { success = true });
        }

        // ── Historial ────────────────────────────────────────────────────────

        [HttpGet("api/song-request/history")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> History([FromQuery] int page = 0, [FromQuery] bool favorites = false, CancellationToken ct = default)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return Ok(new { success = true, data = await _library.GetHistoryAsync(config.UserId, page, 30, favorites, ct) });
        }

        public sealed class FavoriteRequest { public bool Value { get; set; } }

        [HttpPost("api/song-request/history/{id:long}/favorite")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Favorite(long id, [FromBody] FavoriteRequest body, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return await _library.SetFavoriteAsync(config.UserId, id, body.Value, ct) ? Ok(new { success = true }) : NotFound(new { success = false });
        }

        /// <summary>Volver a encolar algo del historial, a nombre de quien está logueado.</summary>
        [HttpPost("api/song-request/history/{id:long}/requeue")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Requeue(long id, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            var row = config == null ? null : await _library.GetHistoryItemAsync(config.UserId, id, ct);
            if (config == null || row?.Track == null) return NotFound(new { success = false });
            var url = _resolver.GetSource(row.Track.Source)?.GetPublicUrl(row.Track.SourceId) ?? "";
            return await Add(new AddRequest { Input = url }, ct);
        }

        [HttpPost("api/song-request/history/{id:long}/fallback")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> HistoryToFallback(long id, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            var row = config == null ? null : await _library.GetHistoryItemAsync(config.UserId, id, ct);
            if (config == null || row?.Track == null) return NotFound(new { success = false });
            var error = await _library.AddToFallbackAsync(config.UserId, row.Track, ct);
            return Ok(new { success = error == null, error });
        }

        [HttpDelete("api/song-request/history")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ClearHistory(CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return Ok(new { success = true, removed = await _library.ClearHistoryAsync(config.UserId, ct) });
        }

        // ── Playlist de respaldo ─────────────────────────────────────────────

        [HttpGet("api/song-request/fallback")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Fallback(CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return Ok(new { success = true, items = await _library.GetFallbackAsync(config.UserId, ct), max = SongRequestLibraryService.MaxFallbackItems });
        }

        [HttpPost("api/song-request/fallback")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> AddFallback([FromBody] AddRequest body, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(body.Input) || body.Input.Length > 500)
                return BadRequest(new { success = false, error = "invalid_input" });
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            var error = await _library.AddToFallbackAsync(config.UserId, body.Input, ct);
            return Ok(new { success = error == null, error });
        }

        public sealed class ImportRequest { public string Url { get; set; } = ""; }

        [HttpPost("api/song-request/fallback/import")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ImportFallback([FromBody] ImportRequest body, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(body.Url) || body.Url.Length > 500)
                return BadRequest(new { success = false, error = "invalid_input" });
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            var (added, skipped, error) = await _library.ImportPlaylistAsync(config.UserId, body.Url, ct);
            return Ok(new { success = error == null, error, added, skipped });
        }

        [HttpDelete("api/song-request/fallback/{id:long}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> RemoveFallback(long id, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return await _library.RemoveFromFallbackAsync(config.UserId, id, ct) ? Ok(new { success = true }) : NotFound(new { success = false });
        }

        [HttpDelete("api/song-request/fallback")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ClearFallback(CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return Ok(new { success = true, removed = await _library.ClearFallbackAsync(config.UserId, ct) });
        }

        [HttpPut("api/song-request/fallback/order")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ReorderFallback([FromBody] ReorderRequest body, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            await _library.ReorderFallbackAsync(config.UserId, body.Ids, ct);
            return Ok(new { success = true });
        }

        // ── Listas negras ────────────────────────────────────────────────────

        [HttpGet("api/song-request/bans")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Bans(CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return Ok(new { success = true, items = await _library.GetBansAsync(config.UserId, ct) });
        }

        public sealed class AddBanRequest
        {
            /// <summary>track | author | user</summary>
            public string Type { get; set; } = "";
            /// <summary>track/author: link o nombre de una canción; user: el usuario del chat.</summary>
            public string Value { get; set; } = "";
        }

        [HttpPost("api/song-request/bans")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> AddBan([FromBody] AddBanRequest body, CancellationToken ct)
        {
            var value = body.Value?.Trim() ?? "";
            if (value.Length == 0 || value.Length > 500)
                return BadRequest(new { success = false, error = "invalid_input" });
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            var by = await _db.Users.AsNoTracking().Where(u => u.Id == this.GetAuthenticatedUserId()).Select(u => u.Login).FirstOrDefaultAsync(ct);

            if (body.Type == "user")
            {
                var login = value.TrimStart('@').ToLowerInvariant();
                if (login.Length > 50 || login.Contains(' '))
                    return Ok(new { success = false, error = "invalid_user" });
                await _songs.BanAsync(config.UserId, "user", $"twitch:{login}", login, by, ct);
                await _songs.RemoveAllByUserAsync(config, "twitch", login, ct);
                return Ok(new { success = true, error = (string?)null });
            }

            if (body.Type is not ("track" or "author"))
                return BadRequest(new { success = false, error = "invalid_type" });

            var resolved = await _resolver.ResolveAsync(value, ct);
            if (!resolved.Success)
                return Ok(new { success = false, error = SongRequestService.ErrorKeyFor(resolved.Error) });
            var track = resolved.Track!;
            if (body.Type == "track")
            {
                await _songs.BanAsync(config.UserId, "track", $"{track.Source}:{track.SourceId}", track.Title, by, ct);
            }
            else
            {
                if (track.AuthorId == null)
                    return Ok(new { success = false, error = "author_unknown" });
                await _songs.BanAsync(config.UserId, "author", $"{track.Source}:{track.AuthorId}", track.Artist, by, ct);
            }
            return Ok(new { success = true, error = (string?)null });
        }

        [HttpDelete("api/song-request/bans/{id:long}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> RemoveBan(long id, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return await _library.RemoveBanAsync(config.UserId, id, ct) ? Ok(new { success = true }) : NotFound(new { success = false });
        }

        private async Task<SongRequestConfig?> OwnConfigAsync(CancellationToken ct)
        {
            var userId = this.GetChannelOwnerId();
            var channel = await ChannelResolver.ResolveChannelInfoByIdAsync(_db, userId);
            return channel == null ? null : await _songs.GetOrCreateConfigAsync(userId, channel.Login, ct);
        }

        private static JsonElement ParseJson(string? json)
        {
            try
            {
                using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
                return doc.RootElement.Clone();
            }
            catch (JsonException)
            {
                using var empty = JsonDocument.Parse("{}");
                return empty.RootElement.Clone();
            }
        }

        /// <summary>Lo mismo que hará !sr: sirve para probar un link y para "agregar" desde el dashboard.</summary>
        [HttpGet("api/song-request/resolve")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Resolve([FromQuery] string input, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(input) || input.Length > 500)
                return BadRequest(new { success = false, error = "invalid_input" });

            var result = await _resolver.ResolveAsync(input, ct);
            var origin = result.Origin == null ? null : new
            {
                source = result.Origin.Origin,
                url = result.Origin.Url,
                title = result.Origin.Title,
                artist = result.Origin.Artist,
                durationSeconds = result.Origin.DurationSeconds,
                thumbnailUrl = result.Origin.ThumbnailUrl
            };

            if (!result.Success)
                return Ok(new { success = false, error = SongRequestService.ErrorKeyFor(result.Error), origin });

            var track = result.Track!;
            return Ok(new
            {
                success = true,
                track = new
                {
                    source = track.Source,
                    sourceId = track.SourceId,
                    url = _resolver.GetSource(track.Source)?.GetPublicUrl(track.SourceId),
                    title = track.Title,
                    artist = track.Artist,
                    durationSeconds = track.DurationSeconds,
                    viewCount = track.ViewCount,
                    thumbnailUrl = track.ThumbnailUrl
                },
                origin
            });
        }

        // ── Cola pública (/sr/{canal}) ───────────────────────────────────────

        [AllowAnonymous]
        [HttpGet("api/public/song-request/{channel}")]
        public async Task<IActionResult> GetPublicQueue(string channel, CancellationToken ct)
        {
            var login = channel.Trim().ToLowerInvariant();
            var user = await _db.Users.AsNoTracking()
                .Where(u => u.IsActive && u.Login == login)
                .Select(u => new { u.Id, u.Login, u.DisplayName, u.ProfileImageUrl })
                .FirstOrDefaultAsync(ct);
            if (user == null)
                return NotFound(new { success = false });

            var config = await _songs.GetConfigAsync(user.Id, ct);
            if (config == null || !config.Enabled)
                return Ok(new { success = true, displayName = user.DisplayName, avatarUrl = user.ProfileImageUrl, state = (object?)null });

            return Ok(new
            {
                success = true,
                displayName = user.DisplayName,
                avatarUrl = user.ProfileImageUrl,
                state = await _songs.BuildSnapshotAsync(config, ct)
            });
        }

        /// <summary>El diseño de los overlays (OBS no inicia sesión). No trae la clave del reproductor.</summary>
        [AllowAnonymous]
        [HttpGet("api/public/song-request/{channel}/overlay")]
        public async Task<IActionResult> GetOverlayConfig(string channel, CancellationToken ct)
        {
            var login = channel.Trim().ToLowerInvariant();
            var config = await _db.SongRequestConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.ChannelName == login, ct);
            if (config == null)
                return NotFound(new { success = false });
            return Ok(new { success = true, overlayConfig = ParseJson(config.OverlayConfig) });
        }
    }
}
