using System.Security.Claims;
using Decatron.Attributes;
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
    /// Emotes propios de Decatron, lado del streamer y de quien administra el canal.
    /// Plan: .dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 3.
    /// </summary>
    [Authorize]
    [Route("api/channel-emotes")]
    [ApiController]
    public class ChannelEmotesController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly ChannelEmoteService _emotes;
        private readonly ILogger<ChannelEmotesController> _logger;

        public ChannelEmotesController(DecatronDbContext db, ChannelEmoteService emotes, ILogger<ChannelEmotesController> logger)
        {
            _db = db;
            _emotes = emotes;
            _logger = logger;
        }

        public record UpdateRequest(string? Name, bool? ZeroWidth, bool? Visible);
        public record ReviewRequest(bool Approve, string? Reason);
        public record BatchReviewRequest(List<long> Ids, bool Approve, string? Reason);
        public record SettingsRequest(string? UploadMode, int? MaxPendingPerUser);
        public record UploaderRequest(string Platform, string Login);

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(claim, out var id)) return id;
            throw new UnauthorizedAccessException("User not found");
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId)) return sessionId;
            if (long.TryParse(User.FindFirst("ChannelOwnerId")?.Value, out var claimId)) return claimId;
            return GetUserId();
        }

        /// <summary>El emote como lo ve el panel: estado, quién lo subió, motivo y las tres imágenes</summary>
        internal static object Dto(ChannelEmote e, ChannelEmoteService svc, int reports = 0) => new
        {
            id = e.Id, name = e.Name, status = e.Status, animated = e.Animated, zeroWidth = e.ZeroWidth,
            width = e.Width, height = e.Height, bytes = e.Bytes,
            uploadedBy = e.UploadedByName, uploadedById = e.UploadedBy,
            reviewedBy = e.ReviewedByName, reviewedAt = e.ReviewedAt, reason = e.Reason, createdAt = e.CreatedAt,
            reports,
            urls = new { x1 = svc.UrlFor(e, 1), x2 = svc.UrlFor(e, 2), x4 = svc.UrlFor(e, 4) }
        };

        private IActionResult Fail(string error, int status = 400) => StatusCode(status, new { success = false, error });

        /// <summary>GET /api/channel-emotes - Todos los emotes del canal, la configuración y el uso</summary>
        [HttpGet]
        [RequirePermission("moderation")]
        public async Task<IActionResult> Get()
        {
            try
            {
                var owner = GetChannelOwnerId();
                var rows = await _db.ChannelEmotes.AsNoTracking().Where(e => e.UserId == owner)
                    .OrderBy(e => e.Name).ToListAsync();
                var ids = rows.Select(r => r.Id).ToList();
                var reportCounts = await _db.ChannelEmoteReports.AsNoTracking().Where(r => ids.Contains(r.EmoteId))
                    .GroupBy(r => r.EmoteId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);

                var settings = await _emotes.GetSettingsAsync(owner);
                var (used, max, tier) = await _emotes.GetUsageAsync(owner);
                var role = await _emotes.ResolveRoleAsync(owner, GetUserId());
                var (canUpload, _) = ChannelEmoteService.Decide(settings.UploadMode, role);
                var login = await _db.Users.AsNoTracking().Where(u => u.Id == owner).Select(u => u.Login).FirstOrDefaultAsync();

                return Ok(new
                {
                    success = true,
                    emotes = rows.Select(r => Dto(r, _emotes, reportCounts.GetValueOrDefault(r.Id))),
                    settings = new { uploadMode = settings.UploadMode, maxPendingPerUser = settings.MaxPendingPerUser },
                    usage = new { used, max, tier },
                    canUpload,
                    isOwnerLevel = role == EmoteRole.Owner,
                    channelLogin = login
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listando los emotes del canal");
                return StatusCode(500, new { success = false, error = "server_error" });
            }
        }

        /// <summary>POST /api/channel-emotes - Sube un emote (quien administra el canal lo deja aprobado)</summary>
        [HttpPost]
        [RequirePermission("moderation")]
        [RequestSizeLimit(3_000_000)]
        public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] string name, [FromForm] bool zeroWidth, CancellationToken ct)
        {
            try
            {
                if (file == null || file.Length == 0) return Fail("invalid_image");
                await using var stream = file.OpenReadStream();
                var result = await _emotes.UploadAsync(GetChannelOwnerId(), GetUserId(), name, stream, zeroWidth, ct);
                return result.Success
                    ? Ok(new { success = true, emote = Dto(result.Emote!, _emotes) })
                    : Fail(result.Error!, result.Error == "not_allowed" ? 403 : 400);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error subiendo un emote");
                return StatusCode(500, new { success = false, error = "server_error" });
            }
        }

        /// <summary>PUT /api/channel-emotes/{id} - Nombre, "encima del anterior" y mostrar u ocultar</summary>
        [HttpPut("{id:long}")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> Update(long id, [FromBody] UpdateRequest request)
        {
            var result = await _emotes.UpdateAsync(GetChannelOwnerId(), id, request.Name, request.ZeroWidth, request.Visible);
            return result.Success ? Ok(new { success = true, emote = Dto(result.Emote!, _emotes) }) : Fail(result.Error!, result.Error == "not_found" ? 404 : 400);
        }

        /// <summary>POST /api/channel-emotes/{id}/review - Aprueba o rechaza un emote pendiente</summary>
        [HttpPost("{id:long}/review")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> Review(long id, [FromBody] ReviewRequest request)
        {
            var result = await _emotes.ReviewAsync(GetChannelOwnerId(), GetUserId(), id, request.Approve, request.Reason);
            return result.Success ? Ok(new { success = true, emote = Dto(result.Emote!, _emotes) }) : Fail(result.Error!, result.Error == "not_found" ? 404 : 400);
        }

        /// <summary>POST /api/channel-emotes/review-batch - Aprueba o rechaza varios a la vez</summary>
        [HttpPost("review-batch")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> ReviewBatch([FromBody] BatchReviewRequest request)
        {
            if (request.Ids == null || request.Ids.Count == 0) return Fail("invalid_ids");
            var (done, error) = await _emotes.ReviewBatchAsync(GetChannelOwnerId(), GetUserId(), request.Ids, request.Approve, request.Reason);
            return error == null ? Ok(new { success = true, done }) : Fail(error);
        }

        /// <summary>DELETE /api/channel-emotes/{id}?reason= - Borra un emote (si lo subió otra persona, ella ve el motivo)</summary>
        [HttpDelete("{id:long}")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> Delete(long id, [FromQuery] string? reason)
        {
            var result = await _emotes.DeleteAsync(GetChannelOwnerId(), GetUserId(), id, reason);
            return result.Success ? Ok(new { success = true }) : Fail(result.Error!, 404);
        }

        /// <summary>POST /api/channel-emotes/history/purge - Quita del historial los rechazados y retirados</summary>
        [HttpPost("history/purge")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> PurgeHistory() => Ok(new { success = true, removed = await _emotes.PurgeHistoryAsync(GetChannelOwnerId()) });

        /// <summary>GET /api/channel-emotes/reports - Los reportes de los viewers, con sus motivos</summary>
        [HttpGet("reports")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> Reports()
        {
            var owner = GetChannelOwnerId();
            var rows = await (from r in _db.ChannelEmoteReports.AsNoTracking()
                              join e in _db.ChannelEmotes.AsNoTracking() on r.EmoteId equals e.Id
                              where e.UserId == owner
                              select new { r.EmoteId, r.Reason, r.CreatedAt }).ToListAsync();
            var reports = rows.GroupBy(r => r.EmoteId).Select(g => new
            {
                emoteId = g.Key,
                count = g.Count(),
                reasons = g.Where(x => !string.IsNullOrWhiteSpace(x.Reason)).Select(x => x.Reason).Distinct().Take(10)
            });
            return Ok(new { success = true, reports });
        }

        /// <summary>POST /api/channel-emotes/{id}/reports/dismiss - Descarta los reportes de un emote</summary>
        [HttpPost("{id:long}/reports/dismiss")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> DismissReports(long id) =>
            Ok(new { success = true, removed = await _emotes.DismissReportsAsync(GetChannelOwnerId(), id) });

        // ── Configuración (solo control total) ───────────────────────────────

        /// <summary>PUT /api/channel-emotes/settings - Quién puede subir y cuántos pendientes por persona</summary>
        [HttpPut("settings")]
        [RequirePermission("moderation", "control_total")]
        public async Task<IActionResult> UpdateSettings([FromBody] SettingsRequest request)
        {
            var error = await _emotes.UpdateSettingsAsync(GetChannelOwnerId(), request.UploadMode, request.MaxPendingPerUser);
            return error == null ? Ok(new { success = true }) : Fail(error);
        }

        /// <summary>GET /api/channel-emotes/uploaders - Las personas permitidas</summary>
        [HttpGet("uploaders")]
        [RequirePermission("moderation", "control_total")]
        public async Task<IActionResult> Uploaders()
        {
            var rows = await _emotes.GetUploadersAsync(GetChannelOwnerId());
            return Ok(new { success = true, uploaders = rows.Select(u => new { u.Id, u.Platform, u.Login }) });
        }

        [HttpPost("uploaders")]
        [RequirePermission("moderation", "control_total")]
        public async Task<IActionResult> AddUploader([FromBody] UploaderRequest request)
        {
            var error = await _emotes.AddUploaderAsync(GetChannelOwnerId(), request.Platform ?? "twitch", request.Login ?? "");
            return error == null ? Ok(new { success = true }) : Fail(error, error == "uploader_exists" ? 409 : 400);
        }

        [HttpDelete("uploaders/{id:long}")]
        [RequirePermission("moderation", "control_total")]
        public async Task<IActionResult> RemoveUploader(long id) =>
            await _emotes.RemoveUploaderAsync(GetChannelOwnerId(), id) ? Ok(new { success = true }) : Fail("not_found", 404);
    }
}
