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
    /// <summary>Fuentes de créditos, simulador y billeteras de espectadores. Parte de <see cref="WheelController"/>.</summary>
    public partial class WheelController
    {
        // ====================================================================
        // FUENTES DE CRÉDITOS
        // ====================================================================

        /// <summary>
        /// Las cinco fuentes de la rueda. Devuelve siempre las cinco, existan o no en
        /// la base: el panel necesita poder encender una que nunca se configuró.
        /// </summary>
        [HttpGet("wheels/{id:int}/sources")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetSources(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var guardadas = await _db.WheelWalletSources
                    .AsNoTracking()
                    .Where(ws => ws.WheelId == id)
                    .ToListAsync();

                // Las fuentes de aporte son una fila por rueda; si nunca se
                // configuraron, se devuelven igual apagadas para que el panel pueda
                // encenderlas. Solo se listan las que tienen productor real
                // (ver WheelSourceCatalog.Wired): ofrecer una fuente que nadie
                // dispara es prometer algo que no ocurre.
                var fijas = WheelSourceCatalog.Wired
                    .Where(n => n != WheelSources.ChannelPoints)
                    .Select(name =>
                    {
                        var s = guardadas.FirstOrDefault(g => g.Source == name);
                        return new
                        {
                            id = s?.Id ?? 0,
                            source = name,
                            isEnabled = s?.IsEnabled ?? false,
                            rateNumerator = s?.RateNumerator ?? DefaultRate(name).num,
                            rateDenominator = s?.RateDenominator ?? DefaultRate(name).den,
                            capPerEvent = s?.CapPerEvent,
                            tier2Multiplier = s?.Tier2Multiplier ?? 1m,
                            tier3Multiplier = s?.Tier3Multiplier ?? 1m,
                            channelPointsRewardId = (string?)null,
                            channelPointsRewardTitle = (string?)null,
                        };
                    });

                // Los puntos de canal son una fila POR RECOMPENSA: el streamer crea
                // variantes y cada una da distinto.
                var puntos = guardadas
                    .Where(g => g.Source == WheelSources.ChannelPoints)
                    .OrderBy(g => g.Id)
                    .Select(g => new
                    {
                        id = g.Id,
                        source = g.Source,
                        isEnabled = g.IsEnabled,
                        rateNumerator = g.RateNumerator,
                        rateDenominator = g.RateDenominator,
                        capPerEvent = g.CapPerEvent,
                        tier2Multiplier = g.Tier2Multiplier,
                        tier3Multiplier = g.Tier3Multiplier,
                        channelPointsRewardId = g.ChannelPointsRewardId,
                        channelPointsRewardTitle = g.ChannelPointsRewardTitle,
                    });

                return Ok(new { success = true, sources = fijas.Concat(puntos) });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error listando fuentes de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        [HttpPut("wheels/{id:int}/sources")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SaveSources(int id, [FromBody] List<SourceDto> dtos)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var entrantes = dtos ?? new List<SourceDto>();

                if (entrantes.Any(d => d.RateNumerator <= 0 || d.RateDenominator <= 0))
                    return BadRequest(new { success = false, message = "La tasa tiene que ser mayor que cero" });

                // Una recompensa de puntos encendida sin elegir cuál acreditaría
                // cualquier canje del canal, así que se rechaza antes de llegar al CHECK.
                if (entrantes.Any(d => d.Source == WheelSources.ChannelPoints
                                    && d.IsEnabled
                                    && string.IsNullOrWhiteSpace(d.ChannelPointsRewardId)))
                    return BadRequest(new { success = false, message = "Elige la recompensa de puntos de canal antes de activarla" });

                if (entrantes.Where(d => d.Source == WheelSources.ChannelPoints)
                             .GroupBy(d => d.ChannelPointsRewardId ?? "")
                             .Any(g => g.Key != "" && g.Count() > 1))
                    return BadRequest(new { success = false, message = "Esa recompensa ya está en la lista" });

                var existentes = await _db.WheelWalletSources.Where(ws => ws.WheelId == id).ToListAsync();
                var vistas = new HashSet<int>();

                foreach (var dto in entrantes)
                {
                    if (!WheelSourceCatalog.Wired.Contains(dto.Source)) continue;

                    var esPuntos = dto.Source == WheelSources.ChannelPoints;
                    var rewardId = string.IsNullOrWhiteSpace(dto.ChannelPointsRewardId) ? null : dto.ChannelPointsRewardId.Trim();

                    var fila = dto.Id > 0
                        ? existentes.FirstOrDefault(f => f.Id == dto.Id)
                        : existentes.FirstOrDefault(f => f.Source == dto.Source
                                                      && (!esPuntos || f.ChannelPointsRewardId == rewardId));

                    if (fila == null)
                    {
                        fila = new WheelWalletSource { WheelId = id, Source = dto.Source };
                        _db.WheelWalletSources.Add(fila);
                    }
                    else
                    {
                        vistas.Add(fila.Id);
                    }

                    fila.IsEnabled = dto.IsEnabled;
                    fila.RateNumerator = dto.RateNumerator;
                    fila.RateDenominator = esPuntos ? 1 : dto.RateDenominator;   // un canje es un evento
                    fila.CapPerEvent = dto.CapPerEvent;
                    // Los multiplicadores solo se guardan en gift_sub: en el resto no
                    // hay tier que leer, y dejarlos escritos ahi seria configuracion
                    // que no hace nada esperando a confundir a alguien.
                    var esRegalo = dto.Source == WheelSources.GiftSub;
                    fila.Tier2Multiplier = esRegalo ? ClampMultiplicador(dto.Tier2Multiplier) : 1m;
                    fila.Tier3Multiplier = esRegalo ? ClampMultiplicador(dto.Tier3Multiplier) : 1m;
                    fila.ChannelPointsRewardId = esPuntos ? rewardId : null;
                    fila.ChannelPointsRewardTitle = esPuntos
                        ? (string.IsNullOrWhiteSpace(dto.ChannelPointsRewardTitle) ? null : dto.ChannelPointsRewardTitle.Trim())
                        : null;
                    fila.UpdatedAt = DateTime.UtcNow;
                }

                // Una recompensa que el streamer quitó de la lista se borra. Solo aplica
                // a puntos de canal: las otras cuatro fuentes se apagan, no se quitan.
                foreach (var sobrante in existentes.Where(f => f.Source == WheelSources.ChannelPoints && !vistas.Contains(f.Id)))
                    _db.WheelWalletSources.Remove(sobrante);

                await _db.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (DbUpdateException ex)
            {
                _logger.LogWarning(ex, "🎡 [Rueda] Valor rechazado por la base al guardar fuentes de {Id}", id);
                return BadRequest(new { success = false, message = "Alguno de los valores no es válido" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error guardando fuentes de {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>Tasas de arranque con sentido, para que el panel no abra en ceros.</summary>
        private static (int num, int den) DefaultRate(string source) => source switch
        {
            WheelSources.Bits => (1, 1),            // 1 bit  = 1 crédito
            WheelSources.GiftSub => (500, 1),          // 1 sub  = 500 créditos
            WheelSources.Donation => (1000, 1),         // 1 unidad de moneda = 1000
            WheelSources.ChannelPoints => (100, 1),          // 1 canje = 100
            _ => (1, 1),
        };

        // ====================================================================
        // SIMULADOR
        // ====================================================================

        /// <summary>
        /// Simula un aporte real: bits, subs de regalo, donación o canje de puntos.
        ///
        /// <para>Llama exactamente a la misma función que usa el handler de EventSub,
        /// así que lo que se ve acá es lo que va a pasar en vivo. Acredita de verdad,
        /// gasta de verdad y gira de verdad: no es un ensayo, es el evento.</para>
        /// </summary>
        [HttpPost("wheels/{id:int}/simulate")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> Simulate(int id, [FromBody] SimulateDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (dto == null || string.IsNullOrWhiteSpace(dto.Source))
                    return BadRequest(new { success = false, message = "Falta la fuente" });

                if (!WheelSourceCatalog.Wired.Contains(dto.Source))
                    return BadRequest(new { success = false, message = "Fuente desconocida" });

                if (dto.Amount <= 0)
                    return BadRequest(new { success = false, message = "La cantidad tiene que ser mayor que cero" });

                var channelId = GetChannelOwnerId();
                var channelLogin = await _db.Users.Where(u => u.Id == channelId).Select(u => u.Login).FirstOrDefaultAsync();
                if (channelLogin == null) return NotFound(new { success = false, message = "Canal no encontrado" });

                var wheel = await _wheels.GetWheelAsync(channelId, id);
                if (wheel == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var viewer = string.IsNullOrWhiteSpace(dto.ViewerLogin)
                    ? channelLogin
                    : dto.ViewerLogin.Trim().TrimStart('@').ToLowerInvariant();

                var saldoAntes = await _walletService.GetBalanceAsync(channelId, viewer);

                var resultados = await _wheels.CreditAndMaybeSpinAsync(
                    channelLogin, viewer, dto.Source, dto.Amount, dto.RewardId);

                var saldoDespues = await _walletService.GetBalanceAsync(channelId, viewer);
                var deEstaRueda = resultados.FirstOrDefault(r => r.WheelId == id);

                return Ok(new
                {
                    success = true,
                    viewer,
                    balanceBefore = saldoAntes,
                    balanceAfter = saldoDespues,
                    // Vacío no es un error: casi siempre significa que esa fuente está
                    // apagada, o que el aporte no llegó al precio y la rueda no acumula.
                    // El panel lo explica en vez de decir que algo falló.
                    credited = deEstaRueda != null,
                    creditsAdded = deEstaRueda?.CreditsAdded ?? 0,
                    spinsOwed = deEstaRueda?.SpinsOwed ?? 0,
                    spun = deEstaRueda?.Spun ?? false,
                    spinLabel = deEstaRueda?.SpinLabel,
                    otherWheels = resultados.Where(r => r.WheelId != id).Select(r => new { r.WheelName, r.CreditsAdded }),
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error simulando aporte en {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Las billeteras del canal. Son del <b>canal</b> y no de la rueda: el
        /// espectador aporta una vez y puede gastar en cualquier rueda del streamer,
        /// así que este listado no cuelga de ninguna rueda en particular.
        /// </summary>
        [HttpGet("wallets")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetWallets(
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();

                var query = _db.WheelWallets.AsNoTracking().Where(w => w.ChannelId == channelId);

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var buscar = search.Trim().ToLowerInvariant();
                    query = query.Where(w => w.ViewerLogin.Contains(buscar));
                }

                var total = await query.CountAsync();
                var pagina = Math.Max(1, page);
                var tam = Math.Clamp(pageSize, 1, 200);

                var items = await query
                    .OrderByDescending(w => w.Credits).ThenByDescending(w => w.LastActivityAt)
                    .Skip((pagina - 1) * tam)
                    .Take(tam)
                    .Select(w => new
                    {
                        viewer = w.ViewerLogin,
                        credits = w.Credits,
                        lifetimeCredits = w.LifetimeCredits,
                        spinsThisStream = w.SpinsThisStream,
                        lastActivityAt = w.LastActivityAt,
                        lastSpinAt = w.LastSpinAt,
                    })
                    .ToListAsync();

                return Ok(new { success = true, items, total, page = pagina, pageSize = tam });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error listando billeteras");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Fija a mano el saldo de un espectador.
        ///
        /// <para>Se fija, no se suma: el streamer está corrigiendo un número que ve en
        /// pantalla, y un endpoint que sumara le obligaría a calcular la diferencia.
        /// <c>lifetime_credits</c> NO se toca — es histórico y no baja nunca, ni
        /// siquiera cuando alguien corrige un saldo a mano.</para>
        /// </summary>
        [HttpPut("wallets/{viewer}")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> SetWalletCredits(string viewer, [FromBody] SetWalletDto dto)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                if (dto.Credits < 0)
                    return BadRequest(new { success = false, message = "El saldo no puede ser negativo" });

                var channelId = GetChannelOwnerId();
                var login = (viewer ?? string.Empty).Trim().ToLowerInvariant();
                if (login.Length == 0)
                    return BadRequest(new { success = false, message = "Falta el espectador" });

                var wallet = await _db.WheelWallets
                    .FirstOrDefaultAsync(w => w.ChannelId == channelId && w.ViewerLogin == login);

                if (wallet == null)
                    return NotFound(new { success = false, message = "Ese espectador no tiene billetera" });

                wallet.Credits = dto.Credits;
                wallet.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                _logger.LogInformation(
                    "🎡 [Rueda] Saldo de {Viewer} en el canal {Channel} fijado a mano en {Credits}",
                    login, channelId, dto.Credits);

                return Ok(new { success = true, viewer = login, credits = wallet.Credits });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error fijando el saldo de {Viewer}", viewer);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }
    }
}
