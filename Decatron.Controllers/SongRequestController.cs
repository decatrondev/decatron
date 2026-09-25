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
        private readonly DownloadsDesktopChannel _downloads;

        /// <summary>Tope del JSON del editor: sobra para dos layouts con plantillas.</summary>
        private const int MaxOverlayConfigLength = 300_000;

        public SongRequestController(SongResolverService resolver, SongRequestService songs, DecatronDbContext db, ICommandMessagesService messages, SongRequestLibraryService library, DownloadsDesktopChannel downloads)
        {
            _downloads = downloads;
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
            var userId = await _songs.GetQueueOwnerIdAsync(this.GetChannelOwnerId(), ct);
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
                platforms = await _songs.GetQueuePlatformsAsync(userId, ct),
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
            var userId = await _songs.GetQueueOwnerIdAsync(this.GetChannelOwnerId(), ct);
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
            /// <summary>user: de qué chat es (twitch | kick). La cola es una sola para los dos.</summary>
            public string? Platform { get; set; }
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
                var platform = body.Platform == "kick" ? "kick" : "twitch";
                await _songs.BanAsync(config.UserId, "user", $"{platform}:{login}", login, by, ct);
                await _songs.RemoveAllByUserAsync(config, platform, login, ct);
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

        // ── Descargas (fase 5): corren en Decatron Desktop, en la PC del streamer ──

        private static readonly string[] VideoFormats = { "mp4", "webm" };
        private static readonly string[] AudioFormats = { "mp3", "m4a", "opus", "wav" };
        private static readonly string[] AudioQualities = { "best", "320", "256", "192", "128" };
        private static readonly int[] Heights = { 4320, 2160, 1440, 1080, 720, 480, 360, 240, 144 };
        private static readonly System.Text.RegularExpressions.Regex LangRegex = new("^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})?$");

        [HttpGet("api/song-request/downloads")]
        [RequirePermission("overlays")]
        public IActionResult Downloads()
        {
            var userId = this.GetChannelOwnerId();
            var status = _downloads.GetStatus(userId);
            return Ok(new
            {
                success = true,
                connected = _downloads.IsConnected(userId),
                // Conectada pero sin estado = una versión de la app sin el módulo de descargas
                supported = status != null,
                appVersion = _downloads.AppVersion(userId),
                status = status == null ? (JsonElement?)null : JsonDocument.Parse(status.ToJsonString()).RootElement.Clone(),
                jobs = _downloads.GetJobs(userId)
            });
        }

        [HttpPost("api/song-request/downloads/probe")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ProbeDownload([FromBody] AddRequest body, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(body.Input) || body.Input.Length > 500)
                return BadRequest(new { success = false, error = "invalid_input" });
            var userId = this.GetChannelOwnerId();
            if (!_downloads.IsConnected(userId))
                return Ok(new { success = false, error = "desktop_offline" });

            var (url, origin, error) = await _resolver.ResolveDownloadUrlAsync(body.Input, ct);
            if (url == null)
                return Ok(new { success = false, error = SongRequestService.ErrorKeyFor(error) });

            var result = await _downloads.ProbeAsync(userId, url, ct);
            if (result == null)
                return Ok(new { success = false, error = "desktop_timeout" });
            if (result["ok"]?.GetValue<bool>() != true)
                return Ok(new { success = false, error = result["error"]?.GetValue<string>() ?? "probe_failed" });

            return Ok(new
            {
                success = true,
                url,
                info = JsonDocument.Parse(result["info"]?.ToJsonString() ?? "{}").RootElement.Clone(),
                origin = origin == null ? null : new { source = origin.Origin, url = origin.Url, title = origin.Title, artist = origin.Artist, thumbnailUrl = origin.ThumbnailUrl }
            });
        }

        public sealed class StartDownloadRequest
        {
            public string Url { get; set; } = "";
            public string Title { get; set; } = "";
            public string Kind { get; set; } = "video";
            public string Format { get; set; } = "mp4";
            public int? MaxHeight { get; set; }
            public string AudioQuality { get; set; } = "best";
            public double? TrimStart { get; set; }
            public double? TrimEnd { get; set; }
            public bool Thumbnail { get; set; }
            public string[]? Subtitles { get; set; }
        }

        [HttpPost("api/song-request/downloads")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> StartDownload([FromBody] StartDownloadRequest b)
        {
            // La app vuelve a validar todo: esto termina en un proceso en la PC del streamer
            if (!Uri.TryCreate(b.Url, UriKind.Absolute, out var uri) || (uri.Scheme != "https" && uri.Scheme != "http") || b.Url.Length > 1000)
                return BadRequest(new { success = false, error = "invalid_url" });
            var audio = b.Kind == "audio";
            if (!(audio ? AudioFormats : VideoFormats).Contains(b.Format)) return BadRequest(new { success = false, error = "invalid_format" });
            if (b.MaxHeight != null && !Heights.Contains(b.MaxHeight.Value)) return BadRequest(new { success = false, error = "invalid_quality" });
            if (!AudioQualities.Contains(b.AudioQuality)) return BadRequest(new { success = false, error = "invalid_quality" });
            if (b.TrimStart is < 0 || b.TrimEnd is < 0 || (b.TrimStart != null && b.TrimEnd != null && b.TrimEnd <= b.TrimStart))
                return BadRequest(new { success = false, error = "invalid_trim" });
            var subs = (b.Subtitles ?? Array.Empty<string>()).Where(x => x != null && LangRegex.IsMatch(x)).Distinct().Take(5).ToArray();

            var userId = this.GetChannelOwnerId();
            var jobId = await _downloads.StartAsync(userId, b.Title ?? "", new
            {
                url = uri.ToString(), kind = audio ? "audio" : "video", format = b.Format,
                maxHeight = audio ? null : b.MaxHeight, audioQuality = b.AudioQuality,
                trimStart = b.TrimStart, trimEnd = b.TrimEnd, thumbnail = b.Thumbnail, subtitles = audio ? Array.Empty<string>() : subs
            });
            return jobId == null ? Ok(new { success = false, error = "desktop_offline" }) : Ok(new { success = true, jobId });
        }

        [HttpPost("api/song-request/downloads/{jobId}/cancel")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> CancelDownload(string jobId) =>
            Ok(new { success = await _downloads.SendAsync(this.GetChannelOwnerId(), "cancel", new { jobId }) });

        public sealed class OpenFolderRequest { public string? JobId { get; set; } }

        /// <summary>Abre la carpeta (o muestra el archivo) en la PC donde corre la app.</summary>
        [HttpPost("api/song-request/downloads/open-folder")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> OpenDownloadFolder([FromBody] OpenFolderRequest body) =>
            Ok(new { success = await _downloads.SendAsync(this.GetChannelOwnerId(), "openFolder", new { jobId = body.JobId }) });

        [HttpPost("api/song-request/downloads/clear")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ClearDownloads() =>
            Ok(new { success = await _downloads.SendAsync(this.GetChannelOwnerId(), "clear", new { }) });

        private async Task<SongRequestConfig?> OwnConfigAsync(CancellationToken ct)
        {
            var userId = await _songs.GetQueueOwnerIdAsync(this.GetChannelOwnerId(), ct);
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
            // Un canal solo de Kick tiene login "kick_<id>": su cola se encuentra por el nombre guardado en la config
            var configOwner = await _db.SongRequestConfigs.AsNoTracking()
                .Where(c => c.ChannelName == login)
                .Select(c => (long?)c.UserId)
                .FirstOrDefaultAsync(ct);
            var user = await _db.Users.AsNoTracking()
                .Where(u => u.IsActive && (configOwner != null ? u.Id == configOwner : u.Login == login))
                .Select(u => new
                {
                    u.Id,
                    DisplayName = u.KickId != null ? (u.KickUsername ?? u.DisplayName) : u.DisplayName,
                    ProfileImageUrl = u.KickId != null ? (u.KickProfilePic ?? u.ProfileImageUrl) : u.ProfileImageUrl
                })
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
