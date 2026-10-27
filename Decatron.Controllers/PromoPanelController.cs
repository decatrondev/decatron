using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Models.Promo;
using Decatron.Core.Settings;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
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
        private readonly DecatronDbContext _db;
        private readonly ILogger<PromoPanelController> _logger;

        public PromoPanelController(AccountChannelResolver accounts, PromoCatalogService catalog,
            IOptionsMonitor<PromoOverlaySettings> settings, DecatronDbContext db, ILogger<PromoPanelController> logger)
        {
            _accounts = accounts;
            _catalog = catalog;
            _settings = settings;
            _db = db;
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
                var principalId = account.Principal.UserId;
                var prefs = await _db.PromoChannelSettings.AsNoTracking().FirstOrDefaultAsync(c => c.UserId == principalId);
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
                    mine = new { paused = prefs?.Paused ?? false, disabledPieces = PromoPlayback.DisabledIds(prefs), minGapSeconds = prefs?.MinGapSeconds, hourlyCapSeconds = prefs?.HourlyCapSeconds },
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo el catálogo de promociones del streamer");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        public record SaveRequest(bool Paused, long[]? DisabledPieces, int? MinGapSeconds, int? HourlyCapSeconds);

        /// <summary>Guarda lo que el streamer decide: pausar, piezas apagadas y topes más discretos (nunca más insistentes que los globales).</summary>
        [HttpPut("settings")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Save([FromBody] SaveRequest req)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            try
            {
                var account = await _accounts.ResolveByUserIdAsync(GetChannelOwnerId());
                if (account == null) return NotFound(new { success = false, message = "Canal no encontrado" });
                var snap = await _catalog.GetPublishedAsync();
                if (req.MinGapSeconds is < 0 or > 3600 || req.HourlyCapSeconds is < 0 or > 3600)
                    return BadRequest(new { success = false, errors = new[] { "outOfRange" } });
                if (req.MinGapSeconds is int gap && gap < snap.Limits.MinGapSeconds
                    || req.HourlyCapSeconds is int cap && snap.Limits.HourlyCapSeconds > 0 && cap > snap.Limits.HourlyCapSeconds)
                    return BadRequest(new { success = false, errors = new[] { "moreInsistent" } });

                var known = snap.Pieces.Select(p => p.Id).ToHashSet();
                var disabled = (req.DisabledPieces ?? Array.Empty<long>()).Where(known.Contains).Distinct().OrderBy(i => i).ToList();

                var principalId = account.Principal.UserId;
                var row = await _db.PromoChannelSettings.FirstOrDefaultAsync(c => c.UserId == principalId);
                if (row == null) { row = new PromoChannelSettings { UserId = principalId }; _db.PromoChannelSettings.Add(row); }
                row.Paused = req.Paused;
                row.DisabledPieces = System.Text.Json.JsonSerializer.Serialize(disabled);
                row.MinGapSeconds = req.MinGapSeconds;
                row.HourlyCapSeconds = req.HourlyCapSeconds;
                row.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando las preferencias del overlay de promociones");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }
    }
}
