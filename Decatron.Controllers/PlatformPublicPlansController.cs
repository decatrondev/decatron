using Decatron.Services.Finance;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase 7.7: catálogo público para la página de planes (decatron.top/planes). Solo lectura y sin datos de nadie: planes de pago con sus precios por periodo,
    /// complementos y el tipo de cambio. Los precios son los de la base: lo que se muestra es lo que cobra el checkout.
    /// </summary>
    [ApiController]
    [Route("api/platform/plans")]
    [AllowAnonymous]
    public class PlatformPublicPlansController : ControllerBase
    {
        private readonly PlatformBillingReader _reader;
        private readonly ExchangeRate _rate;

        public PlatformPublicPlansController(PlatformBillingReader reader, ExchangeRate rate) { _reader = reader; _rate = rate; }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var cat = await _reader.GetCatalogAsync(HttpContext.RequestAborted);
            Response.Headers.CacheControl = "public, max-age=300";
            return Ok(new
            {
                success = true,
                penPerUsd = await _rate.PenPerUsdAsync(HttpContext.RequestAborted),
                igvRate = 0.18m,
                plans = cat.Plans.Select(p => new { key = p.Key, name = p.Name, channels = p.Channels, admins = p.Admins, modules = p.Modules, prices = p.Prices }),
                addons = cat.Addons.Select(a => new { key = a.Key, includedIn = a.IncludedIn, prices = a.Prices }),
            });
        }
    }
}
