using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
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
        private readonly ILogger<PromoOverlayController> _logger;

        public PromoOverlayController(PromoCatalogService catalog, AccountChannelResolver accounts, DecatronDbContext db,
            IOptionsMonitor<PromoOverlaySettings> settings, ILogger<PromoOverlayController> logger)
        {
            _catalog = catalog;
            _accounts = accounts;
            _db = db;
            _settings = settings;
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
                return Ok(new
                {
                    success = true,
                    found = true,
                    overlayKey = resolved.Account.OverlayKey,
                    variant = resolved.LegacyVariant,
                    language = lang,
                    zones = snap.Zones.Select(z => new { z.Key, z.Anchor, z.MarginX, z.MarginY }),
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

                var variant = OverlayVariant.Parse(source) ?? resolved.LegacyVariant;
                var snap = await _catalog.GetPublishedAsync();
                var zoneRow = snap.Zones.FirstOrDefault(z => z.Key == zone);
                if (zoneRow == null) return Ok(new { success = true, found = true, wait = 60 });

                var now = DateTime.UtcNow;
                var logins = resolved.Account.Members.Select(m => m.Login).ToList();
                var eligible = snap.Pieces.Where(p => PromoPlayback.IsEligible(p, zone, variant, logins, now))
                    .Where(p => TemplateFor(snap, p) != null).ToList();
                if (eligible.Count == 0) return Ok(new { success = true, found = true, wait = 60 });

                var state = PromoPlayback.StateOf(resolved.Account.OverlayKey);
                PromoPiece? piece;
                int wait;
                lock (state.Gate)
                {
                    state.LastPiece.TryGetValue(zone, out var last);
                    piece = PromoPlayback.Pick(eligible, state.LastPiece.ContainsKey(zone) ? last : null, Random.Shared.NextDouble());
                    wait = piece == null ? 60 : PromoPlayback.WaitSeconds(state, zone, snap.Limits, piece.DurationSeconds, now);
                    if (piece != null && wait == 0) PromoPlayback.MarkShown(state, piece, snap.Limits, now);
                }
                if (piece == null || wait > 0) return Ok(new { success = true, found = true, wait = Math.Max(wait, 5) });

                var template = TemplateFor(snap, piece)!;
                var lang = await LanguageOfAsync(resolved.Account.Principal.UserId);
                var en = lang == "en";
                return Ok(new
                {
                    success = true,
                    found = true,
                    wait = 0,
                    pieceId = piece.Id,
                    seconds = piece.DurationSeconds,
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
                    needsCommands = (piece.BodyEs + piece.BodyEn + piece.TitleEs + piece.TitleEn).Contains("{{commands}}", StringComparison.OrdinalIgnoreCase),
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error eligiendo la siguiente promoción");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

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
