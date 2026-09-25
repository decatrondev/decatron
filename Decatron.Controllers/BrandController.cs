using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Services.Brand;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Logos de la marca (.dev/plans/BRAND_LOGOS_PLAN.md). La lectura es pública porque la
    /// piden la landing, las páginas públicas y los overlays de OBS sin sesión; todo lo que
    /// escribe es solo del dueño del sistema.
    /// </summary>
    [ApiController]
    public class BrandController : ControllerBase
    {
        private static readonly string[] AllowedExtensions = { ".png", ".webp", ".jpg", ".jpeg", ".gif", ".svg", ".ico" };
        private const long MaxUploadBytes = 5 * 1024 * 1024;
        private static readonly Regex SlotKeyRx = new("^[a-z0-9][a-z0-9-]{0,59}$", RegexOptions.Compiled);

        private readonly BrandService _brand;

        public BrandController(BrandService brand)
        {
            _brand = brand;
        }

        [HttpGet("api/brand")]
        [AllowAnonymous]
        public async Task<IActionResult> Public()
        {
            // Corto a propósito: un cambio del admin tiene que verse al recargar.
            Response.Headers["Cache-Control"] = "public, max-age=15";
            var b = await _brand.GetPublicAsync();
            return Ok(new { success = true, assets = b.Assets, slots = b.Slots, updatedAt = b.UpdatedAt });
        }

        // ─── Admin ───────────────────────────────────────────────────────────

        [HttpGet("api/admin/brand")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> Admin()
        {
            var b = await _brand.GetAdminAsync();
            return Ok(new { success = true, assets = b.Assets, slots = b.Slots, updatedAt = b.UpdatedAt });
        }

        // [FromForm] + [Consumes]: con [ApiController] un multipart sin esto se rechaza con 415.
        [HttpPost("api/admin/brand/assets")]
        [Authorize, RequireSystemOwner]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MaxUploadBytes + 64 * 1024)]
        public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] string? name, [FromForm] int width, [FromForm] int height)
        {
            if (file == null || file.Length == 0) return BadRequest(new { success = false, message = "Archivo vacío" });
            if (file.Length > MaxUploadBytes) return BadRequest(new { success = false, message = "Máximo 5 MB" });
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(ext))
                return BadRequest(new { success = false, message = "Formato no soportado (png, webp, jpg, gif, svg, ico)" });

            await using var stream = file.OpenReadStream();
            var asset = await _brand.AddAssetAsync(name ?? Path.GetFileNameWithoutExtension(file.FileName), ext, stream, width, height);
            return Ok(new { success = true, asset });
        }

        public class RenameRequest { public string Name { get; set; } = ""; }

        [HttpPatch("api/admin/brand/assets/{id:long}")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> Rename(long id, [FromBody] RenameRequest req)
        {
            var a = await _brand.RenameAssetAsync(id, req.Name);
            return a == null ? NotFound(new { success = false }) : Ok(new { success = true, asset = a });
        }

        [HttpDelete("api/admin/brand/assets/{id:long}")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> DeleteAsset(long id)
            => await _brand.DeleteAssetAsync(id) ? Ok(new { success = true }) : NotFound(new { success = false });

        [HttpPut("api/admin/brand/slots/{key}")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> SaveSlot(string key, [FromBody] JsonElement config)
        {
            if (!SlotKeyRx.IsMatch(key)) return BadRequest(new { success = false, message = "Clave de lugar inválida" });
            if (config.ValueKind != JsonValueKind.Object) return BadRequest(new { success = false, message = "La configuración debe ser un objeto" });
            var json = config.GetRawText();
            if (json.Length > BrandService.MaxConfigBytes) return BadRequest(new { success = false, message = "Configuración demasiado grande" });
            await _brand.SaveSlotAsync(key, json);
            return Ok(new { success = true });
        }

        [HttpDelete("api/admin/brand/slots/{key}")]
        [Authorize, RequireSystemOwner]
        public async Task<IActionResult> ResetSlot(string key)
        {
            if (!SlotKeyRx.IsMatch(key)) return BadRequest(new { success = false });
            await _brand.ResetSlotAsync(key);
            return Ok(new { success = true });
        }
    }
}
