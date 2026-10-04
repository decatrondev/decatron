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

        private string? Login => User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value;
        private long? UserId => long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;
        private IActionResult Fail(string error, int status = 400) => StatusCode(status, new { success = false, error });

        private object Dto(GlobalEmote e) => new
        {
            id = e.Id, name = e.Name, status = e.Status, animated = e.Animated, zeroWidth = e.ZeroWidth,
            width = e.Width, height = e.Height, bytes = e.Bytes, uploadedBy = e.UploadedByName, createdAt = e.CreatedAt,
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
                managers = access == "owner" ? (await _emotes.GetManagersAsync()).Select(m => new { id = m.Id, login = m.Login, addedBy = m.AddedBy, createdAt = m.CreatedAt }) : null,
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
                var result = await _emotes.UploadAsync(UserId.Value, name, stream, zeroWidth, ct);
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
            var error = await _emotes.UpdateAsync(id, request.Name, request.ZeroWidth, request.Visible);
            return error == null ? Ok(new { success = true }) : Fail(error, error == "not_found" ? 404 : 400);
        }

        [Authorize]
        [HttpDelete("api/admin/global-emotes/{id:long}")]
        public async Task<IActionResult> Delete(long id)
        {
            if (await _emotes.ResolveAccessAsync(Login) == "none") return Fail("not_allowed", 403);
            return await _emotes.DeleteAsync(id) ? Ok(new { success = true }) : Fail("not_found", 404);
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
            return await _emotes.RemoveManagerAsync(id) ? Ok(new { success = true }) : Fail("not_found", 404);
        }
    }
}
