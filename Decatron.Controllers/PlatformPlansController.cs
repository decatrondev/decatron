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
        public PlatformPlansController(TenantPlanAdmin svc) { _svc = svc; }

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
    }
}
