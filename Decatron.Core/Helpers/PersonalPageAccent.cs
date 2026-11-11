using System;
using System.Collections.Generic;
using System.Linq;

namespace Decatron.Core.Helpers;

/// <summary>
/// Color de acento a partir de los píxeles de la foto de perfil (función pura: el servicio achica la imagen y pasa los
/// píxeles). Agrupa colores parecidos, descarta casi blancos, casi negros y grises, y elige el grupo más presente
/// pesado por saturación. Si la foto es toda gris, devuelve el acento por defecto.
/// </summary>
public static class PersonalPageAccent
{
    public const string Fallback = "#5B8CFF";

    public static string FromPixels(IEnumerable<(byte R, byte G, byte B, byte A)> pixels)
    {
        var buckets = new Dictionary<int, (double Weight, long R, long G, long B, int N)>();
        foreach (var (r, g, b, a) in pixels)
        {
            if (a < 128) continue;
            var max = Math.Max(r, Math.Max(g, b)) / 255.0;
            var min = Math.Min(r, Math.Min(g, b)) / 255.0;
            var light = (max + min) / 2;
            var sat = max == min ? 0 : (max - min) / (1 - Math.Abs(2 * light - 1));
            if (light < 0.12 || light > 0.92 || sat < 0.25) continue;
            var key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
            buckets.TryGetValue(key, out var acc);
            buckets[key] = (acc.Weight + sat, acc.R + r, acc.G + g, acc.B + b, acc.N + 1);
        }
        if (buckets.Count == 0) return Fallback;

        // Junta cada grupo con sus vecinos inmediatos para que un degradado no se reparta en muchos grupos chicos
        var best = buckets.Select(kv =>
        {
            var (r, g, b) = (kv.Key >> 8 & 0xF, kv.Key >> 4 & 0xF, kv.Key & 0xF);
            double weight = 0; long sr = 0, sg = 0, sb = 0; int n = 0;
            for (var dr = -1; dr <= 1; dr++)
            for (var dg = -1; dg <= 1; dg++)
            for (var db = -1; db <= 1; db++)
            {
                var k = (r + dr) << 8 | (g + dg) << 4 | (b + db);
                if (r + dr < 0 || g + dg < 0 || b + db < 0 || r + dr > 15 || g + dg > 15 || b + db > 15) continue;
                if (!buckets.TryGetValue(k, out var v)) continue;
                weight += v.Weight; sr += v.R; sg += v.G; sb += v.B; n += v.N;
            }
            return (weight, sr, sg, sb, n);
        }).OrderByDescending(x => x.weight).First();

        return Hex(Legible(((byte)(best.sr / best.n), (byte)(best.sg / best.n), (byte)(best.sb / best.n))));
    }

    /// <summary>Sube la luminosidad de un acento muy oscuro para que se vea sobre el fondo grafito de la plantilla.</summary>
    private static (byte, byte, byte) Legible((byte R, byte G, byte B) c)
    {
        var lum = 0.2126 * c.R + 0.7152 * c.G + 0.0722 * c.B;
        if (lum >= 90) return c;
        var f = 90 / Math.Max(lum, 1);
        return ((byte)Math.Min(255, c.R * f), (byte)Math.Min(255, c.G * f), (byte)Math.Min(255, c.B * f));
    }

    public static string Hex((byte R, byte G, byte B) c) => $"#{c.R:X2}{c.G:X2}{c.B:X2}";
}
