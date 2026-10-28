using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Decatron.Core.Models.Promo;

namespace Decatron.Services.Promo
{
    /// <summary>
    /// Tarjetas propias del streamer (solo texto), sin base de datos para poder probarlas: cantidades por tier, validación, conversión a pieza
    /// de la rotación y la regla de la proporción con las piezas del bot. Plan: .dev/plans/overlay-promo/PLAN.md §3.5.
    /// </summary>
    public static class PromoOwnCards
    {
        /// <summary>Las piezas propias llevan id negativo (-id de la tarjeta) para no chocar con el catálogo del dueño en la rotación.</summary>
        public static long PieceId(long cardId) => -cardId;
        public static bool IsOwnPieceId(long pieceId) => pieceId < 0;

        public const string OwnKind = "own";
        public const int MaxTitle = 80;
        public const int MaxBody = 200;

        /// <summary>Cuántas tarjetas propias puede tener una cuenta por tier (solo cantidades: todas las funciones son gratis). Bajar de tier no borra: solo impide crear más.</summary>
        public static int MaxCards(string? tier) => tier switch
        {
            "supporter" => 10,
            "premium" => 25,
            "patrocinador" => 50,
            "fundador" or "admin" => 200,
            _ => 3,
        };

        private static readonly Regex ControlRx = new(@"[\p{Cc}]", RegexOptions.Compiled);
        private static string Clean(string? s) => ControlRx.Replace((s ?? "").Trim(), "");

        public static void Normalize(PromoOwnCard c)
        {
            c.Title = Clean(c.Title); c.Body = Clean(c.Body);
            c.Zone = Clean(c.Zone).ToLowerInvariant();
            c.LinkUrl = Clean(c.LinkUrl) is { Length: > 0 } l ? l : null;
            c.Icon = Clean(c.Icon) is { Length: > 0 } i ? i.ToLowerInvariant() : null;
        }

        /// <summary>Códigos de error al guardar (fuera de rango = se rechaza, no se recorta en silencio).</summary>
        public static List<string> Validate(PromoOwnCard c, PromoOverlayLimits limits, IReadOnlyCollection<PromoZone> zones)
        {
            var e = new List<string>();
            if (c.Title.Length > MaxTitle) e.Add("titleTooLong");
            if (c.Body.Length > MaxBody) e.Add("bodyTooLong");
            if (c.Title.Length == 0 && c.Body.Length == 0) e.Add("titleOrBodyRequired");
            var texts = new[] { c.Title, c.Body };
            if (texts.Any(t => t.Contains('<') || t.Contains('>'))) e.Add("noAngleBrackets");
            var used = texts.SelectMany(t => PromoValidator.VariableRx.Matches(t).Select(m => m.Groups[1].Value.ToLowerInvariant())).ToList();
            if (used.Any(v => !PromoValidator.Variables.Contains(v))) e.Add("unknownVariable");
            if (used.Contains("link") && c.LinkUrl == null) e.Add("linkVariableNeedsLink");
            if (c.LinkUrl != null && !PromoValidator.IsHttpsUrl(c.LinkUrl)) e.Add("linkInvalid");
            if (c.ShowQr && c.LinkUrl == null) e.Add("qrNeedsLink");
            if (c.Icon != null && !PromoValidator.Icons.Contains(c.Icon)) e.Add("iconInvalid");
            if (!zones.Any(z => z.Key == c.Zone && z.IsEnabled)) e.Add("zoneInvalid");
            if (c.DurationSeconds < limits.MinDurationSeconds || c.DurationSeconds > limits.MaxDurationSeconds) e.Add("durationRange");
            if (c.IntervalMinutes < limits.OwnMinIntervalMinutes || c.IntervalMinutes > 240) e.Add("intervalRange");
            return e;
        }

        /// <summary>La tarjeta como pieza de la rotación (id negativo, origen propio). La plantilla es la elegida si sirve para su zona, o la primera de la zona.</summary>
        public static PromoPiece ToPiece(PromoOwnCard c, IReadOnlyCollection<PromoTemplate> templates, PromoOverlayLimits limits)
        {
            var tpl = templates.FirstOrDefault(t => t.Id == c.TemplateId && t.IsEnabled && t.Zone == c.Zone)
                ?? templates.Where(t => t.IsEnabled && t.Zone == c.Zone).OrderBy(t => t.SortOrder).ThenBy(t => t.Id).FirstOrDefault();
            return new PromoPiece
            {
                Id = PieceId(c.Id), Kind = OwnKind, Origin = "own", TitleEs = c.Title, TitleEn = c.Title, BodyEs = c.Body, BodyEn = c.Body,
                LinkUrl = c.LinkUrl, ShowQr = c.ShowQr, Icon = c.Icon, TemplateId = tpl?.Id, Zone = c.Zone, Priority = 0, Weight = 1,
                DurationSeconds = PromoOverrides.ClampDuration(c.DurationSeconds, limits), Platforms = "all", Status = "published",
            };
        }

        /// <summary>Tarjetas que pueden salir ahora en esta zona: encendidas, no ocultas por el dueño, con plantilla y pasado su intervalo.</summary>
        public static List<PromoOwnCard> Eligible(IEnumerable<PromoOwnCard> cards, string zone, PromoOverlayLimits limits, IReadOnlyCollection<PromoTemplate> templates,
            IReadOnlyDictionary<long, DateTime> lastShown, DateTime now) =>
            cards.Where(c => c.IsEnabled && !c.HiddenByAdmin && c.Zone == zone && ToPiece(c, templates, limits).TemplateId != null
                && (!lastShown.TryGetValue(c.Id, out var at) || (now - at).TotalMinutes >= Math.Max(c.IntervalMinutes, limits.OwnMinIntervalMinutes))).ToList();

        /// <summary>
        /// ¿Toca una tarjeta propia? Solo si salió al menos <c>BotPerOwn</c> pieza(s) del bot desde la última propia (la cuenta empieza en 0: la primera
        /// siempre es del bot) y hay una pieza del bot disponible. Así quien no tiene nada del bot activo no muestra tarjetas propias.
        /// </summary>
        public static bool OwnTurn(int botSinceOwn, int botEligibleCount, PromoOverlayLimits limits) =>
            botEligibleCount > 0 && botSinceOwn >= Math.Max(1, limits.BotPerOwn);

        /// <summary>¿El canal usa tarjetas propias? Las que están encendidas y no ocultas por el dueño; con eso las piezas fijas dejan de poder apagarse.</summary>
        public static bool InUse(IEnumerable<PromoOwnCard> cards) => cards.Any(c => c.IsEnabled && !c.HiddenByAdmin);

        public static PromoOwnCard? Pick(IReadOnlyList<PromoOwnCard> eligible, long? lastPieceId, double roll)
        {
            if (eligible.Count == 0) return null;
            var pool = eligible.Count > 1 && lastPieceId != null ? eligible.Where(c => PieceId(c.Id) != lastPieceId).ToList() : eligible.ToList();
            return pool[Math.Min(pool.Count - 1, (int)(roll * pool.Count))];
        }
    }
}
