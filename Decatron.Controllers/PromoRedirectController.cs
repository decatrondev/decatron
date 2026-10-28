using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services.Accounts;
using Decatron.Services.Promo;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Controllers
{
    /// <summary>
    /// Enlace corto del QR de Promociones (<c>/r/{código}</c>): cuenta el clic de forma agregada y redirige al destino de la pieza o tarjeta.
    /// El destino sale SIEMPRE del catálogo o de la tarjeta (el código no lo lleva), así que no es una redirección abierta. Plan: .dev/plans/overlay-promo/PLAN.md.
    /// </summary>
    [ApiController]
    [Route("r")]
    [AllowAnonymous]
    public class PromoRedirectController : ControllerBase
    {
        private const string Fallback = "https://decatron.net";

        private readonly PromoCatalogService _catalog;
        private readonly AccountChannelResolver _accounts;
        private readonly DecatronDbContext _db;
        private readonly IOptionsMonitor<PromoOverlaySettings> _settings;
        private readonly ITenantResolver _tenants;
        private readonly IMemoryCache _cache;
        private readonly ILogger<PromoRedirectController> _logger;

        public PromoRedirectController(PromoCatalogService catalog, AccountChannelResolver accounts, DecatronDbContext db,
            IOptionsMonitor<PromoOverlaySettings> settings, ITenantResolver tenants, IMemoryCache cache, ILogger<PromoRedirectController> logger)
        {
            _catalog = catalog; _accounts = accounts; _db = db; _settings = settings; _tenants = tenants; _cache = cache; _logger = logger;
        }

        [HttpGet("{code}")]
        public async Task<IActionResult> Go(string code)
        {
            Response.Headers["Cache-Control"] = "no-store";
            Response.Headers["Referrer-Policy"] = "no-referrer";
            if (!_settings.CurrentValue.Enabled || !PromoLinks.TryParse(code, out var pieceId, out var userId)) return Redirect(Fallback);
            try
            {
                var account = await _accounts.ResolveByUserIdAsync(userId);
                if (account == null) return Redirect(Fallback);
                using var tenantScope = TenantAmbient.Push(_tenants.ByChannelKey(account.OverlayKey).TenantId);

                string? target;
                if (PromoOwnCards.IsOwnPieceId(pieceId))
                {
                    var cardId = -pieceId;
                    target = (await _db.PromoOwnCards.AsNoTracking().Where(c => c.Id == cardId && c.UserId == userId && !c.HiddenByAdmin).Select(c => c.LinkUrl).FirstOrDefaultAsync());
                }
                else
                {
                    target = (await _catalog.GetPublishedAsync()).Pieces.FirstOrDefault(p => p.Id == pieceId && p.Kind != PromoPlayback.EmergencyKind)?.LinkUrl;
                }
                if (string.IsNullOrWhiteSpace(target) || !PromoValidator.IsHttpsUrl(target)) return Redirect(Fallback);

                // Un clic por persona y enlace cada 10 minutos, y las vistas previas de enlaces no cuentan. La huella de la IP vive solo en memoria y no se guarda.
                var ip = Request.Headers["CF-Connecting-IP"].FirstOrDefault() ?? HttpContext.Connection.RemoteIpAddress?.ToString() ?? "";
                var key = "promo-click:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(ip + "|" + code)));
                if (!PromoLinks.LooksAutomated(Request.Headers.UserAgent.ToString()) && !_cache.TryGetValue(key, out _))
                {
                    _cache.Set(key, true, TimeSpan.FromMinutes(10));
                    await _catalog.CountClickAsync(userId, pieceId);
                }
                return Redirect(target);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en el enlace corto de promociones");
                return Redirect(Fallback);
            }
        }
    }
}
