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
using Decatron.Services;
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
        private readonly CommandService _commands;
        private readonly PromoCommandService _promoCommand;
        private readonly ILogger<PromoPanelController> _logger;

        public PromoPanelController(AccountChannelResolver accounts, PromoCatalogService catalog,
            IOptionsMonitor<PromoOverlaySettings> settings, DecatronDbContext db, CommandService commands,
            PromoCommandService promoCommand, ILogger<PromoPanelController> logger)
        {
            _accounts = accounts;
            _catalog = catalog;
            _settings = settings;
            _db = db;
            _commands = commands;
            _promoCommand = promoCommand;
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
                    .Where(p => p.Kind != PromoPlayback.EmergencyKind)
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
                    limits = new
                    {
                        snap.Limits.MinGapSeconds, snap.Limits.HourlyCapSeconds, snap.Limits.MinDurationSeconds, snap.Limits.MaxDurationSeconds,
                        snap.Limits.MinScalePercent, snap.Limits.MaxScalePercent, snap.Limits.MaxZoneMargin,
                    },
                    pieceOverrides = await _db.PromoPieceOverrides.AsNoTracking().Where(o => o.UserId == principalId)
                        .Select(o => new { o.PieceId, o.DurationSeconds, o.TemplateId, o.ScalePercent }).ToListAsync(),
                    templateOverrides = (await _db.PromoTemplateOverrides.AsNoTracking().Where(o => o.UserId == principalId).ToListAsync())
                        .Select(o => new { o.TemplateId, values = PromoSlots.Sanitize(snap.Templates.FirstOrDefault(t => t.Id == o.TemplateId)?.Design, PromoSlots.ParseStyle(o.Style)) }),
                    zoneOverrides = await _db.PromoZoneOverrides.AsNoTracking().Where(o => o.UserId == principalId)
                        .Select(o => new { o.ZoneKey, o.Anchor, o.MarginX, o.MarginY }).ToListAsync(),
                    views = await _catalog.GetChannelViewsAsync(principalId),
                    mine = new { paused = prefs?.Paused ?? false, disabledPieces = PromoPlayback.DisabledIds(prefs), minGapSeconds = prefs?.MinGapSeconds, hourlyCapSeconds = prefs?.HourlyCapSeconds,
                    command = new { enabled = prefs?.CmdEnabled ?? false, name = prefs?.CmdName ?? PromoCommand.DefaultName, cooldownSeconds = prefs?.CmdCooldownSeconds ?? 10, minRole = prefs?.CmdMinRole ?? "moderator" } },
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo el catálogo de promociones del streamer");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        public record PieceOverrideRequest(int? DurationSeconds, long? TemplateId, int? ScalePercent);
        public record ZoneOverrideRequest(string Anchor, int MarginX, int MarginY);
        public record TemplateStyleRequest(System.Collections.Generic.Dictionary<string, string>? Values);

        /// <summary>Colores, textos y tipografía que el streamer elige para una plantilla, solo entre los ajustes que el dueño declaró. Vacío = vuelve al valor del dueño.</summary>
        [HttpPut("template/{templateId:long}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveTemplateStyle(long templateId, [FromBody] TemplateStyleRequest req)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            try
            {
                var account = await _accounts.ResolveByUserIdAsync(GetChannelOwnerId());
                if (account == null) return NotFound(new { success = false, message = "Canal no encontrado" });
                var snap = await _catalog.GetPublishedAsync();
                var template = snap.Templates.FirstOrDefault(t => t.Id == templateId);
                if (template == null) return NotFound(new { success = false, message = "Plantilla no encontrada" });
                var errors = PromoSlots.ValidateValues(template.Design, req.Values);
                if (errors.Count > 0) return BadRequest(new { success = false, errors });

                var principalId = account.Principal.UserId;
                var values = PromoSlots.Sanitize(template.Design, req.Values);
                var row = await _db.PromoTemplateOverrides.FirstOrDefaultAsync(o => o.UserId == principalId && o.TemplateId == templateId);
                if (values.Count == 0)
                {
                    if (row != null) { _db.PromoTemplateOverrides.Remove(row); await _db.SaveChangesAsync(); }
                    return Ok(new { success = true });
                }
                if (row == null) { row = new PromoTemplateOverride { UserId = principalId, TemplateId = templateId }; _db.PromoTemplateOverrides.Add(row); }
                row.Style = System.Text.Json.JsonSerializer.Serialize(values);
                row.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando el estilo de una plantilla de promociones");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Lo que el streamer cambia de una pieza (duración, plantilla, escala), dentro de los límites del dueño. Todo vacío = vuelve al valor del dueño.</summary>
        [HttpPut("piece/{pieceId:long}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SavePiece(long pieceId, [FromBody] PieceOverrideRequest req)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            try
            {
                var account = await _accounts.ResolveByUserIdAsync(GetChannelOwnerId());
                if (account == null) return NotFound(new { success = false, message = "Canal no encontrado" });
                var snap = await _catalog.GetPublishedAsync();
                var piece = snap.Pieces.FirstOrDefault(p => p.Id == pieceId && p.Kind != PromoPlayback.EmergencyKind);
                if (piece == null) return NotFound(new { success = false, message = "Pieza no encontrada" });
                var errors = PromoOverrides.ValidatePiece(req.DurationSeconds, req.ScalePercent, req.TemplateId, piece, snap.Limits, snap.Templates);
                if (errors.Count > 0) return BadRequest(new { success = false, errors });

                var principalId = account.Principal.UserId;
                var row = await _db.PromoPieceOverrides.FirstOrDefaultAsync(o => o.UserId == principalId && o.PieceId == pieceId);
                if (req.DurationSeconds == null && req.TemplateId == null && req.ScalePercent == null)
                {
                    if (row != null) { _db.PromoPieceOverrides.Remove(row); await _db.SaveChangesAsync(); }
                    return Ok(new { success = true });
                }
                if (row == null) { row = new PromoPieceOverride { UserId = principalId, PieceId = pieceId }; _db.PromoPieceOverrides.Add(row); }
                row.DurationSeconds = req.DurationSeconds;
                row.TemplateId = req.TemplateId;
                row.ScalePercent = req.ScalePercent;
                row.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando los ajustes de una pieza de promociones");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Dónde pone el streamer una zona (ancla y márgenes), dentro del margen máximo del dueño.</summary>
        [HttpPut("zone/{key}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveZone(string key, [FromBody] ZoneOverrideRequest req)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            try
            {
                var account = await _accounts.ResolveByUserIdAsync(GetChannelOwnerId());
                if (account == null) return NotFound(new { success = false, message = "Canal no encontrado" });
                var snap = await _catalog.GetPublishedAsync();
                if (!snap.Zones.Any(z => z.Key == key)) return NotFound(new { success = false, message = "Zona no encontrada" });
                var errors = PromoOverrides.ValidateZone(req.Anchor ?? "", req.MarginX, req.MarginY, snap.Limits);
                if (errors.Count > 0) return BadRequest(new { success = false, errors });

                var principalId = account.Principal.UserId;
                var row = await _db.PromoZoneOverrides.FirstOrDefaultAsync(o => o.UserId == principalId && o.ZoneKey == key);
                if (row == null) { row = new PromoZoneOverride { UserId = principalId, ZoneKey = key }; _db.PromoZoneOverrides.Add(row); }
                row.Anchor = req.Anchor!;
                row.MarginX = req.MarginX;
                row.MarginY = req.MarginY;
                row.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando la posición de una zona de promociones");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Vuelve la zona a la posición del dueño.</summary>
        [HttpDelete("zone/{key}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ResetZone(string key)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            try
            {
                var account = await _accounts.ResolveByUserIdAsync(GetChannelOwnerId());
                if (account == null) return NotFound(new { success = false, message = "Canal no encontrado" });
                var principalId = account.Principal.UserId;
                var row = await _db.PromoZoneOverrides.FirstOrDefaultAsync(o => o.UserId == principalId && o.ZoneKey == key);
                if (row != null) { _db.PromoZoneOverrides.Remove(row); await _db.SaveChangesAsync(); }
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restableciendo la posición de una zona de promociones");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        public record CommandRequest(bool Enabled, string? Name, int? CooldownSeconds, string? MinRole);
        public record SaveRequest(bool Paused, long[]? DisabledPieces, int? MinGapSeconds, int? HourlyCapSeconds, CommandRequest? Command = null);

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
                string? cmdName = null;
                if (req.Command != null)
                {
                    cmdName = PromoCommand.NormalizeName(req.Command.Name ?? PromoCommand.DefaultName);
                    if (cmdName == null) return BadRequest(new { success = false, errors = new[] { "cmdInvalid" } });
                    if (req.Command.CooldownSeconds is < 0 or > 600 || req.Command.MinRole != null && !PromoCommand.Roles.Contains(req.Command.MinRole))
                        return BadRequest(new { success = false, errors = new[] { "outOfRange" } });
                    // Solo se revisa el nombre al activarlo o cambiarlo: un nombre que ya funcionaba no se bloquea después.
                    var current = await _db.PromoChannelSettings.AsNoTracking().Where(c => c.UserId == principalId).Select(c => new { c.CmdEnabled, c.CmdName }).FirstOrDefaultAsync();
                    if (req.Command.Enabled && (current is not { CmdEnabled: true } || current.CmdName != cmdName))
                    {
                        if (_commands.IsReservedCommandName("!" + cmdName)) return BadRequest(new { success = false, errors = new[] { "cmdReserved" } });
                        var memberIds = account.Members.Select(m => m.UserId).ToList();
                        var taken = await _db.CustomCommands.AsNoTracking().AnyAsync(c => memberIds.Contains(c.UserId) && c.IsActive
                            && (c.CommandName.ToLower() == "!" + cmdName || c.CommandName.ToLower() == cmdName));
                        if (taken) return BadRequest(new { success = false, errors = new[] { "cmdCustom" } });
                    }
                }
                var row = await _db.PromoChannelSettings.FirstOrDefaultAsync(c => c.UserId == principalId);
                if (row == null) { row = new PromoChannelSettings { UserId = principalId }; _db.PromoChannelSettings.Add(row); }
                row.Paused = req.Paused;
                row.DisabledPieces = System.Text.Json.JsonSerializer.Serialize(disabled);
                row.MinGapSeconds = req.MinGapSeconds;
                row.HourlyCapSeconds = req.HourlyCapSeconds;
                if (req.Command != null)
                {
                    row.CmdEnabled = req.Command.Enabled;
                    row.CmdName = cmdName!;
                    row.CmdCooldownSeconds = req.Command.CooldownSeconds ?? row.CmdCooldownSeconds;
                    row.CmdMinRole = req.Command.MinRole ?? row.CmdMinRole;
                }
                row.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                _promoCommand.Invalidate(principalId);
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
