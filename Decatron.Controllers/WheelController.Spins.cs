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
    /// <summary>Giro de prueba y giro manual desde el panel. Parte de <see cref="WheelController"/>.</summary>
    public partial class WheelController
    {
        // ====================================================================
        // GIRO DE PRUEBA
        // ====================================================================

        /// <summary>
        /// El botón "Probar giro" del panel: anima el overlay con datos reales de la
        /// rueda pero sin escribir historial, tocar stock ni entregar nada.
        /// </summary>
        [HttpPost("wheels/{id:int}/test-spin")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> TestSpin(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var channelLogin = await _db.Users
                    .Where(u => u.Id == channelId)
                    .Select(u => u.Login)
                    .FirstOrDefaultAsync();

                if (channelLogin == null)
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var result = await _wheels.SpinAsync(channelId, channelLogin, id, WheelSpinTriggers.Panel, null, dryRun: true);
                if (result == null)
                    return BadRequest(new { success = false, message = "La rueda no tiene ningún gajo que pueda salir" });

                return Ok(new { success = true, result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error en giro de prueba de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // ====================================================================
        // GIRO MANUAL DESDE EL PANEL
        // ====================================================================

        /// <summary>
        /// El streamer o un mod giran por un espectador. Sirve para quien no quiere
        /// comandos en su chat, y para arreglar a mano un giro que salió mal.
        /// </summary>
        [HttpPost("wheels/{id:int}/spin")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ManualSpin(int id, [FromBody] ManualSpinDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (string.IsNullOrWhiteSpace(dto?.ViewerLogin))
                    return BadRequest(new { success = false, message = "Falta el nombre del espectador" });

                var channelId = GetChannelOwnerId();
                var channelLogin = await _db.Users.Where(u => u.Id == channelId).Select(u => u.Login).FirstOrDefaultAsync();
                if (channelLogin == null) return NotFound(new { success = false, message = "Canal no encontrado" });

                var viewer = dto.ViewerLogin.Trim().TrimStart('@').ToLowerInvariant();

                if (dto.Free)
                {
                    // Regalo del streamer: gira y entrega, sin tocar la billetera ni
                    // los topes. Entrega igual que un giro pagado — un premio regalado
                    // que no llega es un premio que el espectador vio y no recibió.
                    var regalo = await _wheels.SpinFreeAsync(channelId, channelLogin, id, viewer, WheelSpinTriggers.Panel);
                    if (!regalo.Ok)
                        return BadRequest(new { success = false, message = "La rueda no tiene ningún gajo que pueda salir" });

                    return Ok(new { success = true, label = regalo.Label, coins = regalo.CoinsAwarded, pending = regalo.Pending, charged = false });
                }

                var outcome = await _wheels.SpinForViewerAsync(channelId, channelLogin, id, viewer, WheelSpinTriggers.Panel);
                if (!outcome.Ok)
                    return BadRequest(new { success = false, reason = outcome.Reason.ToString(), balance = outcome.Balance, secondsLeft = outcome.SecondsLeft });

                return Ok(new { success = true, label = outcome.Label, balance = outcome.Balance, coins = outcome.CoinsAwarded, pending = outcome.Pending, charged = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error en giro manual de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }
    }
}
