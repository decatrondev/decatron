using Decatron.Attributes;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>Plataforma, Fase 5.7: pantalla del dueño para plan, complementos y ajustes de cada tenant. La lógica vive en <see cref="TenantPlanAdmin"/>.</summary>
    [ApiController]
    [Route("api/admin/platform")]
    [Authorize, RequireSystemOwner]
    public class PlatformPlansController : ControllerBase
    {
        private readonly TenantPlanAdmin _svc;
        private readonly TenantDataAdmin _data;
        public PlatformPlansController(TenantPlanAdmin svc, TenantDataAdmin data) { _svc = svc; _data = data; }

        public sealed class PurgeBody { public string? ConfirmSlug { get; set; } }

        private string Actor => User.FindFirst("login")?.Value ?? User.Identity?.Name ?? "owner";

        private IActionResult Map(PlanResult r) => r.Ok
            ? Ok(r.Data ?? new { success = true })
            : new ObjectResult(new { success = false, code = r.Code }) { StatusCode = r.Status };

        /// <summary>Planes con sus capacidades y el catálogo de capacidades (para armar los selectores).</summary>
        [HttpGet("plans/catalog")]
        public async Task<IActionResult> Catalog() => Map(await _svc.CatalogAsync());

        /// <summary>Suscripción, complementos, ajustes y uso de un tenant.</summary>
        [HttpGet("tenants/{id:long}/plan")]
        public async Task<IActionResult> Get(long id) => Map(await _svc.GetAsync(id));

        /// <summary>Asigna o cambia el plan y el estado. Crea la suscripción si no existe.</summary>
        [HttpPut("tenants/{id:long}/plan")]
        public async Task<IActionResult> SetPlan(long id, [FromBody] PlanInput body) => Map(await _svc.SetPlanAsync(id, body, Actor));

        /// <summary>Ajuste puntual de una capacidad para el tenant (gana sobre complemento y plan).</summary>
        [HttpPut("tenants/{id:long}/overrides/{key}")]
        public async Task<IActionResult> SetOverride(long id, string key, [FromBody] ValueInput body) => Map(await _svc.SetOverrideAsync(id, key, body, Actor));

        [HttpDelete("tenants/{id:long}/overrides/{key}")]
        public async Task<IActionResult> DeleteOverride(long id, string key) => Map(await _svc.DeleteOverrideAsync(id, key, Actor));

        /// <summary>Complemento (módulo o cuota suelta). Sin fecha, vence con la suscripción.</summary>
        [HttpPost("tenants/{id:long}/addons")]
        public async Task<IActionResult> AddAddon(long id, [FromBody] AddonInput body) => Map(await _svc.AddAddonAsync(id, body, Actor));

        [HttpDelete("tenants/{id:long}/addons/{addonId:long}")]
        public async Task<IActionResult> DeleteAddon(long id, long addonId) => Map(await _svc.DeleteAddonAsync(id, addonId, Actor));

        /// <summary>Exportación de los datos del tenant (zip de JSONL, sin credenciales). Se arma en un archivo temporal y se borra al terminar la descarga.</summary>
        [HttpGet("tenants/{id:long}/export")]
        public async Task<IActionResult> Export(long id, CancellationToken ct)
        {
            var path = Path.Combine(Path.GetTempPath(), $"decatron-export-{id}-{Guid.NewGuid():N}.zip");
            PlanResult res;
            await using (var fs = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                res = await _data.ExportAsync(id, fs, Actor, ct);
            if (!res.Ok) { try { System.IO.File.Delete(path); } catch { } return Map(res); }
            var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, FileOptions.DeleteOnClose);
            return File(stream, "application/zip", $"tenant-{id}-{DateTime.UtcNow:yyyyMMdd}.zip");
        }

        /// <summary>Borra todos los datos del tenant. Irreversible: exige el slug como confirmación y que el tenant no esté operativo.</summary>
        [HttpPost("tenants/{id:long}/purge")]
        public async Task<IActionResult> Purge(long id, [FromBody] PurgeBody body, CancellationToken ct) => Map(await _data.PurgeAsync(id, body?.ConfirmSlug, Actor, ct));
    }
}
