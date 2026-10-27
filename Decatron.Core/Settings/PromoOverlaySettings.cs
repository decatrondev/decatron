namespace Decatron.Core.Settings
{
    /// <summary>
    /// Interruptor del overlay de Promociones. Con <see cref="Enabled"/> en false las tablas <c>promo_*</c> existen
    /// pero el módulo no se expone (los controladores responden 404). Por defecto encendido; se apaga con la sección
    /// <c>PromoOverlay</c> de appsettings. Plan: .dev/plans/overlay-promo/PLAN.md §4
    /// </summary>
    public class PromoOverlaySettings
    {
        public const string SectionName = "PromoOverlay";

        public bool Enabled { get; set; } = true;
    }
}
