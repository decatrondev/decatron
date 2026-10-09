using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Services.Design;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Valores de diseño del sitio (.dev/plans/SISTEMA_DE_DISENO_PLAN.md, Fase 4). La lectura es pública
    /// porque el front la pide antes de dibujar cualquier página; todo lo que escribe es solo del dueño.
    /// </summary>
    [ApiController]
    public class DesignController : ControllerBase
    {
        private readonly DesignService _design;
        public DesignController(DesignService design) { _design = design; }

        private string Login => User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        [HttpGet("api/design/tokens")]
        [AllowAnonymous]
        public async Task<IActionResult> Public()
        {
            // Corto a propósito: una publicación tiene que verse al recargar.
            Response.Headers["Cache-Control"] = "public, max-age=15";
            var p = await _design.GetPublicAsync();
            return Ok(new { success = true, version = p.Version, publishedAt = p.PublishedAt, values = p.Values });
        }

        [HttpGet("api/admin/design")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> Admin()
        {
            var (draft, published, history) = await _design.GetAdminAsync();
            return Ok(new { success = true, draft, published, history });
        }

        public class DraftRequest { public JsonElement Values { get; set; } public string? Note { get; set; } }

        [HttpPut("api/admin/design/draft")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> SaveDraft([FromBody] DraftRequest req)
        {
            try { return Ok(new { success = true, draft = await _design.SaveDraftAsync(req.Values, req.Note ?? "", Login) }); }
            catch (DesignService.InvalidValuesException e) { return BadRequest(new { success = false, message = e.Message }); }
        }

        [HttpDelete("api/admin/design/draft")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> DiscardDraft()
        {
            await _design.DiscardDraftAsync();
            return Ok(new { success = true });
        }

        public class PublishRequest { public string? Note { get; set; } }

        [HttpPost("api/admin/design/publish")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> Publish([FromBody] PublishRequest? req)
        {
            var v = await _design.PublishAsync(req?.Note ?? "", Login);
            return v == null ? BadRequest(new { success = false, message = "No hay borrador para publicar" }) : Ok(new { success = true, published = v });
        }

        [HttpPost("api/admin/design/reset")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> Reset()
        {
            await _design.ResetAsync(Login);
            return Ok(new { success = true });
        }

        [HttpPost("api/admin/design/versions/{id:long}/restore")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> Restore(long id)
        {
            var d = await _design.RestoreToDraftAsync(id, Login);
            return d == null ? NotFound(new { success = false }) : Ok(new { success = true, draft = d });
        }
    }
}
