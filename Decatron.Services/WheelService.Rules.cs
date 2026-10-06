using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Decatron.Core.Helpers;
using Decatron.Core.Models.WheelOfLuck;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Services
{
    /// <summary>Reglas del giro: ventanas de stock, no-repetir y piedad. Parte de <see cref="WheelService"/>.</summary>
    public partial class WheelService
    {
        // ================================================================
        // FASE 7 — VENTANAS DE STOCK, STOCK POR ESPECTADOR, NO-REPETIR Y PIEDAD
        // ================================================================
        //
        // Las cuatro reglas comparten una forma: reciben la lista de elegibles y
        // devuelven una MÁS CHICA, nunca una distinta. Y si una regla dejaría la
        // lista vacía, se descarta esa regla en vez de no girar: el espectador ya
        // pagó, y un giro que no ocurre es peor que un premio repetido.

        /// <summary>
        /// Reinicia el stock de los gajos cuya ventana ya venció. Devuelve si tocó algo.
        ///
        /// <para>Solo se ocupa de <c>day</c>: <c>ever</c> no vence nunca y <c>stream</c>
        /// lo reinicia el handler de <c>stream.online</c>, que es el único momento en
        /// que "por stream" significa algo verificable.</para>
        /// </summary>
        private static bool ReiniciarVentanasDeStock(List<WheelSegment> segmentos, bool dryRun)
        {
            var hoy = DateTime.UtcNow.Date;
            var toco = false;

            foreach (var s in segmentos)
            {
                if (s.StockTotal == null || s.StockWindow != WheelStockWindows.Day) continue;
                if (s.StockResetAt != null && s.StockResetAt.Value.Date >= hoy) continue;

                s.StockRemaining = s.StockTotal;
                s.StockResetAt = DateTime.UtcNow;
                toco = true;
            }

            // En un giro de prueba igual se reinicia en memoria, para que el panel no
            // muestre agotado un gajo que en el próximo giro real va a estar disponible.
            return toco && !dryRun ? true : toco;
        }

        /// <summary>Desde cuándo cuenta la ventana de este gajo. <c>null</c> = desde siempre.</summary>
        private static DateTime? InicioDeVentana(WheelSegment s) => s.StockWindow switch
        {
            WheelStockWindows.Day => DateTime.UtcNow.Date,
            WheelStockWindows.Stream => s.StockResetAt,
            _ => null,
        };

        /// <summary>
        /// Saca los gajos que este espectador ya se llevó tantas veces como permite
        /// <c>stock_per_viewer</c> dentro de su ventana.
        ///
        /// <para>Se cuenta contra <c>wheel_spins</c> y no contra un contador propio:
        /// el historial ya guarda quién ganó qué y cuándo, y un contador paralelo sería
        /// un segundo sitio donde la misma verdad puede quedar desincronizada.</para>
        /// </summary>
        private async Task<List<WheelSegment>> SinStockDelEspectadorAsync(
            int wheelId, string? spinnerLogin, List<WheelSegment> elegibles)
        {
            if (string.IsNullOrWhiteSpace(spinnerLogin)) return elegibles;

            var conTope = elegibles.Where(s => s.StockPerViewer is > 0).ToList();
            if (conTope.Count == 0) return elegibles;

            // Una sola consulta para todos: se trae desde la ventana más vieja que haga
            // falta y después cada gajo aplica la suya en memoria. Son los giros de UNA
            // persona en UNA rueda, así que la lista es corta por definición.
            var desdes = conTope.Select(InicioDeVentana).ToList();
            DateTime? masVieja = desdes.Any(d => d == null) ? null : desdes.Min();

            var ids = conTope.Select(s => s.Id).ToList();
            var query = _db.WheelSpins.AsNoTracking()
                .Where(sp => sp.WheelId == wheelId
                          && sp.SpinnerLogin == spinnerLogin
                          && sp.ResultSegmentId != null
                          && ids.Contains(sp.ResultSegmentId.Value));

            if (masVieja != null) query = query.Where(sp => sp.CreatedAt >= masVieja);

            var suyos = await query
                .Select(sp => new { SegmentId = sp.ResultSegmentId!.Value, sp.CreatedAt })
                .ToListAsync();

            var agotados = conTope
                .Where(s =>
                {
                    var desde = InicioDeVentana(s);
                    var veces = suyos.Count(x => x.SegmentId == s.Id && (desde == null || x.CreatedAt >= desde));
                    return veces >= s.StockPerViewer!.Value;
                })
                .Select(s => s.Id)
                .ToHashSet();

            if (agotados.Count == 0) return elegibles;

            var quedan = elegibles.Where(s => !agotados.Contains(s.Id)).ToList();
            return quedan.Count > 0 ? quedan : elegibles;
        }

        /// <summary>
        /// Evita repetir el último resultado, según <c>no_repeat_scope</c>.
        ///
        /// <para><c>global</c> mira el último giro de la rueda y <c>per_viewer</c> el
        /// último de esa persona. Con dos gajos elegibles y alcance global la regla se
        /// descarta sola —dejaría uno solo posible, que ya no es azar— y por eso el
        /// estrechamiento se descarta si vacía la lista.</para>
        /// </summary>
        private async Task<List<WheelSegment>> SinRepetirAsync(
            Wheel wheel, string? spinnerLogin, List<WheelSegment> elegibles)
        {
            if (wheel.NoRepeatScope == WheelNoRepeatScopes.Off || elegibles.Count <= 1) return elegibles;
            if (wheel.NoRepeatScope == WheelNoRepeatScopes.PerViewer && string.IsNullOrWhiteSpace(spinnerLogin))
                return elegibles;

            var query = _db.WheelSpins.AsNoTracking()
                .Where(sp => sp.WheelId == wheel.Id && sp.ResultSegmentId != null);

            if (wheel.NoRepeatScope == WheelNoRepeatScopes.PerViewer)
                query = query.Where(sp => sp.SpinnerLogin == spinnerLogin);

            var ultimo = await query
                .OrderByDescending(sp => sp.Id)
                .Select(sp => sp.ResultSegmentId)
                .FirstOrDefaultAsync();

            if (ultimo == null) return elegibles;

            var quedan = elegibles.Where(s => s.Id != ultimo.Value).ToList();
            return quedan.Count > 0 ? quedan : elegibles;
        }

        /// <summary>
        /// Piedad: pasados <c>pity_threshold</c> giros seguidos sin premio, el siguiente
        /// no puede volver a ser "nada".
        ///
        /// <para>El plan habla de "un segmento marcado como premio de piedad" pero no
        /// hay ninguna columna que lo marque, y agregarla obligaría al streamer a
        /// declarar dos veces lo mismo. Acá "premio" es cualquier gajo cuyo tipo NO sea
        /// <c>nothing</c>, que es exactamente lo que el contador de la billetera venía
        /// midiendo desde la Fase 2: giros seguidos sin premio.</para>
        /// </summary>
        private async Task<List<WheelSegment>> ConPiedadAsync(
            Wheel wheel, long channelId, string? spinnerLogin, List<WheelSegment> elegibles)
        {
            if (!wheel.PityEnabled || wheel.PityThreshold is not > 0) return elegibles;
            if (string.IsNullOrWhiteSpace(spinnerLogin) || elegibles.Count <= 1) return elegibles;

            var contador = await _db.WheelWallets.AsNoTracking()
                .Where(w => w.ChannelId == channelId && w.ViewerLogin == spinnerLogin)
                .Select(w => (int?)w.PityCounter)
                .FirstOrDefaultAsync() ?? 0;

            if (contador < wheel.PityThreshold.Value) return elegibles;

            var conPremio = elegibles.Where(s => !EsNada(s.Prize)).ToList();
            return conPremio.Count > 0 ? conPremio : elegibles;
        }

        /// <summary>Sube o resetea el contador de piedad según lo que salió.</summary>
        private async Task ActualizarPiedadAsync(Wheel wheel, long channelId, string? spinnerLogin, WheelSegment ganador)
        {
            if (!wheel.PityEnabled || string.IsNullOrWhiteSpace(spinnerLogin)) return;

            var wallet = await _db.WheelWallets
                .FirstOrDefaultAsync(w => w.ChannelId == channelId && w.ViewerLogin == spinnerLogin);
            if (wallet == null) return;

            wallet.PityCounter = EsNada(ganador.Prize) ? wallet.PityCounter + 1 : 0;
        }

        /// <summary>Si el premio de un gajo es "nada". Un JSON ilegible cuenta como nada.</summary>
        private static bool EsNada(string? prizeJson)
        {
            if (string.IsNullOrWhiteSpace(prizeJson)) return true;
            try
            {
                using var doc = JsonDocument.Parse(prizeJson);
                return !doc.RootElement.TryGetProperty("type", out var t)
                    || t.GetString() == WheelPrizeTypes.Nothing;
            }
            catch { return true; }
        }

        private static string LeerString(JsonElement pars, string nombre, string porDefecto)
        {
            if (pars.ValueKind != JsonValueKind.Object) return porDefecto;
            if (!pars.TryGetProperty(nombre, out var v) || v.ValueKind != JsonValueKind.String) return porDefecto;
            return v.GetString() ?? porDefecto;
        }

        private static int MontoDeCoins(string? prizeJson)
        {
            if (string.IsNullOrWhiteSpace(prizeJson)) return 0;
            try
            {
                using var doc = JsonDocument.Parse(prizeJson);
                var root = doc.RootElement;
                if (!root.TryGetProperty("type", out var t) || t.GetString() != WheelPrizeTypes.Coins) return 0;
                if (!root.TryGetProperty("params", out var p) || !p.TryGetProperty("amount", out var a)) return 0;
                return a.TryGetInt32(out var v) ? v : 0;
            }
            catch { return 0; }
        }

        private async Task MarcarPendienteAsync(
            Wheel wheel, string viewerLogin, long? spinId, string? prizeJson, string? motivo = null)
        {
            if (spinId == null) return;

            var spin = await _db.WheelSpins.FirstOrDefaultAsync(s2 => s2.Id == spinId);
            if (spin != null) spin.DeliveryStatus = "pending";

            var yaEsta = await _db.WheelPendingDeliveries.AnyAsync(d => d.SpinId == spinId);
            if (!yaEsta)
            {
                _db.WheelPendingDeliveries.Add(new WheelPendingDelivery
                {
                    WheelId = wheel.Id,
                    SpinId = spinId.Value,
                    ViewerLogin = viewerLogin.ToLowerInvariant(),
                    Prize = prizeJson ?? "{}",
                    Reason = motivo,
                });
            }

            await _db.SaveChangesAsync();
        }

        /// <summary>
        /// Sorteo por peso con <see cref="RandomNumberGenerator"/> y no con
        /// <c>Random</c>: acá se reparten premios que cuestan dinero real, y un PRNG
        /// predecible es una invitación a que alguien calcule cuándo girar.
        /// </summary>
        private static WheelSegment PickWeighted(List<WheelSegment> segments)
        {
            var total = segments.Sum(s => s.Weight);
            if (total <= 0) return segments[0];

            // 8 bytes de entropía llevados a [0,1) y escalados al total de pesos.
            Span<byte> buffer = stackalloc byte[8];
            RandomNumberGenerator.Fill(buffer);
            var fraccion = (decimal)(BitConverter.ToUInt64(buffer) / (double)ulong.MaxValue);
            var objetivo = fraccion * total;

            decimal acumulado = 0;
            foreach (var s in segments)
            {
                acumulado += s.Weight;
                if (objetivo < acumulado) return s;
            }

            // Solo se llega acá por el redondeo del último tramo.
            return segments[^1];
        }
    }
}
