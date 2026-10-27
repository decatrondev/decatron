using System.Linq;
using System.Text.Json;
using System.Security.Claims;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Models.Promo;
using Decatron.Core.Settings;
using Decatron.Services.Promo;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Decatron.Controllers
{
    /// <summary>
    /// Admin del overlay de Promociones (.dev/plans/overlay-promo/PLAN.md §4): catálogo de piezas, plantillas y topes de
    /// cuidado del espectador. Solo el dueño. Los errores de validación vuelven como códigos (el panel los traduce).
    /// </summary>
    [ApiController]
    [Route("api/admin/promo")]
    [Authorize]
    [RequireSystemOwner]
    public class PromoAdminController : ControllerBase
    {
        private readonly PromoCatalogService _catalog;
        private readonly IOptionsMonitor<PromoOverlaySettings> _settings;

        public PromoAdminController(PromoCatalogService catalog, IOptionsMonitor<PromoOverlaySettings> settings)
        {
            _catalog = catalog;
            _settings = settings;
        }

        private long? GetUserId() => long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var n) ? n : null;

        private IActionResult Failed<T>(PromoCatalogService.Result<T> r) where T : class
            => r.Errors.Contains("pieceNotFound") || r.Errors.Contains("templateNotFound") || r.Errors.Contains("zoneNotFound")
                ? NotFound(new { success = false, errors = r.Errors })
                : BadRequest(new { success = false, errors = r.Errors });

        /// <summary>Todo lo que pinta la pantalla: piezas, plantillas (con cuántas piezas las usan) y topes. Incluye los catálogos de valores válidos.</summary>
        [HttpGet("overview")]
        public async Task<IActionResult> Overview()
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            var o = await _catalog.GetOverviewAsync();
            return Ok(new
            {
                success = true,
                pieces = o.Pieces,
                templates = o.Templates.Select(t => new { template = TemplateDto(t.Template), pieceCount = t.PieceCount }),
                zones = o.Zones.Select(z => new { zone = z.Zone, pieceCount = z.PieceCount, templateCount = z.TemplateCount }),
                limits = o.Limits,
                options = new
                {
                    kinds = PromoValidator.Kinds, origins = PromoValidator.Origins, anchors = PromoValidator.Anchors,
                    platforms = PromoValidator.Platforms, variables = PromoValidator.Variables, icons = PromoValidator.Icons,
                    textVariables = PromoDesignValidator.TextVariables, boxShadows = PromoDesignValidator.BoxShadows,
                    fonts = PromoDesignValidator.Fonts.Select(f => new { family = f.Key, weights = f.Value }),
                },
            });
        }

        /// <summary>La plantilla para el cliente: el diseño va como objeto JSON, no como texto.</summary>
        private static object TemplateDto(PromoTemplate t)
        {
            JsonElement design;
            try { design = JsonDocument.Parse(string.IsNullOrWhiteSpace(t.Design) ? "{}" : t.Design).RootElement.Clone(); }
            catch (JsonException) { design = JsonDocument.Parse("{}").RootElement.Clone(); }
            return new { t.Id, t.Key, t.NameEs, t.NameEn, t.Zone, t.IsEnabled, t.SortOrder, design };
        }

        /// <summary>Crea (id = 0) o edita una pieza.</summary>
        [HttpPut("pieces")]
        public async Task<IActionResult> UpsertPiece([FromBody] PromoPiece req)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            var r = await _catalog.UpsertPieceAsync(req, GetUserId());
            return r.Ok ? Ok(new { success = true, piece = r.Value }) : Failed(r);
        }

        [HttpPost("pieces/{id:long}/duplicate")]
        public async Task<IActionResult> Duplicate(long id)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            var r = await _catalog.DuplicatePieceAsync(id, GetUserId());
            return r.Ok ? Ok(new { success = true, piece = r.Value }) : Failed(r);
        }

        [HttpPost("pieces/{id:long}/status")]
        public async Task<IActionResult> SetStatus(long id, [FromBody] StatusRequest req)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            var r = await _catalog.SetStatusAsync(id, req.Status);
            return r.Ok ? Ok(new { success = true, piece = r.Value }) : Failed(r);
        }

        [HttpDelete("pieces/{id:long}")]
        public async Task<IActionResult> DeletePiece(long id)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            return await _catalog.DeletePieceAsync(id) ? Ok(new { success = true }) : NotFound(new { success = false, errors = new[] { "pieceNotFound" } });
        }

        [HttpPut("templates")]
        public async Task<IActionResult> UpsertTemplate([FromBody] TemplateRequest req)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            var t = new PromoTemplate
            {
                Id = req.Id, Key = req.Key ?? "", NameEs = req.NameEs ?? "", NameEn = req.NameEn ?? "", Zone = req.Zone ?? "",
                IsEnabled = req.IsEnabled, SortOrder = req.SortOrder,
                Design = req.Design.ValueKind == JsonValueKind.Object ? req.Design.GetRawText() : "",
            };
            var r = await _catalog.UpsertTemplateAsync(t);
            return r.Ok ? Ok(new { success = true, template = TemplateDto(r.Value!) }) : Failed(r);
        }

        [HttpDelete("templates/{id:long}")]
        public async Task<IActionResult> DeleteTemplate(long id)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            return await _catalog.DeleteTemplateAsync(id) ? Ok(new { success = true }) : NotFound(new { success = false, errors = new[] { "templateNotFound" } });
        }

        [HttpPut("zones")]
        public async Task<IActionResult> UpsertZone([FromBody] PromoZone req)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            var r = await _catalog.UpsertZoneAsync(req);
            return r.Ok ? Ok(new { success = true, zone = r.Value }) : Failed(r);
        }

        [HttpDelete("zones/{id:long}")]
        public async Task<IActionResult> DeleteZone(long id)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            var errors = await _catalog.DeleteZoneAsync(id);
            if (errors.Count == 0) return Ok(new { success = true });
            return errors.Contains("zoneNotFound") ? NotFound(new { success = false, errors }) : BadRequest(new { success = false, errors });
        }

        [HttpPut("limits")]
        public async Task<IActionResult> UpdateLimits([FromBody] LimitsRequest req)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            var r = await _catalog.UpdateLimitsAsync(req.MinGapSeconds, req.HourlyCapSeconds);
            return r.Ok ? Ok(new { success = true, limits = r.Value }) : Failed(r);
        }

        public class TemplateRequest
        {
            public long Id { get; set; }
            public string? Key { get; set; }
            public string? NameEs { get; set; }
            public string? NameEn { get; set; }
            public string? Zone { get; set; }
            public bool IsEnabled { get; set; } = true;
            public int SortOrder { get; set; }
            public JsonElement Design { get; set; }
        }
        public class StatusRequest { public string Status { get; set; } = ""; }
        public class LimitsRequest { public int MinGapSeconds { get; set; } = 60; public int HourlyCapSeconds { get; set; } = 600; }
    }
}
