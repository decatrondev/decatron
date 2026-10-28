using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Decatron.Core.Models.Promo;

namespace Decatron.Services.Promo
{
    /// <summary>
    /// Reglas puras del comando de chat de Promociones (por defecto !dpromo): nombre válido, quién puede usarlo y cómo se
    /// busca una pieza por nombre. Sin base de datos para poder probarlas. Plan: .dev/plans/overlay-promo/PLAN.md §9.3.
    /// </summary>
    public static class PromoCommand
    {
        public const string DefaultName = "dpromo";
        public static readonly string[] Roles = { "moderator", "vip", "subscriber", "everyone" };

        /// <summary>Cuánto espera una pieza pedida con el comando a que el overlay la consulte antes de descartarse.</summary>
        public static readonly TimeSpan ForcedTtl = TimeSpan.FromSeconds(90);

        private static readonly Regex NameRx = new("^[a-z0-9_]{2,20}$", RegexOptions.Compiled);

        /// <summary>Nombre sin "!", en minúsculas; null si no es válido (2-20 letras, números o guion bajo).</summary>
        public static string? NormalizeName(string? raw)
        {
            var n = (raw ?? "").Trim().TrimStart('!').ToLowerInvariant();
            return NameRx.IsMatch(n) ? n : null;
        }

        /// <summary>El streamer y el Lead Moderator siempre pueden; el resto según el rol mínimo elegido.</summary>
        public static bool IsAllowed(string minRole, bool broadcaster, bool leadMod, bool mod, bool vip, bool sub)
        {
            if (broadcaster || leadMod) return true;
            return minRole switch
            {
                "everyone" => true,
                "subscriber" => sub || vip || mod,
                "vip" => vip || mod,
                _ => mod,
            };
        }

        /// <summary>Nombre visible de una pieza en el idioma pedido: el título, o el comienzo del texto si no tiene título.</summary>
        public static string DisplayName(PromoPiece p, bool english)
        {
            var title = english && p.TitleEn != "" ? p.TitleEn : p.TitleEs;
            if (string.IsNullOrWhiteSpace(title)) title = english && p.BodyEn != "" ? p.BodyEn : p.BodyEs;
            title = (title ?? "").Replace('\n', ' ').Trim();
            return title.Length > 40 ? title[..40].TrimEnd() + "…" : title;
        }

        /// <summary>Busca por nombre sin distinguir mayúsculas ni tildes: primero coincidencia exacta, luego "empieza con", luego "contiene".</summary>
        public static PromoPiece? FindByName(IReadOnlyList<PromoPiece> pieces, string query)
        {
            var q = Fold(query);
            if (q == "") return null;
            var names = pieces.Select(p => (p, es: Fold(p.TitleEs), en: Fold(p.TitleEn))).ToList();
            return names.FirstOrDefault(x => x.es == q || x.en == q).p
                ?? names.FirstOrDefault(x => x.es.StartsWith(q) || x.en.StartsWith(q)).p
                ?? names.FirstOrDefault(x => x.es.Contains(q) || x.en.Contains(q)).p;
        }

        private static string Fold(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return "";
            var d = s.Trim().ToLowerInvariant().Normalize(System.Text.NormalizationForm.FormD);
            return new string(d.Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark).ToArray());
        }

        /// <summary>Deja una pieza pedida en la zona; la próxima consulta del overlay a esa zona la devuelve.</summary>
        public static void Force(PromoPlayback.State state, PromoPiece piece, DateTime now)
        {
            lock (state.Gate) state.Forced[piece.Zone] = (piece.Id, now + ForcedTtl);
        }

        /// <summary>La pieza pedida pendiente en esa zona (y la consume), o null si no hay o venció. Llamar con el candado ya tomado.</summary>
        public static long? TakeForced(PromoPlayback.State state, string zone, DateTime now)
        {
            if (!state.Forced.TryGetValue(zone, out var f)) return null;
            state.Forced.Remove(zone);
            return f.Expires >= now ? f.PieceId : null;
        }
    }
}
