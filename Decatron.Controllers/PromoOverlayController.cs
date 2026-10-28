using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Interfaces;
using Decatron.Core.Models.Promo;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services.Accounts;
using Decatron.Services.Promo;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Controllers
{
    /// <summary>
    /// Lo que lee el overlay de OBS de Promociones (público, sin sesión). El servidor decide qué pieza sale y cuándo
    /// (<see cref="PromoPlayback"/>); el navegador solo dibuja. Patrón: .dev/plans/MULTIPLATAFORMA_PATRON.md.
    /// </summary>
    [ApiController]
    [Route("api/promo")]
    [AllowAnonymous]
    public class PromoOverlayController : ControllerBase
    {
        private readonly PromoCatalogService _catalog;
        private readonly AccountChannelResolver _accounts;
        private readonly DecatronDbContext _db;
        private readonly IOptionsMonitor<PromoOverlaySettings> _settings;
        private readonly ITenantResolver _tenants;
        private readonly ILogger<PromoOverlayController> _logger;

        public PromoOverlayController(PromoCatalogService catalog, AccountChannelResolver accounts, DecatronDbContext db,
            IOptionsMonitor<PromoOverlaySettings> settings, ITenantResolver tenants, ILogger<PromoOverlayController> logger)
        {
            _catalog = catalog;
            _accounts = accounts;
            _db = db;
            _settings = settings;
            _tenants = tenants;
            _logger = logger;
        }

        /// <summary>GET /api/promo/resolve/{alias}: a qué clave unirse, qué mostraba ese enlace antes, las zonas y el idioma del streamer.</summary>
        [HttpGet("resolve/{alias}")]
        public async Task<IActionResult> Resolve(string alias)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            try
            {
                var resolved = await _accounts.ResolveAliasAsync(alias);
                if (resolved == null) return Ok(new { success = true, found = false });
                var snap = await _catalog.GetPublishedAsync();
                var lang = await LanguageOfAsync(resolved.Account.Principal.UserId);
                // El overlay es anónimo: se fija el tenant del canal para leer la posición de zonas que eligió el streamer (RLS).
                using var tenantScope = TenantAmbient.Push(_tenants.ByChannelKey(resolved.Account.OverlayKey).TenantId);
                var zoneOver = await _db.PromoZoneOverrides.AsNoTracking().Where(o => o.UserId == resolved.Account.Principal.UserId).ToListAsync();
                return Ok(new
                {
                    success = true,
                    found = true,
                    overlayKey = resolved.Account.OverlayKey,
                    variant = resolved.LegacyVariant,
                    language = lang,
                    zones = snap.Zones.Select(z => PromoOverrides.ApplyToZone(z, zoneOver.FirstOrDefault(o => o.ZoneKey == z.Key), snap.Limits))
                        .Select(z => new { z.Key, z.Anchor, z.MarginX, z.MarginY }),
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resolviendo el canal del overlay de promociones");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// GET /api/promo/next/{alias}?zone=&amp;source=: la siguiente pieza de una zona, o cuántos segundos esperar. Pensado para
        /// que el overlay lo pida cuando su zona queda libre (una vez por pieza, no cada segundo).
        /// </summary>
        [HttpGet("next/{alias}")]
        public async Task<IActionResult> Next(string alias, [FromQuery] string zone, [FromQuery] string? source)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            try
            {
                var resolved = await _accounts.ResolveAliasAsync(alias);
                if (resolved == null) return Ok(new { success = true, found = false });

                // El overlay es anónimo: sin sesión el tenant sería el #1. Se fija el del canal para leer sus preferencias (RLS).
                using var tenantScope = TenantAmbient.Push(_tenants.ByChannelKey(resolved.Account.OverlayKey).TenantId);
                var principalId = resolved.Account.Principal.UserId;
                var mine = await _db.PromoChannelSettings.AsNoTracking().FirstOrDefaultAsync(c => c.UserId == principalId);
                var variant = OverlayVariant.Parse(source) ?? resolved.LegacyVariant;
                var snap = await _catalog.GetPublishedAsync();
                var limits = PromoPlayback.EffectiveLimits(snap.Limits, mine);
                var state = PromoPlayback.StateOf(resolved.Account.OverlayKey);
                var ownCards = await _db.PromoOwnCards.AsNoTracking().Where(c => c.UserId == principalId).ToListAsync();

                // «Una pieza a la vez»: mientras otra zona tiene una pieza en pantalla, esta espera (también lo pedido con el comando o un disparador).
                if (limits.OneAtATime)
                {
                    int busy;
                    lock (state.Gate) busy = PromoPlayback.OtherZoneBusySeconds(state, zone, DateTime.UtcNow);
                    if (busy > 0) return Ok(new { success = true, found = true, wait = Math.Max(busy, 2) });
                }

                // Pieza pedida con el comando del chat: sale ya, aunque el streamer tenga pausado o apagada esa pieza (la pidió él o su equipo).
                long? forcedId;
                lock (state.Gate) forcedId = PromoCommand.TakeForced(state, zone, DateTime.UtcNow);
                if (forcedId != null)
                {
                    var loginsF = resolved.Account.Members.Select(m => m.Login).ToList();
                    PromoPiece? forcedRaw;
                    if (PromoOwnCards.IsOwnPieceId(forcedId.Value))
                    {
                        // Tarjeta propia pedida con el comando: sale aunque esté apagada, pero no si el dueño la ocultó.
                        var card = ownCards.FirstOrDefault(c => PromoOwnCards.PieceId(c.Id) == forcedId && c.Zone == zone && !c.HiddenByAdmin);
                        forcedRaw = card == null ? null : PromoOwnCards.ToPiece(card, snap.Templates, snap.Limits);
                    }
                    else
                        forcedRaw = snap.Pieces.FirstOrDefault(p => p.Id == forcedId && p.Kind != PromoPlayback.EmergencyKind
                            && PromoPlayback.IsEligible(p, zone, variant, loginsF, DateTime.UtcNow));
                    var forced = forcedRaw == null ? null : PromoOverrides.ApplyToPiece(forcedRaw, PromoOwnCards.IsOwnPieceId(forcedRaw.Id) ? null : await PieceOverrideAsync(principalId, forcedRaw.Id), snap.Limits, snap.Templates);
                    if (forced != null && TemplateFor(snap, forced.Piece) != null)
                    {
                        lock (state.Gate) PromoPlayback.MarkShown(state, forced.Piece, limits, DateTime.UtcNow);
                        await _catalog.CountViewAsync(principalId, forced.Piece.Id, forced.Piece.DurationSeconds);
                        return Ok(await BuildNextAsync(resolved, forced.Piece, snap, forced.ScalePercent));
                    }
                }

                if (mine?.Paused == true) return Ok(new { success = true, found = true, wait = 60 });
                var disabled = PromoPlayback.DisabledIds(mine);
                var zoneRow = snap.Zones.FirstOrDefault(z => z.Key == zone);
                if (zoneRow == null) return Ok(new { success = true, found = true, wait = 60 });

                var now = DateTime.UtcNow;
                var logins = resolved.Account.Members.Select(m => m.Login).ToList();
                var pieceOver = await _db.PromoPieceOverrides.AsNoTracking().Where(o => o.UserId == principalId).ToListAsync();
                var scales = new Dictionary<long, int>();
                var eligible = new List<PromoPiece>();
                foreach (var raw in snap.Pieces.Where(p => PromoPlayback.IsEligible(p, zone, variant, logins, now) && p.Kind != PromoPlayback.EmergencyKind && !disabled.Contains(p.Id)))
                {
                    var merged = PromoOverrides.ApplyToPiece(raw, pieceOver.FirstOrDefault(o => o.PieceId == raw.Id), snap.Limits, snap.Templates);
                    if (TemplateFor(snap, merged.Piece) == null) continue;
                    eligible.Add(merged.Piece);
                    scales[raw.Id] = merged.ScalePercent;
                }
                if (eligible.Count == 0) return Ok(new { success = true, found = true, wait = 60 });

                PromoPiece? piece;
                int wait;
                lock (state.Gate)
                {
                    state.LastPiece.TryGetValue(zone, out var last);
                    long? lastId = state.LastPiece.ContainsKey(zone) ? last : null;
                    // Tarjetas propias: solo después de pieza(s) del bot (proporción que fija el dueño) y si hay alguna del bot activa en este canal.
                    PromoPiece? ownPiece = null;
                    if (PromoOwnCards.OwnTurn(state.BotSinceOwn, eligible.Count, snap.Limits))
                    {
                        var card = PromoOwnCards.Pick(PromoOwnCards.Eligible(ownCards, zone, snap.Limits, snap.Templates, state.OwnLastShown, now), lastId, Random.Shared.NextDouble());
                        if (card != null) ownPiece = PromoOwnCards.ToPiece(card, snap.Templates, snap.Limits);
                    }
                    piece = ownPiece ?? PromoPlayback.Pick(eligible, lastId, Random.Shared.NextDouble());
                    var rotateNow = state.RotateNowUntil is DateTime until && until > now;
                    wait = piece == null ? 60 : rotateNow ? 0 : PromoPlayback.WaitSeconds(state, zone, limits, piece.DurationSeconds, now);
                    if (piece != null && wait == 0) { PromoPlayback.MarkShown(state, piece, limits, now); if (rotateNow) state.RotateNowUntil = null; }
                }
                if (piece == null || wait > 0) return Ok(new { success = true, found = true, wait = Math.Max(wait, 5) });

                await _catalog.CountViewAsync(principalId, piece.Id, piece.DurationSeconds);
                return Ok(await BuildNextAsync(resolved, piece, snap, scales.GetValueOrDefault(piece.Id, 100)));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error eligiendo la siguiente promoción");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// GET /api/promo/emergency/{alias}?source=: la pieza de emergencia vigente para este canal, si hay. El overlay lo consulta cada pocos
        /// segundos; mientras haya una, detiene la rotación y la deja en pantalla hasta que el dueño la despublique o venza.
        /// </summary>
        [HttpGet("emergency/{alias}")]
        public async Task<IActionResult> Emergency(string alias, [FromQuery] string? source)
        {
            if (!_settings.CurrentValue.Enabled) return NotFound();
            try
            {
                var resolved = await _accounts.ResolveAliasAsync(alias);
                if (resolved == null) return Ok(new { success = true, found = false });
                var variant = OverlayVariant.Parse(source) ?? resolved.LegacyVariant;
                var snap = await _catalog.GetPublishedAsync();
                var logins = resolved.Account.Members.Select(m => m.Login).ToList();
                var piece = PromoPlayback.PickEmergency(snap.Pieces, variant, logins, DateTime.UtcNow);
                var template = piece == null ? null : TemplateFor(snap, piece);
                if (piece == null || template == null) return Ok(new { success = true, found = true, active = false });

                var en = await LanguageOfAsync(resolved.Account.Principal.UserId) == "en";
                return Ok(new
                {
                    success = true,
                    found = true,
                    active = true,
                    pieceId = piece.Id,
                    zone = piece.Zone,
                    design = JsonDocument.Parse(template.Design).RootElement,
                    content = new
                    {
                        title = en && piece.TitleEn != "" ? piece.TitleEn : piece.TitleEs,
                        body = en && piece.BodyEn != "" ? piece.BodyEn : piece.BodyEs,
                        link = piece.LinkUrl,
                        imageUrl = piece.ImageUrl,
                        icon = piece.Icon,
                        showQr = piece.ShowQr,
                    },
                    channel = resolved.Account.Principal.Login,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando la promoción de emergencia");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Cuerpo de la respuesta de "next" cuando hay una pieza para mostrar (la de la rotación o la pedida por el comando).</summary>
        private async Task<object> BuildNextAsync(ResolvedAlias resolved, PromoPiece piece, PromoCatalogService.PublishedSnapshot snap, int scalePercent = 100)
        {
            var template = TemplateFor(snap, piece)!;
            var styleRow = await _db.PromoTemplateOverrides.AsNoTracking().FirstOrDefaultAsync(o => o.UserId == resolved.Account.Principal.UserId && o.TemplateId == template.Id);
            var style = styleRow == null ? new System.Collections.Generic.Dictionary<string, string>() : PromoSlots.Sanitize(template.Design, PromoSlots.ParseStyle(styleRow.Style));
            var en = await LanguageOfAsync(resolved.Account.Principal.UserId) == "en";
            return new
            {
                success = true,
                found = true,
                wait = 0,
                pieceId = piece.Id,
                seconds = piece.DurationSeconds,
                scale = scalePercent / 100.0,
                design = JsonDocument.Parse(template.Design).RootElement,
                style,
                content = new
                {
                    title = en && piece.TitleEn != "" ? piece.TitleEn : piece.TitleEs,
                    body = en && piece.BodyEn != "" ? piece.BodyEn : piece.BodyEs,
                    link = piece.LinkUrl,
                    imageUrl = piece.ImageUrl,
                    icon = piece.Icon,
                    showQr = piece.ShowQr,
                },
                channel = resolved.Account.Principal.Login,
                needsCommands = (piece.BodyEs + piece.BodyEn + piece.TitleEs + piece.TitleEn).Contains("{{commands}}", StringComparison.OrdinalIgnoreCase),
            };
        }

        private Task<PromoPieceOverride?> PieceOverrideAsync(long principalId, long pieceId) =>
            _db.PromoPieceOverrides.AsNoTracking().FirstOrDefaultAsync(o => o.UserId == principalId && o.PieceId == pieceId);

        private static PromoTemplate? TemplateFor(PromoCatalogService.PublishedSnapshot snap, PromoPiece p) =>
            (p.TemplateId != null ? snap.Templates.FirstOrDefault(t => t.Id == p.TemplateId) : null)
            ?? snap.Templates.FirstOrDefault(t => t.Zone == p.Zone);

        private async Task<string> LanguageOfAsync(long userId)
        {
            var lang = await _db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => u.PreferredLanguage).FirstOrDefaultAsync();
            return lang != null && lang.StartsWith("en", StringComparison.OrdinalIgnoreCase) ? "en" : "es";
        }
    }
}
