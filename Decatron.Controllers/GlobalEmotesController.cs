using System.Security.Claims;
using Decatron.Core.Models;
using Decatron.Services.Emotes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Emotes globales de Decatron (set de la plataforma visible en todos los canales). Los manejan los admins del sistema
    /// y las personas que el dueño autorice por su usuario de Twitch; la lista de autorizados solo la edita el dueño.
    /// La lectura pública (sin sesión) la usa la extensión.
    /// </summary>
    [ApiController]
    public class GlobalEmotesController : ControllerBase
    {
        private readonly GlobalEmoteService _emotes;
        private readonly ILogger<GlobalEmotesController> _logger;

        public GlobalEmotesController(GlobalEmoteService emotes, ILogger<GlobalEmotesController> logger)
        {
            _emotes = emotes;
            _logger = logger;
        }

        public record UpdateRequest(string? Name, bool? ZeroWidth, bool? Visible);
        public record ManagerRequest(string Login);
        public record AccessRequest(string? Message);
        public record ResolveBody(bool Approve);

        private string? Login => User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value;
        private long? UserId => long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;
        /// <summary>
        /// ¿Se está actuando en el canal de otra persona (control total o moderación)? El permiso sobre los emotes
        /// globales es personal y no se hereda de un canal: en ese contexto no se ofrece ni se solicita.
        /// </summary>
        private bool ActingForAnotherChannel()
        {
            var me = UserId;
            if (me == null) return false;
            var session = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(session) && long.TryParse(session, out var sid)) return sid != me.Value;
            return long.TryParse(User.FindFirst("ChannelOwnerId")?.Value, out var cid) && cid != me.Value;
        }

        private IActionResult Fail(string error, int status = 400) => StatusCode(status, new { success = false, error });

        private object Dto(GlobalEmote e) => new
        {
            id = e.Id, name = e.Name, status = e.Status, animated = e.Animated, zeroWidth = e.ZeroWidth,
            width = e.Width, height = e.Height, bytes = e.Bytes, uploadedBy = e.UploadedByName, createdAt = e.CreatedAt,
            removedAt = e.RemovedAt, removedBy = e.RemovedBy,
            urls = new { x1 = _emotes.UrlFor(e, 1), x2 = _emotes.UrlFor(e, 2), x4 = _emotes.UrlFor(e, 4) }
        };

        /// <summary>GET /api/public/global-emotes - Los emotes globales aprobados (la extensión los pide acá)</summary>
        [AllowAnonymous]
        [HttpGet("api/public/global-emotes")]
        public async Task<IActionResult> Public()
        {
            var rows = await _emotes.ListApprovedAsync();
            Response.Headers["Cache-Control"] = "public, max-age=30";
            return Ok(new
            {
                success = true,
                emotes = rows.Select(e => new
                {
                    id = e.Id, name = e.Name, animated = e.Animated, zeroWidth = e.ZeroWidth, width = e.Width, height = e.Height,
                    urls = new { x1 = _emotes.UrlFor(e, 1), x2 = _emotes.UrlFor(e, 2), x4 = _emotes.UrlFor(e, 4) }
                })
            });
        }

        /// <summary>GET /api/admin/global-emotes - Lista y permisos de quien pregunta (404 si no maneja los globales)</summary>
        [Authorize]
        [HttpGet("api/admin/global-emotes")]
        public async Task<IActionResult> List()
        {
            var access = await _emotes.ResolveAccessAsync(Login);
            if (access == "none") return Fail("not_allowed", 403);
            return Ok(new
            {
                success = true,
                access,
                canManagePeople = access == "owner",
                canRestore = access is "owner" or "admin",
                managers = access == "owner" ? (await _emotes.GetManagersAsync()).Select(m => new { id = m.Id, login = m.Login, addedBy = m.AddedBy, createdAt = m.CreatedAt }) : null,
                requests = access == "owner" ? (await _emotes.ListPendingRequestsAsync()).Select(r => new { id = r.Id, login = r.Login, message = r.Message, createdAt = r.CreatedAt }) : null,
                emotes = (await _emotes.ListAsync()).Select(Dto)
            });
        }

        /// <summary>GET /api/admin/global-emotes/check?name= - Avisa si el nombre choca con un global de 7TV, BTTV o FFZ</summary>
        [Authorize]
        [HttpGet("api/admin/global-emotes/check")]
        public async Task<IActionResult> Check([FromQuery] string name)
        {
            if (await _emotes.ResolveAccessAsync(Login) == "none") return Fail("not_allowed", 403);
            return Ok(new { success = true, collides = !string.IsNullOrWhiteSpace(name) && await _emotes.CollidesAsync(name.Trim()) });
        }

        [Authorize]
        [HttpPost("api/admin/global-emotes")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(3_000_000)]
        public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] string name, [FromForm] bool zeroWidth, CancellationToken ct)
        {
            try
            {
                if (await _emotes.ResolveAccessAsync(Login) == "none" || UserId == null) return Fail("not_allowed", 403);
                if (file == null || file.Length == 0) return Fail("invalid_image");
                await using var stream = file.OpenReadStream();
                var result = await _emotes.UploadAsync(UserId.Value, Login ?? "?", name, stream, zeroWidth, ct);
                return result.Success ? Ok(new { success = true, collides = await _emotes.CollidesAsync((name ?? "").Trim()) }) : Fail(result.Error!);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error subiendo un emote global");
                return StatusCode(500, new { success = false, error = "server_error" });
            }
        }

        [Authorize]
        [HttpPatch("api/admin/global-emotes/{id:long}")]
        public async Task<IActionResult> Update(long id, [FromBody] UpdateRequest request)
        {
            if (await _emotes.ResolveAccessAsync(Login) == "none") return Fail("not_allowed", 403);
            var error = await _emotes.UpdateAsync(id, Login ?? "?", request.Name, request.ZeroWidth, request.Visible);
            return error == null ? Ok(new { success = true }) : Fail(error, error == "not_found" ? 404 : 400);
        }

        [Authorize]
        [HttpDelete("api/admin/global-emotes/{id:long}")]
        public async Task<IActionResult> Delete(long id)
        {
            var access = await _emotes.ResolveAccessAsync(Login);
            if (access == "none") return Fail("not_allowed", 403);
            var error = await _emotes.DeleteAsync(id, Login ?? "?", access);
            return error == null ? Ok(new { success = true }) : Fail(error, error == "not_found" ? 404 : 429);
        }

        /// <summary>POST /api/admin/global-emotes/{id}/restore - Saca un emote de la papelera (admins)</summary>
        [Authorize]
        [HttpPost("api/admin/global-emotes/{id:long}/restore")]
        public async Task<IActionResult> Restore(long id)
        {
            if (await _emotes.ResolveAccessAsync(Login) is not ("owner" or "admin")) return Fail("not_allowed", 403);
            var error = await _emotes.RestoreAsync(id, Login ?? "?");
            return error == null ? Ok(new { success = true }) : Fail(error, error == "not_found" ? 404 : 400);
        }

        /// <summary>DELETE /api/admin/global-emotes/{id}/purge - Borra del todo un emote de la papelera (admins)</summary>
        [Authorize]
        [HttpDelete("api/admin/global-emotes/{id:long}/purge")]
        public async Task<IActionResult> Purge(long id)
        {
            if (await _emotes.ResolveAccessAsync(Login) is not ("owner" or "admin")) return Fail("not_allowed", 403);
            var error = await _emotes.PurgeAsync(id, Login ?? "?");
            return error == null ? Ok(new { success = true }) : Fail(error, 404);
        }

        /// <summary>GET /api/admin/global-emotes/log - Historial de cambios (admins)</summary>
        [Authorize]
        [HttpGet("api/admin/global-emotes/log")]
        public async Task<IActionResult> Log()
        {
            if (await _emotes.ResolveAccessAsync(Login) is not ("owner" or "admin")) return Fail("not_allowed", 403);
            return Ok(new { success = true, log = (await _emotes.GetLogAsync()).Select(l => new { id = l.Id, actor = l.Actor, action = l.Action, detail = l.Detail, createdAt = l.CreatedAt }) });
        }

        /// <summary>GET /api/global-emotes/me - Si la persona puede manejar los emotes globales y cómo va su solicitud</summary>
        [Authorize]
        [HttpGet("api/global-emotes/me")]
        public async Task<IActionResult> Me()
        {
            if (ActingForAnotherChannel()) return Ok(new { success = true, delegated = true, access = "none", request = (object?)null });
            var access = await _emotes.ResolveAccessAsync(Login);
            var req = access == "none" && Login != null ? await _emotes.GetMyRequestAsync(Login) : null;
            return Ok(new { success = true, access, request = req == null ? null : new { status = req.Status, createdAt = req.CreatedAt, resolvedAt = req.ResolvedAt } });
        }

        /// <summary>POST /api/global-emotes/request - Pide acceso para manejar los emotes globales</summary>
        [Authorize]
        [HttpPost("api/global-emotes/request")]
        public async Task<IActionResult> RequestAccess([FromBody] AccessRequest? request)
        {
            if (UserId == null || Login == null || ActingForAnotherChannel()) return Fail("not_allowed", 403);
            var error = await _emotes.RequestAccessAsync(UserId.Value, Login, request?.Message);
            return error == null ? Ok(new { success = true }) : Fail(error, 409);
        }

        /// <summary>POST /api/admin/global-emotes/requests/{id}/resolve - El owner aprueba o rechaza una solicitud</summary>
        [Authorize]
        [HttpPost("api/admin/global-emotes/requests/{id:long}/resolve")]
        public async Task<IActionResult> ResolveRequest(long id, [FromBody] ResolveBody request)
        {
            if (await _emotes.ResolveAccessAsync(Login) != "owner") return Fail("not_allowed", 403);
            var error = await _emotes.ResolveRequestAsync(id, request.Approve, Login ?? "?");
            return error == null ? Ok(new { success = true }) : Fail(error, error == "not_found" ? 404 : 400);
        }

        [Authorize]
        [HttpPost("api/admin/global-emotes/managers")]
        public async Task<IActionResult> AddManager([FromBody] ManagerRequest request)
        {
            if (await _emotes.ResolveAccessAsync(Login) != "owner") return Fail("not_allowed", 403);
            var error = await _emotes.AddManagerAsync(request.Login, Login ?? "?");
            return error == null ? Ok(new { success = true }) : Fail(error);
        }

        [Authorize]
        [HttpDelete("api/admin/global-emotes/managers/{id:long}")]
        public async Task<IActionResult> RemoveManager(long id)
        {
            if (await _emotes.ResolveAccessAsync(Login) != "owner") return Fail("not_allowed", 403);
            return await _emotes.RemoveManagerAsync(id, Login ?? "?") ? Ok(new { success = true }) : Fail("not_found", 404);
        }
    }
}
