using System;
using System.Collections.Generic;
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
using Decatron.Services.GameData;
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
        private readonly GameOverlayPromoService _promos;

        /// <summary>Tope del JSON del editor: sobra para dos layouts con las plantillas del plan más alto.</summary>
        private const int MaxOverlayConfigLength = 1_500_000;

        private readonly SongListenStatsService _listenStats;

        public SongRequestController(SongResolverService resolver, SongRequestService songs, DecatronDbContext db, ICommandMessagesService messages, SongRequestLibraryService library, DownloadsDesktopChannel downloads, GameOverlayPromoService promos, SongListenStatsService listenStats)
        {
            _listenStats = listenStats;
            _promos = promos;
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
                stopped = config.IsStopped,
                volume = config.Volume,
                settings = SongRequestService.ParseSettings(config),
                overlayConfig = ParseJson(config.OverlayConfig),
                limits = LimitsDto(await _library.GetLimitsAsync(userId)),
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
            var limits = await _library.GetLimitsAsync(userId);
            if (body.Settings != null)
            {
                var error = Validate(body.Settings);
                if (error != null)
                    return BadRequest(new { success = false, error });
                // La tarjeta de Decatron es lo que paga el plan gratis
                if (!limits.CanHidePromo)
                    body.Settings.ShowPromo = true;
                // El modo (revisión, de dónde se pide) se cambia al instante por su endpoint o por !srmode:
                // un Guardar con la vista abierta desde antes no lo pisa
                var current = SongRequestService.ParseSettings(config);
                body.Settings.RequestReview = current.RequestReview;
                body.Settings.RequestSource = current.RequestSource;
                config.Settings = JsonSerializer.Serialize(body.Settings);
            }
            if (body.OverlayConfig is { ValueKind: JsonValueKind.Object } overlay)
            {
                var raw = overlay.GetRawText();
                if (raw.Length > MaxOverlayConfigLength)
                    return BadRequest(new { success = false, error = "overlay_config_too_large" });
                // Más plantillas que el plan solo si ya las tenía (bajar de plan no borra nada)
                var templates = TemplateCount(overlay);
                if (templates > limits.MaxTemplates && templates > TemplateCount(ParseJson(config.OverlayConfig)))
                    return BadRequest(new { success = false, error = "templates_limit", max = limits.MaxTemplates });
                config.OverlayConfig = raw;
            }
            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await _songs.NotifyAsync(config, ct);
            if (body.OverlayConfig.HasValue)
                await _songs.NotifyConfigChangedAsync(config, ct);
            return Ok(new { success = true });
        }

        private static int TemplateCount(JsonElement overlay) =>
            overlay.ValueKind == JsonValueKind.Object && overlay.TryGetProperty("templates", out var t) && t.ValueKind == JsonValueKind.Array
                ? t.GetArrayLength() : 0;

        private static object LimitsDto(SongRequestTierLimits l) => new
        {
            tier = l.Tier,
            maxPlaylists = l.MaxPlaylists,
            maxItemsPerPlaylist = l.MaxItemsPerPlaylist,
            historyDays = l.UnlimitedHistory ? (int?)null : l.HistoryDays,
            maxTemplates = l.MaxTemplates,
            canHidePromo = l.CanHidePromo
        };

        private static string? Validate(SongRequestSettings s)
        {
            var p = s.Permissions ?? new SongRequestPermissions();
            if (new[] { p.Request, p.Skip, p.Manage, p.Review, p.Playlist }.Any(r => !Roles.Contains(r)))
                return "invalid_role";
            s.Permissions = p;
            s.MaxQueueSize = Math.Clamp(s.MaxQueueSize, 0, 500);
            s.MaxPerUser = Math.Clamp(s.MaxPerUser, 0, 100);
            s.MaxPerUserPerHour = Math.Clamp(s.MaxPerUserPerHour, 0, 1000);
            s.SkipVotesRequired = Math.Clamp(s.SkipVotesRequired, 1, 1000);
            s.QueuePreviewCount = Math.Clamp(s.QueuePreviewCount, 1, 10);
            s.MaxDurationSeconds = Math.Clamp(s.MaxDurationSeconds, 0, 6 * 3600);
            s.MinViews = Math.Clamp(s.MinViews, 0, 10_000_000_000);
            s.NoRepeatMinutes = Math.Clamp(s.NoRepeatMinutes, 0, 7 * 24 * 60);
            if (s.RequestSource is not ("any" or "playlists"))
                return "invalid_request_source";
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
                case "stop": await _songs.SetStoppedAsync(config, ct); break;
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

        /// <summary>Sube el pedido al primer lugar de la cola (lo mismo que !srpromote).</summary>
        [HttpPost("api/song-request/queue/{id:long}/promote")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Promote(long id, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null)
                return NotFound(new { success = false });
            var promoted = await _songs.PromoteByIdAsync(config, id, ct);
            return promoted == null ? NotFound(new { success = false }) : Ok(new { success = true });
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

        [HttpPost("api/song-request/history/{id:long}/playlist/{playlistId:long}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> HistoryToPlaylist(long id, long playlistId, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            var row = config == null ? null : await _library.GetHistoryItemAsync(config.UserId, id, ct);
            if (config == null || row?.Track == null) return NotFound(new { success = false });
            var error = await _library.AddToPlaylistAsync(config.UserId, playlistId, row.Track, ct);
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

        // ── Estadísticas de escucha (etapa 3, fase 4) ────────────────────────

        /// <summary>Quién escucha las playlists: totales, días, por playlist, más escuchadas y las que no se reproducen afuera.</summary>
        [HttpGet("api/song-request/stats")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ListenStats([FromQuery] int days = 30, [FromQuery] long? playlistId = null, CancellationToken ct = default)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            var stats = await _listenStats.GetStatsAsync(_db, config.UserId, days, playlistId, ct);
            return Ok(new { success = true, stats });
        }

        // ── Playlists ────────────────────────────────────────────────────────

        [HttpGet("api/song-request/playlists")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Playlists(CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return Ok(new
            {
                success = true,
                playlists = await _library.GetPlaylistsAsync(config.UserId, ct),
                limits = LimitsDto(await _library.GetLimitsAsync(config.UserId))
            });
        }

        public sealed class RequestModeRequest
        {
            /// <summary>open | playlists | review | closed. Si viene, manda sobre lo demás.</summary>
            public string? Mode { get; set; }
            public bool? RequestsOpen { get; set; }
            public bool? RequestReview { get; set; }
            /// <summary>any | playlists</summary>
            public string? RequestSource { get; set; }
        }

        /// <summary>Modo rápido o una de sus partes, al instante (fase 5).</summary>
        [HttpPut("api/song-request/request-mode")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SetRequestMode([FromBody] RequestModeRequest body, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            if (body.Mode != null)
            {
                if (!SongRequestService.Modes.Contains(body.Mode))
                    return BadRequest(new { success = false, error = "invalid_mode" });
                await _songs.SetModeAsync(config, body.Mode, ct);
            }
            else
            {
                if (body.RequestSource is not (null or "any" or "playlists"))
                    return BadRequest(new { success = false, error = "invalid_request_source" });
                await _songs.SetRequestModeAsync(config, body.RequestsOpen, body.RequestReview, body.RequestSource, ct);
            }
            var settings = SongRequestService.ParseSettings(config);
            return Ok(new
            {
                success = true,
                mode = SongRequestService.ModeOf(config, settings),
                requestsOpen = config.RequestsOpen,
                requestReview = settings.RequestReview,
                requestSource = settings.RequestSource
            });
        }

        public sealed class ActivePlaylistRequest { public long? PlaylistId { get; set; } }

        /// <summary>Pone una playlist a sonar (o vuelve a la de respaldo con null).</summary>
        [HttpPut("api/song-request/active-playlist")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SetActivePlaylist([FromBody] ActivePlaylistRequest body, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return await _songs.SetActivePlaylistAsync(config, body.PlaylistId, ct) ? Ok(new { success = true }) : NotFound(new { success = false, error = "not_found" });
        }

        public sealed class PlaylistNameRequest { public string Name { get; set; } = ""; }

        [HttpPost("api/song-request/playlists")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> CreatePlaylist([FromBody] PlaylistNameRequest body, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            var (id, error) = await _library.CreatePlaylistAsync(config.UserId, body.Name, ct);
            return Ok(new { success = error == null, error, id });
        }

        [HttpPut("api/song-request/playlists/{playlistId:long}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> UpdatePlaylist(long playlistId, [FromBody] SongRequestLibraryService.PlaylistChanges body, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            var error = await _library.UpdatePlaylistAsync(config.UserId, playlistId, body, ct);
            return error == "not_found" ? NotFound(new { success = false }) : Ok(new { success = error == null, error });
        }

        /// <summary>Código de enlace nuevo: el enlace anterior de la playlist deja de funcionar.</summary>
        [HttpPost("api/song-request/playlists/{playlistId:long}/share-code")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> RegenerateShareCode(long playlistId, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            var code = await _library.RegenerateShareCodeAsync(config.UserId, playlistId, ct);
            return code == null ? NotFound(new { success = false }) : Ok(new { success = true, shareCode = code });
        }

        [HttpDelete("api/song-request/playlists/{playlistId:long}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> DeletePlaylist(long playlistId, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return await _library.DeletePlaylistAsync(config.UserId, playlistId, ct) ? Ok(new { success = true }) : NotFound(new { success = false });
        }

        [HttpGet("api/song-request/playlists/{playlistId:long}/items")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> PlaylistItems(long playlistId, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            var items = await _library.GetPlaylistItemsAsync(config.UserId, playlistId, ct);
            return items == null
                ? NotFound(new { success = false })
                : Ok(new { success = true, items, max = (await _library.GetLimitsAsync(config.UserId)).MaxItemsPerPlaylist });
        }

        [HttpPost("api/song-request/playlists/{playlistId:long}/items")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> AddPlaylistItem(long playlistId, [FromBody] AddRequest body, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(body.Input) || body.Input.Length > 500)
                return BadRequest(new { success = false, error = "invalid_input" });
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            var error = await _library.AddToPlaylistAsync(config.UserId, playlistId, body.Input, ct);
            return Ok(new { success = error == null, error });
        }


        // ── Importar playlists (YouTube, Spotify, Deezer, Apple Music): siempre con Decatron Desktop ──

        private static object JobDto(SongImportJob? job, bool desktopReady, bool desktopOutdated = false) => new
        {
            success = true,
            desktopReady,
            desktopOutdated,
            job = job == null ? null : new
            {
                id = job.Id,
                state = job.State,
                service = job.Service,
                sourceName = job.SourceName,
                playlistId = job.PlaylistId,
                playlistName = job.PlaylistName,
                error = job.Error,
                total = job.Tracks.Count,
                added = job.Count(ImportItemState.Added),
                duplicates = job.Count(ImportItemState.Duplicate),
                notFound = job.Count(ImportItemState.NotFound),
                rejected = job.Count(ImportItemState.Rejected),
                pending = job.Count(ImportItemState.Pending),
                // Lo que no entró, para que el streamer sepa qué buscar a mano
                problems = job.Tracks.Select((t, i) => (t, i))
                    .Where(x => job.States[x.i] is ImportItemState.NotFound or ImportItemState.Rejected)
                    .Take(200)
                    .Select(x => new { title = x.t.Title, artist = x.t.Artist, url = x.t.Url, reason = job.Reasons[x.i] }),
                createdAt = job.CreatedAt
            }
        };

        [HttpGet("api/song-request/imports/current")]
        [RequirePermission("overlays")]
        public IActionResult CurrentImport([FromServices] SongImportDesktopChannel imports)
        {
            var desktopUser = this.GetChannelOwnerId();
            return Ok(JobDto(imports.GetJob(desktopUser), imports.IsReady(desktopUser), imports.IsOutdated(desktopUser)));
        }

        public sealed class ExternalImportRequest { public string Url { get; set; } = ""; }

        [HttpPost("api/song-request/playlists/{playlistId:long}/import-external")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ImportExternal(long playlistId, [FromBody] ExternalImportRequest body, [FromServices] SongImportDesktopChannel imports, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(body.Url) || body.Url.Length > 500)
                return BadRequest(new { success = false, error = "invalid_input" });
            if (ExternalPlaylistReader.ServiceOf(body.Url) == null && !ExternalPlaylistReader.IsYouTubePlaylist(body.Url))
                return Ok(new { success = false, error = "not_a_playlist" });
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            var (job, error) = await imports.StartAsync(this.GetChannelOwnerId(), config.UserId, playlistId, body.Url.Trim(), ct);
            return error != null ? Ok(new { success = false, error }) : Ok(JobDto(job, true));
        }

        [HttpPost("api/song-request/imports/current/{action}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ImportAction(string action, [FromServices] SongImportDesktopChannel imports)
        {
            var desktopUser = this.GetChannelOwnerId();
            string? error = action switch
            {
                "cancel" => await imports.CancelAsync(desktopUser) ? null : "not_found",
                "resume" => await imports.ResumeAsync(desktopUser),
                _ => "invalid_action"
            };
            return Ok(new { success = error == null, error });
        }

                [HttpDelete("api/song-request/playlists/{playlistId:long}/items/{itemId:long}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> RemovePlaylistItem(long playlistId, long itemId, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return await _library.RemoveFromPlaylistAsync(config.UserId, playlistId, itemId, ct) ? Ok(new { success = true }) : NotFound(new { success = false });
        }

        [HttpDelete("api/song-request/playlists/{playlistId:long}/items")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ClearPlaylist(long playlistId, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return Ok(new { success = true, removed = await _library.ClearPlaylistAsync(config.UserId, playlistId, ct) });
        }

        [HttpPut("api/song-request/playlists/{playlistId:long}/order")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ReorderPlaylist(long playlistId, [FromBody] ReorderRequest body, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            await _library.ReorderPlaylistAsync(config.UserId, playlistId, body.Ids, ct);
            return Ok(new { success = true });
        }

        // ── Revisión (fase 3) ────────────────────────────────────────────────

        /// <summary>Quién está actuando desde el dashboard, para "vetado por" / "de confianza por".</summary>
        private async Task<string?> ActorAsync(CancellationToken ct)
        {
            var me = this.GetAuthenticatedUserId();
            return me == 0 ? null : await _db.Users.AsNoTracking().Where(u => u.Id == me).Select(u => u.Login).FirstOrDefaultAsync(ct);
        }

        [HttpGet("api/song-request/pending")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> PendingList([FromServices] SongRequestReviewService reviews, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return Ok(new
            {
                success = true,
                items = await reviews.ListAsync(config.UserId, ct),
                trusted = await reviews.ListTrustedAsync(config.UserId, ct)
            });
        }

        public sealed class DecideRequest
        {
            /// <summary>approve | reject | reject_silent | ban | trust</summary>
            public string Action { get; set; } = "";
        }

        [HttpPost("api/song-request/pending/{id:long}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Decide(long id, [FromBody] DecideRequest body, [FromServices] SongRequestReviewService reviews, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            var pending = await reviews.FindAsync(config.UserId, id, ct);
            if (pending == null) return NotFound(new { success = false, error = "not_found" });

            var result = body.Action switch
            {
                "approve" => await reviews.ApproveAsync(config, pending, ct),
                "reject" => await reviews.RejectAsync(config, pending, notify: true, ct),
                "reject_silent" => await reviews.RejectAsync(config, pending, notify: false, ct),
                "ban" => await reviews.BanRequesterAsync(config, pending, await ActorAsync(ct), ct),
                "trust" => await reviews.TrustAndApproveAsync(config, pending, await ActorAsync(ct), ct),
                _ => null
            };
            if (result == null) return BadRequest(new { success = false, error = "invalid_action" });
            return Ok(new { success = result.ErrorKey == null, error = result.ErrorKey, position = result.Position });
        }

        public sealed class TrustedRequest
        {
            public string Platform { get; set; } = "twitch";
            public string Login { get; set; } = "";
        }

        [HttpPost("api/song-request/trusted")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> AddTrusted([FromBody] TrustedRequest body, [FromServices] SongRequestReviewService reviews, CancellationToken ct)
        {
            var login = body.Login.Trim().TrimStart('@');
            if (login.Length is 0 or > 100 || body.Platform is not ("twitch" or "kick"))
                return BadRequest(new { success = false, error = "invalid_input" });
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            var added = await reviews.AddTrustedAsync(config.UserId, body.Platform, login, login, await ActorAsync(ct), ct);
            return Ok(new { success = added, error = added ? null : "already_trusted" });
        }

        [HttpDelete("api/song-request/trusted/{id:long}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> RemoveTrusted(long id, [FromServices] SongRequestReviewService reviews, CancellationToken ct)
        {
            var config = await OwnConfigAsync(ct);
            if (config == null) return NotFound(new { success = false });
            return await reviews.RemoveTrustedAsync(config.UserId, id, ct) ? Ok(new { success = true }) : NotFound(new { success = false });
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

        /// <summary>
        /// Lo que necesita la guía "Cómo pedir" de /sr/{canal} (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 0):
        /// permisos, límites y de qué playlist cuenta !sr #n. El modo va en vivo en el snapshot.
        /// </summary>
        [AllowAnonymous]
        [HttpGet("api/public/song-request/{channel}/guide")]
        public async Task<IActionResult> PublicGuide(string channel, CancellationToken ct)
        {
            var login = channel.Trim().ToLowerInvariant();
            var config = await _db.SongRequestConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.ChannelName == login, ct);
            if (config == null || !config.Enabled)
                return NotFound(new { success = false });

            var settings = SongRequestService.ParseSettings(config);
            // !sr #n solo se ofrece si el viewer puede ver los números: la playlist tiene que ser pública
            var numbered = await _songs.GetRequestPlaylistAsync(config, ct);
            var hasCollaborative = await _db.SongRequestPlaylists.AsNoTracking().AnyAsync(p => p.UserId == config.UserId
                && p.Visibility == SongRequestPlaylistVisibility.Public
                && (p.Contribution == SongRequestPlaylistContribution.Open || p.Contribution == SongRequestPlaylistContribution.Review), ct);
            // Lo que el streamer ocultó en "Comandos públicos" tampoco sale en la guía
            var hidden = await _db.PublicCommandOverrides.AsNoTracking()
                .Where(o => o.UserId == config.UserId && o.Category == "songrequest" && o.Hidden)
                .Select(o => o.CommandKey)
                .ToListAsync(ct);

            return Ok(new
            {
                success = true,
                permissions = settings.Permissions,
                skipVoteEnabled = settings.SkipVoteEnabled,
                skipVotesRequired = Math.Max(1, settings.SkipVotesRequired),
                maxPerUser = settings.MaxPerUser,
                maxPerUserPerHour = settings.MaxPerUserPerHour,
                maxDurationSeconds = settings.MaxDurationSeconds,
                noRepeatMinutes = settings.NoRepeatMinutes,
                numberedPlaylist = numbered != null && numbered.Visibility == SongRequestPlaylistVisibility.Public
                    ? new { id = numbered.Id, name = numbered.Name }
                    : null,
                hasCollaborative,
                platforms = await _songs.GetQueuePlatformsAsync(config.UserId, ct),
                hidden
            });
        }

        public sealed class ListenEventRequest
        {
            public string? VisitorId { get; set; }
            /// <summary>beat | stop | listen | unplayable</summary>
            public string? Event { get; set; }
            public long? TrackId { get; set; }
            public int Seconds { get; set; }
        }

        /// <summary>
        /// Una señal anónima del reproductor del viewer (fase 4, etapa 3): escuchando, pausa, canción escuchada 30 s o
        /// que YouTube no deja reproducir. Responde siempre 204 para no darle pistas a quien quiera inflar números.
        /// </summary>
        [AllowAnonymous]
        [HttpPost("api/public/song-request/{channel}/playlists/{code}/listen")]
        public async Task<IActionResult> PublicListenEvent(string channel, string code, [FromBody] ListenEventRequest body, CancellationToken ct)
        {
            if (body == null || !SongListenStatsService.IsValidEvent(body.Event))
                return NoContent();
            var login = channel.Trim().ToLowerInvariant();
            var config = await _db.SongRequestConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.ChannelName == login, ct);
            if (config == null || !config.Enabled)
                return NoContent();
            var playlist = await _library.FindSharedPlaylistAsync(config.UserId, code, ct);
            if (playlist == null)
                return NoContent();

            // Solo para frenar abusos y solo en memoria: la IP no se guarda (detrás de Cloudflare y nginx va en estos encabezados)
            var ip = Request.Headers["CF-Connecting-IP"].FirstOrDefault() ?? Request.Headers["X-Real-IP"].FirstOrDefault()
                ?? HttpContext.Connection.RemoteIpAddress?.ToString() ?? "?";
            await _listenStats.RecordAsync(playlist.Id, body.VisitorId ?? "", body.Event!, body.TrackId, body.Seconds, ip, ct);
            return NoContent();
        }

        /// <summary>
        /// Lo que ya sonó en el stream, para la pestaña Historial de /sr/{canal} (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 1b).
        /// Mismo tope por plan que el dashboard; no sale lo vetado ni lo que falló.
        /// </summary>
        [AllowAnonymous]
        [HttpGet("api/public/song-request/{channel}/history")]
        public async Task<IActionResult> PublicHistory(string channel, [FromQuery] int page = 0, CancellationToken ct = default)
        {
            var login = channel.Trim().ToLowerInvariant();
            var config = await _db.SongRequestConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.ChannelName == login, ct);
            if (config == null || !config.Enabled)
                return NotFound(new { success = false });

            return Ok(new { success = true, data = await _library.GetPublicHistoryAsync(config.UserId, page, 30, ct) });
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

            // La tarjeta de Decatron: el streamer la apaga solo si su plan lo permite
            var limits = await _library.GetLimitsAsync(config.UserId);
            var showPromo = !limits.CanHidePromo || SongRequestService.ParseSettings(config).ShowPromo;
            var lang = await _db.Users.AsNoTracking().Where(u => u.Id == config.UserId).Select(u => u.PreferredLanguage).FirstOrDefaultAsync(ct);
            return Ok(new
            {
                success = true,
                overlayConfig = ParseJson(config.OverlayConfig),
                promos = showPromo ? await _promos.GetCatalogAsync(lang ?? "es", "songrequest") : null,
                lang = lang != null && lang.StartsWith("en", StringComparison.OrdinalIgnoreCase) ? "en" : "es"
            });
        }

        // ── Aportes desde /sr/{canal} (fase 2) ──────────────────────────────

        /// <summary>
        /// Con qué cuenta agrega el viewer logueado en este canal: la de Twitch si el canal recibe pedidos
        /// de Twitch, si no la de Kick. Cuentas vinculadas cuentan juntas. Null si no tiene ninguna de las dos.
        /// </summary>
        private async Task<(SongRequestContributor? Who, bool IsOwner)> WebContributorAsync(SongRequestConfig config, CancellationToken ct)
        {
            var me = this.GetAuthenticatedUserId();
            if (me == 0)
                return (null, false);
            var accountId = await _db.Users.AsNoTracking().Where(u => u.Id == me).Select(u => u.AccountId).FirstOrDefaultAsync(ct);
            var users = await _db.Users.AsNoTracking()
                .Where(u => u.Id == me || (accountId != null && u.AccountId == accountId))
                .Select(u => new { u.Id, u.TwitchId, u.Login, u.DisplayName, u.KickId, u.KickUsername })
                .ToListAsync(ct);
            var isOwner = users.Any(u => u.Id == config.UserId);
            var platforms = await _songs.GetQueuePlatformsAsync(config.UserId, ct);

            var twitch = users.FirstOrDefault(u => !string.IsNullOrEmpty(u.TwitchId));
            if (platforms.Contains("twitch") && twitch != null)
                return (new SongRequestContributor("twitch", twitch.TwitchId, twitch.Login, twitch.DisplayName ?? twitch.Login, isOwner ? 5 : 0, isOwner), isOwner);
            var kick = users.FirstOrDefault(u => !string.IsNullOrEmpty(u.KickId) && !string.IsNullOrEmpty(u.KickUsername));
            if (platforms.Contains("kick") && kick != null)
                return (new SongRequestContributor("kick", kick.KickId, kick.KickUsername!, kick.KickUsername!, isOwner ? 5 : 0, isOwner), isOwner);
            return (null, isOwner);
        }

        /// <summary>Para la página pública: con qué cuenta agregaría el viewer (o null si no puede).</summary>
        [HttpGet("api/song-request/public/{channel}/me")]
        public async Task<IActionResult> PublicMe(string channel, CancellationToken ct)
        {
            var login = channel.Trim().ToLowerInvariant();
            var config = await _db.SongRequestConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.ChannelName == login, ct);
            if (config == null)
                return NotFound(new { success = false });
            var (who, _) = await WebContributorAsync(config, ct);
            return Ok(new { success = true, contributor = who == null ? null : new { platform = who.Platform, name = who.DisplayName } });
        }

        /// <summary>Un viewer agrega a una playlist colaborativa (pública o solo con enlace) desde la web.</summary>
        [HttpPost("api/song-request/public/{channel}/playlists/{code}/items")]
        public async Task<IActionResult> PublicAddToPlaylist(string channel, string code, [FromBody] AddRequest body, [FromServices] SongRequestContributionService contributions, [FromServices] SongRequestReviewService reviews, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(body.Input) || body.Input.Length > 500)
                return BadRequest(new { success = false, error = "invalid_input" });
            var login = channel.Trim().ToLowerInvariant();
            var config = await _db.SongRequestConfigs.FirstOrDefaultAsync(c => c.ChannelName == login, ct);
            if (config == null || !config.Enabled)
                return NotFound(new { success = false });
            var playlist = await _library.FindSharedPlaylistAsync(config.UserId, code, ct);
            if (playlist == null)
                return NotFound(new { success = false });

            var (who, _) = await WebContributorAsync(config, ct);
            if (who == null)
                return Ok(new { success = false, error = "pl_need_account" });
            // Desde la web no se sabe si es sub, VIP o mod: una playlist con rol mínimo se usa desde el chat
            if (!who.Privileged && SongRequestContributionService.ParseRequirements(playlist.Requirements).MinRole != "everyone")
                return Ok(new { success = false, error = "pl_role_web" });

            // Si queda pendiente, la decisión se avisa en el chat de la cuenta con la que agregó
            var replyChannel = await reviews.ReplyChannelForAsync(config, who.Platform, ct);
            var result = await contributions.AddAsync(config, playlist, who, body.Input.Trim(), ct, replyChannel);
            return Ok(new
            {
                success = result.Success,
                pending = result.Pending,
                error = result.ErrorKey,
                vars = result.Vars,
                title = result.Track?.Title,
                addedAs = new { platform = who.Platform, name = who.DisplayName }
            });
        }

        /// <summary>
        /// "Pedir al stream" en una canción de la playlist (fase 2, etapa 3): exactamente lo mismo que !sr de esa canción.
        /// Mismos requisitos, límites, modo, revisión y vetos; el pedido lleva el nombre de quien lo hizo.
        /// </summary>
        [HttpPost("api/song-request/public/{channel}/playlists/{code}/items/{itemId:long}/request")]
        public async Task<IActionResult> PublicRequestFromPlaylist(string channel, string code, long itemId, [FromServices] SongRequestContributionService contributions, [FromServices] SongRequestReviewService reviews, CancellationToken ct)
        {
            var login = channel.Trim().ToLowerInvariant();
            var config = await _db.SongRequestConfigs.FirstOrDefaultAsync(c => c.ChannelName == login, ct);
            if (config == null || !config.Enabled)
                return NotFound(new { success = false });
            var playlist = await _library.FindSharedPlaylistAsync(config.UserId, code, ct);
            if (playlist == null)
                return NotFound(new { success = false });
            var item = await _db.SongRequestPlaylistItems.AsNoTracking().Include(i => i.Track)
                .FirstOrDefaultAsync(i => i.Id == itemId && i.PlaylistId == playlist.Id, ct);
            if (item?.Track == null)
                return NotFound(new { success = false });

            var settings = SongRequestService.ParseSettings(config);
            if (!settings.AllowWebRequests)
                return Ok(new { success = false, error = "web_requests_off" });
            if (!config.RequestsOpen)
                return Ok(new { success = false, error = "closed" });

            var (who, _) = await WebContributorAsync(config, ct);
            if (who == null)
                return Ok(new { success = false, error = "pl_need_account" });
            // Desde la web no se sabe si es sub, VIP o mod: si el canal pide un rol para pedir, se pide desde el chat
            if (!who.Privileged && settings.Permissions.Request != "everyone")
                return Ok(new { success = false, error = "request_role_web" });

            var review = settings.RequestReview && !who.Privileged
                && !await contributions.IsTrustedAsync(config.UserId, who.Platform, who.Login, ct);
            var replyChannel = await reviews.ReplyChannelForAsync(config, who.Platform, ct);
            var requester = new SongRequester(who.Platform, who.Id, who.Login, who.DisplayName);
            var result = await _songs.AddAsync(config, requester, "", who.Privileged, ct, review, replyChannel, item.Track);
            if (result.Success)
                await _listenStats.AddWebRequestAsync(playlist.Id, ct);
            return Ok(new
            {
                success = result.Success,
                pending = result.Pending != null,
                position = result.Position,
                error = result.ErrorKey,
                title = result.Track?.Title ?? item.Track.Title,
                vars = new Dictionary<string, string>
                {
                    ["max"] = (result.ErrorKey == "hour_limit" ? settings.MaxPerUserPerHour : settings.MaxPerUser).ToString(),
                    ["minutes"] = settings.NoRepeatMinutes.ToString(),
                    ["views"] = settings.MinViews.ToString("N0")
                }
            });
        }

        /// <summary>Vota o quita el voto a una canción de una playlist pública con votación.</summary>
        [HttpPost("api/song-request/public/{channel}/playlists/{code}/items/{itemId:long}/vote")]
        public async Task<IActionResult> PublicVote(string channel, string code, long itemId, CancellationToken ct)
        {
            var login = channel.Trim().ToLowerInvariant();
            var config = await _db.SongRequestConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.ChannelName == login, ct);
            if (config == null)
                return NotFound(new { success = false });
            var (who, _) = await WebContributorAsync(config, ct);
            if (who == null)
                return Ok(new { success = false, error = "pl_need_account" });
            var shared = await _library.FindSharedPlaylistAsync(config.UserId, code, ct);
            if (shared == null)
                return NotFound(new { success = false });
            var (voted, votes, error) = await _library.ToggleVoteAsync(config.UserId, shared.Id, itemId, who.Platform, who.Login, ct);
            return Ok(new { success = error == null, error, voted, votes });
        }

        [HttpGet("api/song-request/public/{channel}/playlists/{code}/my-votes")]
        public async Task<IActionResult> PublicMyVotes(string channel, string code, CancellationToken ct)
        {
            var login = channel.Trim().ToLowerInvariant();
            var config = await _db.SongRequestConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.ChannelName == login, ct);
            if (config == null)
                return NotFound(new { success = false });
            var shared = await _library.FindSharedPlaylistAsync(config.UserId, code, ct);
            if (shared == null)
                return NotFound(new { success = false });
            var (who, _) = await WebContributorAsync(config, ct);
            return Ok(new { success = true, items = who == null ? new List<long>() : await _library.GetMyVotesAsync(shared.Id, who.Platform, who.Login, ct) });
        }

        /// <summary>Las playlists públicas del canal, para /sr/{canal}.</summary>
        [AllowAnonymous]
        [HttpGet("api/public/song-request/{channel}/playlists")]
        public async Task<IActionResult> PublicPlaylists(string channel, CancellationToken ct)
        {
            var login = channel.Trim().ToLowerInvariant();
            var config = await _db.SongRequestConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.ChannelName == login, ct);
            if (config == null)
                return NotFound(new { success = false });
            return Ok(new { success = true, playlists = await _library.GetPublicPlaylistsAsync(config.UserId, ct) });
        }

        [AllowAnonymous]
        [HttpGet("api/public/song-request/{channel}/playlists/{code}")]
        public async Task<IActionResult> PublicPlaylistItems(string channel, string code, CancellationToken ct)
        {
            var login = channel.Trim().ToLowerInvariant();
            var config = await _db.SongRequestConfigs.AsNoTracking().FirstOrDefaultAsync(c => c.ChannelName == login, ct);
            if (config == null)
                return NotFound(new { success = false });
            // Pública o solo con enlace; una privada responde igual que una que no existe
            var shared = await _library.GetSharedPlaylistAsync(config.UserId, code, ct);
            return shared == null ? NotFound(new { success = false }) : Ok(new { success = true, shared });
        }
    }
}
