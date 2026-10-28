using System;
using System.Globalization;
using System.Text.RegularExpressions;

namespace Decatron.Services.Promo
{
    /// <summary>
    /// Enlace corto del QR de una pieza: <c>https://decatron.net/r/{código}</c>. El código solo identifica pieza (p) o tarjeta propia (c) y la cuenta
    /// (base 36); NUNCA lleva el destino: ese se lee del catálogo o de la tarjeta, así que no es una redirección abierta. Sin base de datos para poder probarlo.
    /// </summary>
    public static class PromoLinks
    {
        public const string Base = "https://decatron.net/r/";
        private static readonly Regex CodeRx = new(@"^([pc])(\d{1,18})-([0-9a-z]{1,13})$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        /// <summary>Código de una pieza del bot (id &gt; 0) o de una tarjeta propia (id &lt; 0, como en el overlay) para una cuenta.</summary>
        public static string Code(long pieceId, long userId) =>
            $"{(PromoOwnCards.IsOwnPieceId(pieceId) ? "c" : "p")}{Math.Abs(pieceId)}-{ToBase36(userId)}";

        public static string ShortUrl(long pieceId, long userId) => Base + Code(pieceId, userId);

        /// <summary>Lee un código: id de pieza (negativo si es tarjeta propia) y cuenta. False si no tiene la forma esperada.</summary>
        public static bool TryParse(string? code, out long pieceId, out long userId)
        {
            pieceId = 0; userId = 0;
            var m = CodeRx.Match(code ?? "");
            if (!m.Success || !long.TryParse(m.Groups[2].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var id) || id <= 0) return false;
            var u = FromBase36(m.Groups[3].Value);
            if (u == null || u <= 0) return false;
            pieceId = m.Groups[1].Value == "c" ? -id : id;
            userId = u.Value;
            return true;
        }

        private static readonly Regex BotRx = new(@"bot|crawl|spider|preview|slurp|facebookexternalhit|discord|telegram|whatsapp|curl|wget|python|http-client", RegexOptions.IgnoreCase | RegexOptions.Compiled);

        /// <summary>Vista previa de enlaces o rastreador: se redirige igual pero no se cuenta como clic de una persona.</summary>
        public static bool LooksAutomated(string? userAgent) => string.IsNullOrWhiteSpace(userAgent) || BotRx.IsMatch(userAgent);

        private static string ToBase36(long v)
        {
            const string d = "0123456789abcdefghijklmnopqrstuvwxyz";
            if (v <= 0) return "0";
            var s = "";
            while (v > 0) { s = d[(int)(v % 36)] + s; v /= 36; }
            return s;
        }

        private static long? FromBase36(string s)
        {
            long v = 0;
            foreach (var c in s)
            {
                var d = c <= '9' ? c - '0' : c - 'a' + 10;
                if (v > (long.MaxValue - d) / 36) return null;
                v = v * 36 + d;
            }
            return v;
        }
    }
}
