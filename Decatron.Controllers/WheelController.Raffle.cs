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
    /// <summary>Modo Sorteo: reglas, ventana de inscripción, pool y sorteo. Parte de <see cref="WheelController"/>.</summary>
    public partial class WheelController
    {
        // ====================================================================
        // MODO SORTEO
        // ====================================================================

        /// <summary>Config del sorteo + estado de la ventana + el pool.</summary>
        [HttpGet("wheels/{id:int}/raffle")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetRaffle(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });
                if (wheel.Mode != WheelModes.Raffle)
                    return BadRequest(new { success = false, message = "Esta rueda no es de modo Sorteo" });

                var cfg = await _raffle.GetOrCreateConfigAsync(id);
                var entradas = await _raffle.GetEntriesAsync(id);

                return Ok(new
                {
                    success = true,
                    config = new
                    {
                        entryCommand = cfg.EntryCommand,
                        entryMethods = Parse(cfg.EntryMethods),
                        windowMode = cfg.WindowMode,
                        windowSeconds = cfg.WindowSeconds,
                        entryCostCredits = cfg.EntryCostCredits,
                        maxEntriesPerViewer = cfg.MaxEntriesPerViewer,
                        weightSources = Parse(cfg.WeightSources),
                        requirements = Parse(cfg.Requirements),
                        winnersCount = cfg.WinnersCount,
                        drawMode = cfg.DrawMode,
                        removeWinnerFromPool = cfg.RemoveWinnerFromPool,
                        clearOnStreamEnd = cfg.ClearOnStreamEnd,
                        isOpen = cfg.IsOpen,
                        windowClosesAt = cfg.WindowClosesAt,
                        acceptingEntries = cfg.AceptaInscripciones,
                    },
                    entries = entradas.Select(e => new
                    {
                        id = e.Id,
                        viewer = e.ViewerLogin,
                        entries = e.Entries,
                        weight = e.Weight,
                        breakdown = Parse(e.WeightBreakdown),
                        hasWon = e.HasWon,
                        wonAt = e.WonAt,
                        joinedAt = e.JoinedAt,
                    }),
                    poolSize = await _raffle.TamanoDelPoolAsync(id),
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error leyendo el sorteo de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPut("wheels/{id:int}/raffle")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveRaffle(int id, [FromBody] RaffleConfigDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var cfg = await _raffle.GetOrCreateConfigAsync(id);

                if (dto.EntryCommand != null)
                {
                    var comando = dto.EntryCommand.Trim().ToLowerInvariant();
                    if (!comando.StartsWith("!")) comando = "!" + comando;

                    // El CHECK de la tabla solo acepta esta forma; validarlo acá deja
                    // un mensaje entendible en vez de un 500 de Postgres.
                    if (!System.Text.RegularExpressions.Regex.IsMatch(comando, "^![a-zA-Z0-9_-]+$"))
                        return BadRequest(new { success = false, message = "El comando solo admite letras, números, guión y guión bajo" });

                    cfg.EntryCommand = comando;
                }

                if (dto.WindowMode != null)
                {
                    if (dto.WindowMode is not ("manual" or "timed" or "always_open"))
                        return BadRequest(new { success = false, message = "Modo de ventana no válido" });
                    cfg.WindowMode = dto.WindowMode;
                }

                if (dto.WindowSeconds.HasValue) cfg.WindowSeconds = dto.WindowSeconds;

                // El CHECK exige segundos cuando la ventana es temporizada; sin esto
                // el guardado explota al cambiar el modo antes de poner la duración.
                if (cfg.WindowMode == "timed" && (cfg.WindowSeconds == null || cfg.WindowSeconds <= 0))
                    return BadRequest(new { success = false, message = "Una ventana temporizada necesita una duración" });

                if (dto.EntryCostCredits.HasValue) cfg.EntryCostCredits = Math.Max(0, dto.EntryCostCredits.Value);
                if (dto.MaxEntriesPerViewer.HasValue) cfg.MaxEntriesPerViewer = Math.Max(1, dto.MaxEntriesPerViewer.Value);
                if (dto.WinnersCount.HasValue) cfg.WinnersCount = Math.Max(1, dto.WinnersCount.Value);

                if (dto.DrawMode != null)
                {
                    if (dto.DrawMode is not ("single" or "multi" or "remove_and_continue"))
                        return BadRequest(new { success = false, message = "Modo de sorteo no válido" });
                    cfg.DrawMode = dto.DrawMode;
                }

                if (dto.RemoveWinnerFromPool.HasValue) cfg.RemoveWinnerFromPool = dto.RemoveWinnerFromPool.Value;
                if (dto.ClearOnStreamEnd.HasValue) cfg.ClearOnStreamEnd = dto.ClearOnStreamEnd.Value;
                if (dto.EntryMethods != null) cfg.EntryMethods = dto.EntryMethods.Value.GetRawText();
                if (dto.WeightSources != null) cfg.WeightSources = dto.WeightSources.Value.GetRawText();
                if (dto.Requirements != null) cfg.Requirements = dto.Requirements.Value.GetRawText();

                cfg.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                // Los pesos se configuran DESPUÉS de que la gente ya se inscribió; sin
                // recalcular, cambiar un multiplicador no afectaría a nadie que ya esté.
                var recalculadas = dto.WeightSources != null
                    ? await _raffle.RecalcularPesosAsync(channelId, id)
                    : 0;

                return Ok(new { success = true, recalculated = recalculadas });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error guardando el sorteo de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPost("wheels/{id:int}/raffle/window")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> RaffleWindow(int id, [FromBody] RaffleWindowDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var cfg = dto?.Open == true
                    ? await _raffle.AbrirAsync(id)
                    : await _raffle.CerrarAsync(id);

                return Ok(new
                {
                    success = true,
                    isOpen = cfg.IsOpen,
                    windowClosesAt = cfg.WindowClosesAt,
                    acceptingEntries = cfg.AceptaInscripciones,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error abriendo/cerrando la ventana de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Alta manual de un participante por el streamer o un mod.</summary>
        [HttpPost("wheels/{id:int}/raffle/entries")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> AddRaffleEntry(int id, [FromBody] RaffleEntryDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (string.IsNullOrWhiteSpace(dto?.Viewer))
                    return BadRequest(new { success = false, message = "Falta el nombre del espectador" });

                var channelId = GetChannelOwnerId();

                // El alta manual del mod se salta requisitos y costo a propósito: es la
                // vía de escape para meter a alguien que el bot no pudo verificar.
                var outcome = await _raffle.JoinAsync(channelId, id, dto.Viewer, esSub: true, esFollower: true);

                if (outcome.Result == WheelRaffleService.JoinResult.NoEsSorteo)
                    return BadRequest(new { success = false, message = "Esta rueda no es de modo Sorteo" });

                return Ok(new { success = true, result = outcome.Result.ToString(), entries = outcome.Entries, poolSize = outcome.PoolSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error agregando participante a {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpDelete("wheels/{id:int}/raffle/entries/{viewer}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> RemoveRaffleEntry(int id, string viewer)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var quitado = await _raffle.QuitarAsync(id, viewer);
                return Ok(new { success = quitado });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error quitando participante de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Multiplicador manual de un mod sobre un participante.</summary>
        [HttpPut("wheels/{id:int}/raffle/entries/{viewer}/multiplier")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SetRaffleMultiplier(int id, string viewer, [FromBody] RaffleMultiplierDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var mult = dto?.Multiplier ?? 1m;
                if (mult <= 0) return BadRequest(new { success = false, message = "El multiplicador tiene que ser mayor que cero" });

                var ok = await _raffle.SetMultiplicadorManualAsync(id, viewer, mult);
                return Ok(new { success = ok });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error poniendo multiplicador en {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPost("wheels/{id:int}/raffle/draw")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> DrawRaffle(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var channelLogin = await _db.Users.Where(u => u.Id == channelId).Select(u => u.Login).FirstOrDefaultAsync();
                if (channelLogin == null) return NotFound(new { success = false, message = "Canal no encontrado" });

                var outcome = await _raffle.SortearAsync(channelId, channelLogin, id, WheelSpinTriggers.RaffleDraw);

                if (outcome.Result != WheelRaffleService.DrawResult.Ok)
                    return BadRequest(new { success = false, reason = outcome.Result.ToString(), poolSize = outcome.PoolSize });

                return Ok(new { success = true, winners = outcome.Ganadores, poolSize = outcome.PoolSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error sorteando en {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPost("wheels/{id:int}/raffle/reset")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ResetRaffle(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var borradas = await _raffle.LimpiarPoolAsync(id);
                return Ok(new { success = true, removed = borradas });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Sorteo] Error reseteando el pool de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }
    }
}
