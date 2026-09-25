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

        public SongRequestController(SongResolverService resolver, SongRequestService songs, DecatronDbContext db)
        {
            _resolver = resolver;
            _songs = songs;
            _db = db;
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

            var config = await _songs.GetConfigAsync(userId, ct);
            return Ok(new
            {
                success = true,
                channel = channel.Login,
                publicUrl = _songs.PublicQueueUrl(channel.Login),
                enabled = config?.Enabled ?? false,
                requestsOpen = config?.RequestsOpen ?? true,
                paused = config?.IsPaused ?? false,
                settings = SongRequestService.ParseSettings(config)
            });
        }

        public sealed class SaveConfigRequest
        {
            public bool? Enabled { get; set; }
            public bool? RequestsOpen { get; set; }
            public SongRequestSettings? Settings { get; set; }
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
            config.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await _songs.NotifyAsync(config, ct);
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
            s.Messages ??= new();
            if (s.Messages.Values.Any(m => m != null && m.Length > 400))
                return "message_too_long";
            return null;
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
    }
}
