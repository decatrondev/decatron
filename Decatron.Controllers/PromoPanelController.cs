using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Settings;
using Decatron.Hubs;
using Decatron.Services.Accounts;
using Decatron.Services.Promo;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Controllers
{
    /// <summary>
    /// Panel del streamer del overlay de Promociones (/overlays/promo): su clave de overlay, qué fuentes tiene conectadas en OBS y
    /// qué piezas del catálogo se están mostrando. Solo lectura por ahora; lo que el streamer personaliza llega en la fase siguiente.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/promo-panel")]
    [Decatron.Core.Interfaces.RequiresModule("module.ov_promo")]
    public class PromoPanelController : ControllerBase
    {
        public const string OverlayType = "promo";

        private readonly AccountChannelResolver _accounts;
        private readonly PromoCatalogService _catalog;
        private readonly IOptionsMonitor<PromoOverlaySettings> _settings;
        private readonly ILogger<PromoPanelController> _logger;

        public PromoPanelController(AccountChannelResolver accounts, PromoCatalogService catalog,
            IOptionsMonitor<PromoOverlaySettings> settings, ILogger<PromoPanelController> logger)
        {
            _accounts = accounts;
            _catalog = catalog;
            _settings = settings;
            _logger = logger;
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId)) return sessionId;
            if (long.TryParse(User.FindFirst("ChannelOwnerId")?.Value, out var claimId)) return claimId;
            return long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var n) ? n : 0;
        }

        /// <summary>Clave de la cuenta, canales vinculados y cuántas fuentes del overlay hay conectadas en OBS (por variante) y si se pisan.</summary>
        [HttpGet("status")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Status()
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            try
            {
                var account = await _accounts.ResolveByUserIdAsync(GetChannelOwnerId());
                if (account == null) return NotFound(new { success = false, message = "Canal no encontrado" });

                var counts = OverlayHub.CountOverlayVariants(account.OverlayKey, OverlayType);
                var warnings = new System.Collections.Generic.List<string>();
                if (counts["all"] > 0 && (counts["twitch"] > 0 || counts["kick"] > 0)) warnings.Add("mixed");
                if (counts.Values.Any(c => c > 1)) warnings.Add("repeated");
                return Ok(new
                {
                    success = true,
                    total = counts.Values.Sum(),
                    all = counts["all"], twitch = counts["twitch"], kick = counts["kick"],
                    warnings,
                    overlayKey = account.OverlayKey,
                    hasTwitch = account.HasTwitch,
                    hasKick = account.HasKick,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo el estado del overlay de promociones");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Las piezas publicadas que le tocan a este canal (mismas reglas que la rotación), las zonas y los topes.</summary>
        [HttpGet("catalog")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Catalog()
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            try
            {
                var account = await _accounts.ResolveByUserIdAsync(GetChannelOwnerId());
                if (account == null) return NotFound(new { success = false, message = "Canal no encontrado" });
                var snap = await _catalog.GetPublishedAsync();
                var logins = account.Members.Select(m => m.Login).ToList();
                var mine = logins.Select(l => l.ToLowerInvariant()).ToHashSet();
                var pieces = snap.Pieces
                    .Where(p => string.IsNullOrWhiteSpace(p.OnlyChannels)
                        || p.OnlyChannels.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Any(c => mine.Contains(c.ToLowerInvariant())))
                    .Select(p => new
                    {
                        p.Id, p.Kind, p.TitleEs, p.TitleEn, p.BodyEs, p.BodyEn, p.Zone, p.Platforms, p.DurationSeconds, p.Priority, p.Weight,
                        p.StartsAt, p.EndsAt, p.TemplateId, p.LinkUrl, p.ShowQr, p.ImageUrl, p.Icon,
                    });
                return Ok(new
                {
                    success = true,
                    pieces,
                    templates = snap.Templates.Select(t => new { t.Id, t.Zone, design = System.Text.Json.JsonDocument.Parse(t.Design).RootElement }),
                    zones = snap.Zones.Select(z => new { z.Key, z.NameEs, z.NameEn, z.Anchor, z.MarginX, z.MarginY }),
                    limits = new { snap.Limits.MinGapSeconds, snap.Limits.HourlyCapSeconds },
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo el catálogo de promociones del streamer");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }
    }
}
