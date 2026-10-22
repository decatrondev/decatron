using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Lo que pregunta el overlay de OBS (público, sin sesión). Va aparte de GiveawayController porque ese exige módulo y
    /// permiso. Da la clave de grupo a la que unirse, la variante que mostraba ese enlace antes y la foto completa del
    /// giveaway; después el servidor solo emite cambios. Plan: .dev/plans/giveaways/PLAN.md, F3b.
    /// </summary>
    [ApiController]
    [Route("api/giveaway-overlay")]
    [AllowAnonymous]
    public class GiveawayOverlayController : ControllerBase
    {
        private readonly GiveawayOverlayService _overlay;
        private readonly ILogger<GiveawayOverlayController> _logger;

        public GiveawayOverlayController(GiveawayOverlayService overlay, ILogger<GiveawayOverlayController> logger)
        {
            _overlay = overlay;
            _logger = logger;
        }

        [HttpGet("{alias}")]
        public async Task<IActionResult> Get(string alias)
        {
            try
            {
                var resolved = await _overlay.ResolveAsync(alias);
                if (resolved == null) return Ok(new { success = true, found = false });

                // Cuenta sin fila de Twitch: todavía no hay giveaway posible (se identifica por el id de Twitch)
                var snapshot = resolved.Value.TwitchId == null ? null : await _overlay.BuildSnapshotAsync(resolved.Value.TwitchId);
                return Ok(new { success = true, found = true, overlayKey = resolved.Value.OverlayKey, variant = resolved.Value.Variant, snapshot });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resolviendo el overlay del giveaway");
                return StatusCode(500, new { success = false, message = "An internal error occurred. Please try again later." });
            }
        }
    }
}
