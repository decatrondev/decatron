using System.Security.Claims;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.Emotes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Emotes propios de un canal, lado del viewer: la galería pública (que también lee la extensión), subir con cuenta,
    /// ver lo propio y reportar. Plan: .dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fases 3 y 4.
    /// </summary>
    [Route("api/public/emotes")]
    [ApiController]
    public class PublicEmotesController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly ChannelEmoteService _emotes;
        private readonly ILogger<PublicEmotesController> _logger;

        public PublicEmotesController(DecatronDbContext db, ChannelEmoteService emotes, ILogger<PublicEmotesController> logger)
        {
            _db = db;
            _emotes = emotes;
            _logger = logger;
        }

        public record ReportRequest(string? Reason);

        private long? CurrentUserId() =>
            long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

        private record ChannelRow(long Id, string Login, string DisplayName, string? AvatarUrl);

        /// <summary>El canal por su usuario de Twitch o, si no, de Kick</summary>
        private async Task<ChannelRow?> FindChannelAsync(string channel)
        {
            var login = channel.Trim().ToLowerInvariant();
            if (login.Length is 0 or > 60) return null;
            var row = await _db.Users.AsNoTracking().Where(u => u.IsActive && u.Login == login)
                .Select(u => new { u.Id, u.Login, u.DisplayName, u.ProfileImageUrl }).FirstOrDefaultAsync();
            if (row != null) return new ChannelRow(row.Id, row.Login, row.DisplayName ?? row.Login, row.ProfileImageUrl);
            var kick = await _db.Users.AsNoTracking().Where(u => u.IsActive && u.KickUsername != null && u.KickUsername.ToLower() == login)
                .Select(u => new { u.Id, u.KickUsername, u.ProfileImageUrl }).FirstOrDefaultAsync();
            return kick == null ? null : new ChannelRow(kick.Id, kick.KickUsername!, kick.KickUsername!, kick.ProfileImageUrl);
        }

        private IActionResult Fail(string error, int status = 400) => StatusCode(status, new { success = false, error });

        /// <summary>GET /api/public/emotes/{channel} - Los emotes aprobados del canal (galería y extensión)</summary>
        [AllowAnonymous]
        [HttpGet("{channel}")]
        public async Task<IActionResult> Get(string channel)
        {
            try
            {
                var ch = await FindChannelAsync(channel);
                if (ch == null) return NotFound(new { success = false });

                var rows = await _emotes.GetApprovedAsync(ch.Id);
                var settings = await _emotes.GetSettingsAsync(ch.Id);
                Response.Headers["Cache-Control"] = "public, max-age=30";
                return Ok(new
                {
                    success = true,
                    channel = new { login = ch.Login, displayName = ch.DisplayName, avatarUrl = ch.AvatarUrl },
                    uploadMode = settings.UploadMode,
                    emotes = rows.Select(e => new
                    {
                        id = e.Id, name = e.Name, animated = e.Animated, zeroWidth = e.ZeroWidth, width = e.Width, height = e.Height,
                        uploadedBy = e.UploadedByName,
                        urls = new { x1 = _emotes.UrlFor(e, 1), x2 = _emotes.UrlFor(e, 2), x4 = _emotes.UrlFor(e, 4) }
                    })
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en la galería pública de emotes");
                return StatusCode(500, new { success = false, error = "server_error" });
            }
        }

        /// <summary>GET /api/public/emotes/{channel}/me - Qué puede hacer quien tiene la sesión iniciada y lo que ya subió</summary>
        [Authorize]
        [HttpGet("{channel}/me")]
        public async Task<IActionResult> Me(string channel)
        {
            var ch = await FindChannelAsync(channel);
            var me = CurrentUserId();
            if (ch == null || me == null) return NotFound(new { success = false });

            var settings = await _emotes.GetSettingsAsync(ch.Id);
            var role = await _emotes.ResolveRoleAsync(ch.Id, me.Value);
            var (canUpload, autoApprove) = ChannelEmoteService.Decide(settings.UploadMode, role);
            var mine = await _db.ChannelEmotes.AsNoTracking().Where(e => e.UserId == ch.Id && e.UploadedBy == me.Value)
                .OrderByDescending(e => e.CreatedAt).ToListAsync();
            var pending = mine.Count(e => e.Status == ChannelEmote.Pending);
            var (used, max, _) = await _emotes.GetUsageAsync(ch.Id);

            return Ok(new
            {
                success = true,
                canUpload,
                autoApprove,
                role = role.ToString().ToLowerInvariant(),
                pendingLeft = Math.Max(0, settings.MaxPendingPerUser - pending),
                channelFull = autoApprove && used >= max,
                mine = mine.Select(e => ChannelEmotesController.Dto(e, _emotes))
            });
        }

        /// <summary>POST /api/public/emotes/{channel}/upload - Sube un emote al canal (según su modo: aprobado o pendiente)</summary>
        [Authorize]
        [HttpPost("{channel}/upload")]
        [RequestSizeLimit(3_000_000)]
        public async Task<IActionResult> Upload(string channel, [FromForm] IFormFile file, [FromForm] string name, [FromForm] bool zeroWidth, CancellationToken ct)
        {
            try
            {
                var ch = await FindChannelAsync(channel);
                var me = CurrentUserId();
                if (ch == null || me == null) return NotFound(new { success = false });
                if (file == null || file.Length == 0) return Fail("invalid_image");

                await using var stream = file.OpenReadStream();
                // Solo quien administra el canal decide "encima del anterior": el resto lo deja el streamer al revisar
                var role = await _emotes.ResolveRoleAsync(ch.Id, me.Value);
                var result = await _emotes.UploadAsync(ch.Id, me.Value, name, stream, role >= EmoteRole.Staff && zeroWidth, ct);
                return result.Success
                    ? Ok(new { success = true, emote = ChannelEmotesController.Dto(result.Emote!, _emotes), pending = result.Emote!.Status == ChannelEmote.Pending })
                    : Fail(result.Error!, result.Error == "not_allowed" ? 403 : 400);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en una subida pública de emote");
                return StatusCode(500, new { success = false, error = "server_error" });
            }
        }

        /// <summary>DELETE /api/public/emotes/{channel}/mine/{id} - Quien subió un emote lo borra (o descarta el aviso de uno retirado)</summary>
        [Authorize]
        [HttpDelete("{channel}/mine/{id:long}")]
        public async Task<IActionResult> DeleteMine(string channel, long id)
        {
            var ch = await FindChannelAsync(channel);
            var me = CurrentUserId();
            if (ch == null || me == null) return NotFound(new { success = false });
            var result = await _emotes.DeleteOwnAsync(ch.Id, me.Value, id);
            return result.Success ? Ok(new { success = true }) : Fail(result.Error!, 404);
        }

        /// <summary>POST /api/public/emotes/{channel}/{id}/report - Reporta un emote</summary>
        [Authorize]
        [HttpPost("{channel}/{id:long}/report")]
        public async Task<IActionResult> Report(string channel, long id, [FromBody] ReportRequest? request)
        {
            var ch = await FindChannelAsync(channel);
            var me = CurrentUserId();
            if (ch == null || me == null) return NotFound(new { success = false });
            var error = await _emotes.ReportAsync(ch.Id, me.Value, id, request?.Reason);
            return error == null ? Ok(new { success = true }) : Fail(error, 404);
        }
    }
}
