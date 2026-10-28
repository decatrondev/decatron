using System;
using System.Collections.Generic;
using System.Linq;
using Decatron.Core.Models.Promo;

namespace Decatron.Services.Promo
{
    /// <summary>
    /// Mezcla de las dos capas del overlay de Promociones, sin base de datos: el valor del dueño, lo que cambió el streamer y los
    /// límites del dueño. Los límites siempre mandan: lo que el streamer guardó se recorta al rango vigente al leerlo, así que
    /// subir un mínimo después no deja piezas fuera de regla. Plan: .dev/plans/overlay-promo/PLAN.md §3.3c.
    /// </summary>
    public static class PromoOverrides
    {
        public record PieceResult(PromoPiece Piece, int ScalePercent);

        public static int ClampDuration(int seconds, PromoOverlayLimits l) => Math.Clamp(seconds, l.MinDurationSeconds, Math.Max(l.MinDurationSeconds, l.MaxDurationSeconds));
        public static int ClampScale(int percent, PromoOverlayLimits l) => Math.Clamp(percent, l.MinScalePercent, Math.Max(l.MinScalePercent, l.MaxScalePercent));
        public static int ClampMargin(int px, PromoOverlayLimits l) => Math.Clamp(px, 0, l.MaxZoneMargin);

        /// <summary>
        /// La pieza tal como la ve este canal: duración y plantilla del streamer si las cambió (recortadas a los límites; la plantilla solo si
        /// existe, está activa y es de la misma zona), y su escala. Devuelve una copia: el catálogo compartido no se toca.
        /// </summary>
        public static PieceResult ApplyToPiece(PromoPiece piece, PromoPieceOverride? o, PromoOverlayLimits limits, IReadOnlyCollection<PromoTemplate> templates, bool pinnedLocked = false)
        {
            if (o == null) return new PieceResult(piece, 100);
            var copy = new PromoPiece
            {
                Id = piece.Id, IsPinned = piece.IsPinned, Kind = piece.Kind, Origin = piece.Origin, TitleEs = piece.TitleEs, TitleEn = piece.TitleEn, BodyEs = piece.BodyEs, BodyEn = piece.BodyEn,
                LinkUrl = piece.LinkUrl, ShowQr = piece.ShowQr, ImageUrl = piece.ImageUrl, Icon = piece.Icon, TemplateId = piece.TemplateId, Zone = piece.Zone,
                Priority = piece.Priority, Weight = piece.Weight, DurationSeconds = piece.DurationSeconds, StartsAt = piece.StartsAt, EndsAt = piece.EndsAt,
                Platforms = piece.Platforms, OnlyChannels = piece.OnlyChannels, Status = piece.Status, SortOrder = piece.SortOrder,
            };
            // Pieza fija con tarjetas propias en uso: nunca más corta ni más chica que lo del dueño (sí puede ser más larga o más grande).
            var floorDuration = pinnedLocked && piece.IsPinned ? piece.DurationSeconds : 0;
            if (o.DurationSeconds is int d) copy.DurationSeconds = Math.Max(floorDuration, ClampDuration(d, limits));
            if (o.TemplateId is long t && templates.Any(x => x.Id == t && x.IsEnabled && x.Zone == piece.Zone)) copy.TemplateId = t;
            return new PieceResult(copy, o.ScalePercent is int s ? Math.Max(pinnedLocked && piece.IsPinned ? 100 : 0, ClampScale(s, limits)) : 100);
        }

        /// <summary>La zona con la posición del streamer (ancla válida y márgenes recortados), o la del dueño si no cambió nada.</summary>
        public static PromoZone ApplyToZone(PromoZone zone, PromoZoneOverride? o, PromoOverlayLimits limits)
        {
            if (o == null || !PromoValidator.Anchors.Contains(o.Anchor)) return zone;
            return new PromoZone { Id = zone.Id, Key = zone.Key, NameEs = zone.NameEs, NameEn = zone.NameEn, IsEnabled = zone.IsEnabled, SortOrder = zone.SortOrder,
                Anchor = o.Anchor, MarginX = ClampMargin(o.MarginX, limits), MarginY = ClampMargin(o.MarginY, limits) };
        }

        /// <summary>Errores al guardar lo del streamer (fuera de rango = se rechaza, no se recorta en silencio).</summary>
        public static List<string> ValidatePiece(int? duration, int? scale, long? templateId, PromoPiece piece, PromoOverlayLimits l, IReadOnlyCollection<PromoTemplate> templates)
        {
            var e = new List<string>();
            if (duration is int d && (d < l.MinDurationSeconds || d > l.MaxDurationSeconds)) e.Add("durationRange");
            if (scale is int s && (s < l.MinScalePercent || s > l.MaxScalePercent)) e.Add("scaleRange");
            if (templateId is long t && !templates.Any(x => x.Id == t && x.IsEnabled && x.Zone == piece.Zone)) e.Add("templateInvalid");
            return e;
        }

        public static List<string> ValidateZone(string anchor, int marginX, int marginY, PromoOverlayLimits l)
        {
            var e = new List<string>();
            if (!PromoValidator.Anchors.Contains(anchor)) e.Add("anchorInvalid");
            if (marginX < 0 || marginY < 0 || marginX > l.MaxZoneMargin || marginY > l.MaxZoneMargin) e.Add("marginRange");
            return e;
        }

        /// <summary>Coherencia de los límites que fija el dueño.</summary>
        public static List<string> ValidateLimits(PromoOverlayLimits l)
        {
            var e = new List<string>();
            if (l.MinDurationSeconds < 1 || l.MaxDurationSeconds > 300 || l.MinDurationSeconds > l.MaxDurationSeconds) e.Add("durationLimitsRange");
            if (l.MinScalePercent < 20 || l.MaxScalePercent > 300 || l.MinScalePercent > l.MaxScalePercent) e.Add("scaleLimitsRange");
            if (l.MaxZoneMargin < 0 || l.MaxZoneMargin > 1000) e.Add("zoneMarginLimitRange");
            if (l.BotPerOwn < 1 || l.BotPerOwn > 10) e.Add("botPerOwnRange");
            if (l.OwnMinIntervalMinutes < 1 || l.OwnMinIntervalMinutes > 240) e.Add("ownIntervalRange");
            return e;
        }
    }
}
