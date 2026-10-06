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
    /// <summary>Bandeja de entregas pendientes y alertas de sonido para premios. Parte de <see cref="WheelController"/>.</summary>
    public partial class WheelController
    {
        // ====================================================================
        // BANDEJA DE ENTREGAS PENDIENTES
        // ====================================================================

        /// <summary>
        /// Los premios que el bot no pudo entregar solo. La bandeja es del canal, no
        /// de una rueda: al streamer le importa qué le debe a su gente, no en cuál de
        /// sus ruedas salió.
        /// </summary>
        [HttpGet("deliveries")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetDeliveries([FromQuery] string status = "pending", [FromQuery] int limit = 100)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var tope = Math.Clamp(limit, 1, 500);

                var query = _db.WheelPendingDeliveries
                    .AsNoTracking()
                    .Where(d => d.Wheel != null && d.Wheel.ChannelId == channelId);

                // "all" existe para que el streamer pueda revisar lo que ya resolvió;
                // el default es 'pending' porque es lo único sobre lo que hay que actuar.
                if (status != "all")
                    query = query.Where(d => d.Status == status);

                var filas = await query
                    .OrderByDescending(d => d.Id)
                    .Take(tope)
                    .Select(d => new
                    {
                        id = d.Id,
                        wheelId = d.WheelId,
                        wheelName = d.Wheel!.Name,
                        spinId = d.SpinId,
                        viewer = d.ViewerLogin,
                        prize = d.Prize,
                        status = d.Status,
                        reason = d.Reason,
                        notes = d.Notes,
                        resolvedAt = d.ResolvedAt,
                        createdAt = d.CreatedAt,
                    })
                    .ToListAsync();

                // El premio se devuelve ya parseado: el panel dibuja un widget por tipo
                // y no debería estar parseando JSON a mano.
                var salida = filas.Select(f => new
                {
                    f.id, f.wheelId, f.wheelName, f.spinId, f.viewer,
                    prize = Parse(f.prize),
                    f.status, f.reason, f.notes, f.resolvedAt, f.createdAt,
                });

                var pendientes = await _db.WheelPendingDeliveries
                    .CountAsync(d => d.Wheel != null && d.Wheel.ChannelId == channelId && d.Status == "pending");

                return Ok(new { success = true, data = salida, pendingCount = pendientes });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error listando entregas pendientes");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Marca una entrega como resuelta o cancelada.</summary>
        [HttpPut("deliveries/{deliveryId:int}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ResolveDelivery(int deliveryId, [FromBody] DeliveryDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var estado = dto?.Status;
                if (estado != "done" && estado != "cancelled" && estado != "pending")
                    return BadRequest(new { success = false, message = "Estado no válido" });

                var channelId = GetChannelOwnerId();

                var entrega = await _db.WheelPendingDeliveries
                    .Include(d => d.Wheel)
                    .FirstOrDefaultAsync(d => d.Id == deliveryId && d.Wheel != null && d.Wheel.ChannelId == channelId);

                if (entrega == null) return NotFound(new { success = false, message = "Entrega no encontrada" });

                entrega.Status = estado;

                // El CHECK de la tabla exige que una entrega resuelta diga cuándo se
                // resolvió, y que una reabierta no lo diga.
                if (estado == "pending")
                {
                    entrega.ResolvedAt = null;
                    entrega.ResolvedBy = null;
                }
                else
                {
                    entrega.ResolvedAt = DateTime.UtcNow;
                    entrega.ResolvedBy = GetUserId();
                }

                if (dto?.Notes != null)
                    entrega.Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();

                // El giro guarda su propio estado de entrega: si se quedan desalineados,
                // el historial diría "pendiente" para algo que el streamer ya entregó.
                var spin = await _db.WheelSpins.FirstOrDefaultAsync(s2 => s2.Id == entrega.SpinId);
                if (spin != null)
                    spin.DeliveryStatus = estado == "done" ? "delivered" : estado == "cancelled" ? "failed" : "pending";

                await _db.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error resolviendo la entrega {Id}", deliveryId);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Las Sound Alerts del canal, para elegirlas como premio.</summary>
        [HttpGet("sound-alerts")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetSoundAlerts()
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();

                var alertas = await _db.SoundAlertRewardFiles
                    .AsNoTracking()
                    .Where(m => m.UserId == channelId)
                    .OrderBy(m => m.RewardTitle)
                    .Select(m => new { id = m.Id, title = m.RewardTitle, enabled = m.Enabled })
                    .ToListAsync();

                return Ok(new { success = true, data = alertas });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error listando las alertas de sonido");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }
    }
}
