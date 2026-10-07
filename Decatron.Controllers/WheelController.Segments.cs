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
    /// <summary>Gajos de la rueda. Parte de <see cref="WheelController"/>.</summary>
    public partial class WheelController
    {
        // ====================================================================
        // GAJOS
        // ====================================================================

        [HttpPut("wheels/{id:int}/segments")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveSegments(int id, [FromBody] List<SegmentDto> dtos)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (dtos == null || dtos.Count < 2)
                    return BadRequest(new { success = false, message = "La rueda necesita al menos 2 gajos" });

                if (dtos.Any(d => string.IsNullOrWhiteSpace(d.Label)))
                    return BadRequest(new { success = false, message = "Todos los gajos necesitan un texto" });

                // Los deca coins los vende la plataforma: la Rueda no puede regalarlos (premio retirado).
                if (dtos.Any(d => d.Prize is { ValueKind: JsonValueKind.Object } pz
                                  && pz.TryGetProperty("type", out var tp)
                                  && tp.ValueKind == JsonValueKind.String
                                  && tp.GetString() == WheelPrizeTypes.Coins))
                    return BadRequest(new { success = false, message = "El premio «Coins» ya no existe: los deca coins no se pueden regalar desde la Rueda. Elige otro premio." });

                if (dtos.All(d => !d.IsEnabled || d.Weight <= 0))
                    return BadRequest(new { success = false, message = "Al menos un gajo tiene que estar activo y con peso" });

                var channelId = GetChannelOwnerId();

                var tierGajos = await TierResolver.GetEffectiveTierAsync(_db, channelId);
                var topeGajos = await TierResolver.GetWheelSegmentLimitAsync(_db, tierGajos);

                if (topeGajos != TierResolver.Unlimited && dtos.Count > topeGajos)
                    return BadRequest(new
                    {
                        success = false,
                        message = $"Tu plan permite {topeGajos} gajos por rueda.",
                        limit = topeGajos,
                        current = dtos.Count,
                        tier = tierGajos,
                    });

                var entities = dtos.Select(d => new WheelSegment
                {
                    Id = d.Id,
                    Label = d.Label.Trim(),
                    Weight = d.Weight,
                    Color = string.IsNullOrWhiteSpace(d.Color) ? null : d.Color,
                    Icon = string.IsNullOrWhiteSpace(d.Icon) ? null : d.Icon,
                    Prize = d.Prize?.GetRawText() ?? "{\"type\":\"nothing\",\"params\":{}}",
                    IsEnabled = d.IsEnabled,
                    // 0 y negativos se tratan como "sin tope": un campo vacío en el panel
                    // llega como 0, y un stock de cero seria un gajo que no puede salir
                    // nunca, que es lo que el interruptor de activo ya hace mejor.
                    StockTotal = d.StockTotal is > 0 ? d.StockTotal : null,
                    StockPerViewer = d.StockPerViewer is > 0 ? d.StockPerViewer : null,
                    StockWindow = d.StockWindow,
                }).ToList();

                var ok = await _wheels.ReplaceSegmentsAsync(channelId, id, entities);
                if (!ok) return NotFound(new { success = false, message = "Rueda no encontrada" });

                await _wheels.NotifyOverlayAsync(channelId, id);

                var segments = await _wheels.GetSegmentsAsync(id);
                var pct = WheelService.EffectivePercentages(segments);
                return Ok(new { success = true, segments = segments.Select(s => ToSegmentDto(s, pct.GetValueOrDefault(s.Id))) });
            }
            catch (DbUpdateException ex)
            {
                _logger.LogWarning(ex, "🎡 [Rueda] Valor rechazado por la base al guardar gajos de {Id}", id);
                return BadRequest(new { success = false, message = "Alguno de los valores no es válido" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error guardando gajos de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }
    }
}
