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
    /// <summary>Ayudantes compartidos por todas las partes del controlador. Parte de <see cref="WheelController"/>.</summary>
    public partial class WheelController
    {
        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                return sessionId;

            var claim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(claim, out var channelOwnerId)) return channelOwnerId;

            return GetUserId();
        }

        private static object ToListDto(Wheel w) => new
        {
            id = w.Id,
            name = w.Name,
            mode = w.Mode,
            slug = w.Slug,
            isEnabled = w.IsEnabled,
            isActive = w.IsActive,
            createdAt = w.CreatedAt
        };

        private static object ToDetailDto(Wheel w) => new
        {
            id = w.Id,
            name = w.Name,
            mode = w.Mode,
            slug = w.Slug,
            isEnabled = w.IsEnabled,
            isActive = w.IsActive,
            creditLabel = w.CreditLabel,
            spinPrice = w.SpinPrice,
            isAccumulable = w.IsAccumulable,
            allowMultiSpin = w.AllowMultiSpin,
            maxMultiSpin = w.MaxMultiSpin,
            creditsPublic = w.CreditsPublic,
            overflowPolicy = w.OverflowPolicy,
            multiFitPolicy = w.MultiFitPolicy,
            creditExpiry = w.CreditExpiry,
            creditExpiryDays = w.CreditExpiryDays,
            spinCommand = w.SpinCommand,
            balanceCommand = w.BalanceCommand,
            buyCommand = w.BuyCommand,
            commandEnabled = w.CommandEnabled,
            autoSpin = w.AutoSpin,
            spinCooldownSeconds = w.SpinCooldownSeconds,
            maxSpinsPerStream = w.MaxSpinsPerStream,
            maxCoinsPerHour = w.MaxCoinsPerHour,
            noRepeatScope = w.NoRepeatScope,
            pityEnabled = w.PityEnabled,
            pityThreshold = w.PityThreshold,
            visualConfig = Parse(w.VisualConfig),
            announceConfig = Parse(w.AnnounceConfig)
        };

        private static object ToSegmentDto(WheelSegment s, decimal percentage) => new
        {
            id = s.Id,
            label = s.Label,
            weight = s.Weight,
            color = s.Color,
            icon = s.Icon,
            displayOrder = s.DisplayOrder,
            prize = Parse(s.Prize),
            isEnabled = s.IsEnabled,
            stockTotal = s.StockTotal,
            stockPerViewer = s.StockPerViewer,
            stockWindow = s.StockWindow,
            stockRemaining = s.StockRemaining,
            // El % que el panel muestra al lado de cada gajo. Se calcula, no se guarda:
            // depende de qué otros gajos estén activos en este momento.
            effectivePercentage = percentage
        };

        /// <summary>Las medidas del lienzo del overlay. Espejo de <c>visualConfig.ts</c>.</summary>
        private const int LienzoAncho = 1920;
        private const int LienzoAlto = 1080;

        /// <summary>
        /// Lo mínimo que puede medir la marca de agua para que se siga leyendo.
        /// Es el tamaño con el que se dibuja por defecto: encogerla más no es
        /// diseñar, es apagarla sin tener el tier.
        /// </summary>
        private const int MarcaAnchoMinimo = 150;
        private const int MarcaAltoMinimo = 12;

        /// <summary>
        /// Deja <c>showWatermark</c> en true dentro del jsonb de aspecto, respetando
        /// todo lo demás que el streamer haya configurado.
        ///
        /// Desde que existe el lienzo, el booleano no alcanza: con posiciones libres,
        /// sacar la marca fuera de la pantalla o encogerla hasta que no se lea es
        /// apagarla igual, y sin tocar el toggle. Así que acá también se le mete la
        /// caja dentro del lienzo y se le exige un tamaño mínimo.
        /// </summary>
        private static string ForzarMarcaDeAgua(string visualJson)
        {
            try
            {
                var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(visualJson)
                           ?? new Dictionary<string, JsonElement>();

                var salida = dict.ToDictionary(kv => kv.Key, kv => (object?)kv.Value);
                salida["showWatermark"] = true;

                if (dict.TryGetValue("layout", out var layout) && layout.ValueKind == JsonValueKind.Object)
                {
                    var capas = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(layout.GetRawText());
                    if (capas != null && capas.TryGetValue("watermark", out var marca)
                        && marca.ValueKind == JsonValueKind.Object)
                    {
                        var salidaCapas = capas.ToDictionary(kv => kv.Key, kv => (object?)kv.Value);
                        salidaCapas["watermark"] = CajaLegible(marca);
                        salida["layout"] = salidaCapas;
                    }
                }

                return JsonSerializer.Serialize(salida);
            }
            catch
            {
                // Un jsonb que no se puede leer se guarda tal cual: el overlay lo
                // completa con los defaults, que ya traen la marca encendida y la
                // dibujan en su sitio.
                return visualJson;
            }
        }

        /// <summary>
        /// La caja de la marca, con un tamaño que se lee y dentro de la pantalla.
        /// </summary>
        private static Dictionary<string, double> CajaLegible(JsonElement caja)
        {
            static double Leer(JsonElement o, string campo, double porDefecto) =>
                o.TryGetProperty(campo, out var v) && v.ValueKind == JsonValueKind.Number
                    ? v.GetDouble()
                    : porDefecto;

            var ancho = Math.Clamp(Leer(caja, "width", MarcaAnchoMinimo), MarcaAnchoMinimo, LienzoAncho);
            var alto = Math.Clamp(Leer(caja, "height", MarcaAltoMinimo), MarcaAltoMinimo, LienzoAlto);

            return new Dictionary<string, double>
            {
                ["x"] = Math.Clamp(Leer(caja, "x", 0), 0, LienzoAncho - ancho),
                ["y"] = Math.Clamp(Leer(caja, "y", 0), 0, LienzoAlto - alto),
                ["width"] = ancho,
                ["height"] = alto,
            };
        }

        private static object? Parse(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try { return JsonSerializer.Deserialize<JsonElement>(json); }
            catch { return null; }
        }
    }
}
