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
    /// <summary>Historial de giros, exportación a CSV y métricas. Parte de <see cref="WheelController"/>.</summary>
    public partial class WheelController
    {
        // ====================================================================
        // FASE 6 — HISTORIAL, MÉTRICAS Y BILLETERAS
        // ====================================================================

        /// <summary>
        /// El historial de giros de una rueda, filtrado y paginado.
        ///
        /// <para>La ventana la pone el tier (sección 11). El recorte se aplica acá y
        /// no al guardar: las filas siguen en la base, así que subir de tier hace
        /// reaparecer el historial entero sin migrar nada.</para>
        /// </summary>
        [HttpGet("wheels/{id:int}/spins")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetSpins(
            int id,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string? viewer = null,
            [FromQuery] string? trigger = null,
            [FromQuery] string? status = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                if (!await EsDelCanalAsync(id, channelId))
                    return NotFound(new { success = false, message = "Rueda no encontrada" });

                var (desdeTier, dias) = await VentanaDeHistorialAsync(channelId);

                var query = FiltrarGiros(id, desdeTier, from, to, viewer, trigger, status);

                var total = await query.CountAsync();
                var pagina = Math.Max(1, page);
                var tam = Math.Clamp(pageSize, 1, 200);

                var filas = await query
                    .OrderByDescending(s => s.Id)
                    .Skip((pagina - 1) * tam)
                    .Take(tam)
                    .Select(s => new
                    {
                        id = s.Id,
                        createdAt = s.CreatedAt,
                        mode = s.Mode,
                        viewer = s.SpinnerLogin,
                        trigger = s.TriggerSource,
                        creditsSpent = s.CreditsSpent,
                        segmentId = s.ResultSegmentId,
                        // El gajo puede haberse borrado después del giro: el snapshot del
                        // premio es lo único que siempre sobrevive, por eso la etiqueta
                        // se resuelve con lo que haya y no se asume que el gajo exista.
                        label = s.ResultSegment != null ? s.ResultSegment.Label : null,
                        prize = s.ResultPrize,
                        deliveryStatus = s.DeliveryStatus,
                        raffleWinner = s.RaffleWinner,
                    })
                    .ToListAsync();

                var items = filas.Select(f => new
                {
                    f.id, f.createdAt, f.mode, f.viewer, f.trigger, f.creditsSpent,
                    f.segmentId, f.label,
                    prize = Parse(f.prize),
                    f.deliveryStatus,
                    raffleWinner = Parse(f.raffleWinner),
                }).ToList();

                return Ok(new
                {
                    success = true,
                    items,
                    total,
                    page = pagina,
                    pageSize = tam,
                    historyDays = dias,
                    windowFrom = desdeTier,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error leyendo el historial de la rueda {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// El mismo historial, en CSV. Respeta los filtros y la ventana del tier: lo
        /// que el streamer no puede ver en el panel tampoco se lo puede descargar.
        /// </summary>
        [HttpGet("wheels/{id:int}/spins/export")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> ExportSpins(
            int id,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string? viewer = null,
            [FromQuery] string? trigger = null,
            [FromQuery] string? status = null)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                var rueda = await _db.Wheels.AsNoTracking()
                    .FirstOrDefaultAsync(w => w.Id == id && w.ChannelId == channelId);
                if (rueda == null) return NotFound(new { success = false, message = "Rueda no encontrada" });

                var (desdeTier, _) = await VentanaDeHistorialAsync(channelId);

                var filas = await FiltrarGiros(id, desdeTier, from, to, viewer, trigger, status)
                    .OrderByDescending(s => s.Id)
                    .Take(MaxFilasCsv)
                    .Select(s => new
                    {
                        s.Id, s.CreatedAt, s.Mode, s.SpinnerLogin, s.TriggerSource,
                        s.CreditsSpent, s.DeliveryStatus, s.ResultPrize, s.RaffleWinner,
                        Label = s.ResultSegment != null ? s.ResultSegment.Label : null,
                    })
                    .ToListAsync();

                var sb = new System.Text.StringBuilder();
                sb.Append("id,fecha_utc,modo,espectador,disparador,creditos,gajo,premio,entrega,ganador_sorteo\r\n");
                foreach (var f in filas)
                {
                    sb.Append(f.Id).Append(',')
                      .Append(f.CreatedAt.ToString("o")).Append(',')
                      .Append(Csv(f.Mode)).Append(',')
                      .Append(Csv(f.SpinnerLogin)).Append(',')
                      .Append(Csv(f.TriggerSource)).Append(',')
                      .Append(f.CreditsSpent).Append(',')
                      .Append(Csv(f.Label)).Append(',')
                      .Append(Csv(TipoDePremio(f.ResultPrize))).Append(',')
                      .Append(Csv(f.DeliveryStatus)).Append(',')
                      .Append(Csv(f.RaffleWinner))
                      .Append("\r\n");
                }

                // Con BOM: sin él Excel abre el CSV en la codificación del sistema y
                // cualquier tilde o emoji del nombre de un gajo sale roto.
                var bytes = new byte[] { 0xEF, 0xBB, 0xBF }
                    .Concat(System.Text.Encoding.UTF8.GetBytes(sb.ToString()))
                    .ToArray();

                var nombre = $"rueda-{rueda.Slug}-giros-{DateTime.UtcNow:yyyyMMdd}.csv";
                return File(bytes, "text/csv", nombre);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error exportando el historial de la rueda {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Métricas de una rueda. A diferencia del historial, usan <b>todo</b> el
        /// historial y no la ventana del tier: una distribución calculada sobre los
        /// últimos treinta días le mentiría al streamer sobre su propia rueda.
        /// </summary>
        [HttpGet("wheels/{id:int}/metrics")]
        [RequirePermission("overlays")]
        public async Task<IActionResult> GetMetrics(int id)
        {
            if (!_settings.Enabled) return NotFound();

            try
            {
                var channelId = GetChannelOwnerId();
                if (!await EsDelCanalAsync(id, channelId))
                    return NotFound(new { success = false, message = "Rueda no encontrada" });

                var giros = _db.WheelSpins.AsNoTracking().Where(s => s.WheelId == id);
                var ahora = DateTime.UtcNow;

                var total = await giros.CountAsync();
                var ultimos7 = await giros.CountAsync(s => s.CreatedAt >= ahora.AddDays(-7));
                var ultimos30 = await giros.CountAsync(s => s.CreatedAt >= ahora.AddDays(-30));
                var pendientes = await giros.CountAsync(s => s.DeliveryStatus == "pending");
                var creditosGastados = await giros.SumAsync(s => (int?)s.CreditsSpent) ?? 0;

                var porDisparador = await giros
                    .GroupBy(s => s.TriggerSource)
                    .Select(g => new { trigger = g.Key, spins = g.Count() })
                    .ToListAsync();

                // Distribución real: cuántas veces salió cada gajo. Se agrupa por id y
                // no por etiqueta porque dos gajos pueden llamarse igual.
                var reales = await giros
                    .Where(s => s.ResultSegmentId != null)
                    .GroupBy(s => s.ResultSegmentId!.Value)
                    .Select(g => new { segmentId = g.Key, spins = g.Count() })
                    .ToListAsync();

                var gajos = await _db.WheelSegments.AsNoTracking()
                    .Where(sg => sg.WheelId == id && sg.IsEnabled)
                    .OrderBy(sg => sg.DisplayOrder).ThenBy(sg => sg.Id)
                    .Select(sg => new { sg.Id, sg.Label, sg.Weight, sg.Color })
                    .ToListAsync();

                var pesoTotal = gajos.Sum(g => g.Weight);
                var conResultado = reales.Sum(r => r.spins);

                var distribucion = gajos.Select(g =>
                {
                    var salio = reales.FirstOrDefault(r => r.segmentId == g.Id)?.spins ?? 0;
                    return new
                    {
                        segmentId = g.Id,
                        label = g.Label,
                        color = g.Color,
                        spins = salio,
                        // La configurada es el peso relativo; la real, la frecuencia
                        // observada. Con pocos giros van a diferir mucho y eso es
                        // esperable: el panel lo dice al lado de la tabla.
                        configuredPct = pesoTotal > 0 ? (double)(g.Weight / pesoTotal) * 100 : 0,
                        realPct = conResultado > 0 ? (double)salio / conResultado * 100 : 0,
                    };
                }).ToList();

                // Los coins pagados salen del snapshot del premio, que es jsonb. Se
                // suma en Postgres y no en memoria: traer cien mil filas de historial
                // para sumar un número sería el camino corto a un timeout.
                var coinsPagados = await SumarCoinsPagadosAsync(id);

                var suertudos = await giros
                    .Where(s => s.SpinnerLogin != null && s.CreditsSpent > 0)
                    .GroupBy(s => s.SpinnerLogin!)
                    .Select(g => new { viewer = g.Key, spins = g.Count(), credits = g.Sum(x => x.CreditsSpent) })
                    .OrderByDescending(x => x.spins)
                    .Take(10)
                    .ToListAsync();

                var creditosPorFuente = await _db.WheelWalletSources.AsNoTracking()
                    .Where(f => f.WheelId == id)
                    .Select(f => new
                    {
                        source = f.Source,
                        isEnabled = f.IsEnabled,
                        rateNumerator = f.RateNumerator,
                        rateDenominator = f.RateDenominator,
                    })
                    .ToListAsync();

                return Ok(new
                {
                    success = true,
                    totals = new
                    {
                        spins = total,
                        spinsLast7 = ultimos7,
                        spinsLast30 = ultimos30,
                        pendingDeliveries = pendientes,
                        creditsSpent = creditosGastados,
                        coinsPaid = coinsPagados,
                    },
                    byTrigger = porDisparador,
                    distribution = distribucion,
                    luckiest = suertudos,
                    sources = creditosPorFuente,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎡 [Rueda] Error calculando métricas de la rueda {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        // --- ayudantes de la Fase 6 ---

        /// <summary>Tope de filas de una exportación. Un CSV no es un volcado de la base.</summary>
        private const int MaxFilasCsv = 5000;

        /// <summary>Un multiplicador razonable. 0 o negativo no significa nada: vale 1.</summary>
        private static decimal ClampMultiplicador(decimal v) =>
            v <= 0 ? 1m : Math.Round(Math.Min(v, 10m), 2);

        private Task<bool> EsDelCanalAsync(int wheelId, long channelId) =>
            _db.Wheels.AsNoTracking().AnyAsync(w => w.Id == wheelId && w.ChannelId == channelId);

        /// <summary>Desde cuándo puede ver el historial este canal, y cuántos días son.</summary>
        private async Task<(DateTime? desde, long dias)> VentanaDeHistorialAsync(long channelId)
        {
            var tier = await TierResolver.GetEffectiveTierAsync(_db, channelId);
            var dias = await TierResolver.GetWheelHistoryDaysAsync(_db, tier);
            return (dias == TierResolver.Unlimited ? null : DateTime.UtcNow.AddDays(-dias), dias);
        }

        /// <summary>
        /// El filtro del historial, compartido por el listado y la exportación: si
        /// fueran dos, el CSV podría terminar entregando filas que el panel esconde.
        /// </summary>
        private IQueryable<WheelSpin> FiltrarGiros(
            int wheelId, DateTime? desdeTier,
            DateTime? from, DateTime? to, string? viewer, string? trigger, string? status)
        {
            var q = _db.WheelSpins.AsNoTracking().Where(s => s.WheelId == wheelId);

            if (desdeTier != null) q = q.Where(s => s.CreatedAt >= desdeTier);
            if (from != null) q = q.Where(s => s.CreatedAt >= from.Value.ToUniversalTime());
            // El "hasta" que escribe el streamer es un día, no un instante: sin el
            // día completo, filtrar "hasta hoy" no devolvería nada de hoy.
            if (to != null) q = q.Where(s => s.CreatedAt < to.Value.ToUniversalTime().Date.AddDays(1));

            if (!string.IsNullOrWhiteSpace(viewer))
            {
                var v = viewer.Trim().ToLowerInvariant();
                q = q.Where(s => s.SpinnerLogin != null && s.SpinnerLogin.Contains(v));
            }

            if (!string.IsNullOrWhiteSpace(trigger) && trigger != "all")
                q = q.Where(s => s.TriggerSource == trigger);

            if (!string.IsNullOrWhiteSpace(status) && status != "all")
                q = q.Where(s => s.DeliveryStatus == status);

            return q;
        }

        /// <summary>
        /// Suma los coins pagados leyendo el snapshot jsonb del premio, en Postgres.
        ///
        /// <para>El <c>~ '^[0-9]+$'</c> no sobra: <c>amount</c> lo escribe el editor de
        /// premios del panel y un valor que no sea un entero haría fallar el cast de
        /// toda la consulta. Con la comprobación, una fila rota se ignora en vez de
        /// tumbar la pantalla de métricas entera.</para>
        /// </summary>
        private async Task<long> SumarCoinsPagadosAsync(int wheelId)
        {
            try
            {
                var filas = await _db.Database
                    .SqlQueryRaw<long>(
                        @"SELECT COALESCE(SUM((result_prize->'params'->>'amount')::bigint), 0) AS ""Value""
                          FROM wheel_spins
                          WHERE wheel_id = {0}
                            AND delivery_status = 'delivered'
                            AND result_prize->>'type' = 'coins'
                            AND result_prize->'params'->>'amount' ~ '^[0-9]+$'",
                        wheelId)
                    .ToListAsync();

                return filas.FirstOrDefault();
            }
            catch (Exception ex)
            {
                // Un número que no se puede calcular no puede dejar sin métricas al resto.
                _logger.LogWarning(ex, "🎡 [Rueda] No se pudieron sumar los coins pagados de la rueda {Id}", wheelId);
                return 0;
            }
        }

        /// <summary>El tipo del premio del snapshot, para la columna del CSV.</summary>
        private static string TipoDePremio(string? prizeJson)
        {
            if (string.IsNullOrWhiteSpace(prizeJson)) return string.Empty;
            try
            {
                using var doc = JsonDocument.Parse(prizeJson);
                return doc.RootElement.TryGetProperty("type", out var t) ? t.GetString() ?? string.Empty : string.Empty;
            }
            catch { return string.Empty; }
        }

        /// <summary>
        /// Una celda de CSV. Se entrecomilla siempre: las etiquetas de los gajos las
        /// escribe el streamer y cualquiera puede traer una coma, un salto de línea o
        /// una comilla sin que eso sea un error suyo.
        /// </summary>
        private static string Csv(string? valor)
        {
            var v = valor ?? string.Empty;
            return $"\"{v.Replace("\"", "\"\"")}\"";
        }
    }
}
