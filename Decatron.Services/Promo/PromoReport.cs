using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Decatron.Services.Promo
{
    /// <summary>Una fila del informe de un anunciante: una pieza en un día (totales de todos los canales, sin identificar personas).</summary>
    public record PromoReportRow(string Advertiser, long PieceId, string Title, DateTime Day, long Views, long Seconds, long Clicks);

    /// <summary>
    /// Informe CSV de publicidad de terceros para el dueño. Sin base de datos: recibe las filas y arma el texto.
    /// Plan: .dev/plans/overlay-promo/PLAN.md §11 (punto 8).
    /// </summary>
    public static class PromoReport
    {
        public const string Header = "advertiser,piece_id,piece,day,views,seconds,clicks";

        /// <summary>Un campo de texto seguro para CSV: comillas dobles escapadas y, si empieza con = + - @ (o tab/retorno), una comilla simple delante para que la hoja de cálculo no lo ejecute como fórmula.</summary>
        public static string Field(string? s)
        {
            s ??= "";
            if (s.Length > 0 && "=+-@\t\r".Contains(s[0])) s = "'" + s;
            return s.IndexOfAny(new[] { ',', '"', '\n', '\r' }) >= 0 ? "\"" + s.Replace("\"", "\"\"") + "\"" : s;
        }

        /// <summary>Filas ordenadas por anunciante, pieza y día, más una fila TOTAL al final con la suma (si hay datos).</summary>
        public static string ToCsv(IEnumerable<PromoReportRow> rows)
        {
            var list = rows.OrderBy(r => r.Advertiser, StringComparer.OrdinalIgnoreCase).ThenBy(r => r.PieceId).ThenBy(r => r.Day).ToList();
            var sb = new StringBuilder(Header).Append('\n');
            foreach (var r in list)
                sb.Append(Field(r.Advertiser)).Append(',').Append(r.PieceId.ToString(CultureInfo.InvariantCulture)).Append(',').Append(Field(r.Title)).Append(',')
                  .Append(r.Day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)).Append(',')
                  .Append(r.Views.ToString(CultureInfo.InvariantCulture)).Append(',').Append(r.Seconds.ToString(CultureInfo.InvariantCulture)).Append(',')
                  .Append(r.Clicks.ToString(CultureInfo.InvariantCulture)).Append('\n');
            if (list.Count > 0)
                sb.Append("TOTAL,,,,").Append(list.Sum(r => r.Views).ToString(CultureInfo.InvariantCulture)).Append(',')
                  .Append(list.Sum(r => r.Seconds).ToString(CultureInfo.InvariantCulture)).Append(',').Append(list.Sum(r => r.Clicks).ToString(CultureInfo.InvariantCulture)).Append('\n');
            return sb.ToString();
        }

        /// <summary>Rango del informe: máximo 366 días; si falta una fecha, los últimos 30 días; si vienen al revés, se rechaza.</summary>
        public static (DateTime From, DateTime To, string? Error) Range(DateTime? from, DateTime? to, DateTime today)
        {
            var t = (to ?? today).Date;
            var f = (from ?? t.AddDays(-29)).Date;
            if (f > t) return (f, t, "rangeOrder");
            if ((t - f).TotalDays > 365) return (f, t, "rangeTooLong");
            return (f, t, null);
        }
    }
}
