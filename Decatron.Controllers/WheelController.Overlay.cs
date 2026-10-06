using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Models.WheelOfLuck;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Services;
using Decatron.Core.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Controllers
{
    /// <summary>Datos públicos del overlay (sin autenticación). Parte de <see cref="WheelController"/>.</summary>
    public partial class WheelController
    {
        // ====================================================================
        // OVERLAY (sin autenticación: una fuente de OBS no lleva token)
        // ====================================================================

        [HttpGet("overlay")]
        [AllowAnonymous]
        public async Task<IActionResult> GetOverlay([FromQuery] string channel, [FromQuery] string wheel)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (string.IsNullOrWhiteSpace(channel) || string.IsNullOrWhiteSpace(wheel))
                    return BadRequest(new { success = false, message = "Faltan channel y wheel" });

                var data = await _wheels.GetOverlayDataAsync(channel.ToLowerInvariant(), wheel.ToLowerInvariant());
                if (data == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                return Ok(new { success = true, data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error en datos de overlay de {Channel}/{Wheel}", channel, wheel);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }
    }
}
