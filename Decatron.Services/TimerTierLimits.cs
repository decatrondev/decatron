namespace Decatron.Services
{
    /// <summary>
    /// Límites del Timer por tier. Por ahora solo uno: la tarjeta de Decatron que sale de vez en cuando sobre el overlay.
    /// Mismo criterio que Song Request y Game Overlays: el plan gratis la muestra sí o sí; desde Supporter se puede ocultar.
    /// </summary>
    public static class TimerTierLimits
    {
        /// <summary>false = la tarjeta de Decatron sale sí o sí en el overlay del timer (lo que paga el plan gratis).</summary>
        public static bool CanHidePromo(string? tier) => tier is "supporter" or "premium" or "patrocinador" or "fundador" or "admin";

        /// <summary>advancedConfig.decatronCard: el streamer decide si la tarjeta sale (por defecto sí; solo un <c>false</c> explícito la apaga).</summary>
        public static bool CardEnabled(string? advancedConfigJson)
        {
            if (string.IsNullOrWhiteSpace(advancedConfigJson)) return true;
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(advancedConfigJson);
                return !(doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Object
                    && doc.RootElement.TryGetProperty("decatronCard", out var v) && v.ValueKind == System.Text.Json.JsonValueKind.False);
            }
            catch { return true; }
        }

        /// <summary>¿Se muestra la tarjeta? Siempre si el plan no puede ocultarla; si puede, según el interruptor del streamer.</summary>
        public static bool ShowCard(string? tier, string? advancedConfigJson) => !CanHidePromo(tier) || CardEnabled(advancedConfigJson);
    }
}
