using System.Collections.Generic;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// Topes por plan de la traducción en vivo. Todas las funciones son gratis; el plan solo amplía cuántos oyentes
    /// simultáneos puede aceptar el canal (lo que cuesta ancho de banda y recursos del servidor). Los idiomas no se topean por
    /// plan: cada uno ya se paga con los créditos del streamer. Mismo patrón que SongRequestTierLimits. Números propuestos que
    /// se ajustan con mediciones reales.
    /// </summary>
    public sealed class LiveTranslationTierLimits
    {
        public string Tier { get; init; } = "free";
        /// <summary>Máximo que el streamer puede elegir para sus oyentes simultáneos.</summary>
        public int MaxListeners { get; init; }
        /// <summary>Valor recomendado cuando el streamer no eligió ninguno.</summary>
        public int DefaultListeners { get; init; }

        private static readonly Dictionary<string, LiveTranslationTierLimits> ByTier = new()
        {
            ["free"] = new() { Tier = "free", MaxListeners = 20, DefaultListeners = 10 },
            ["supporter"] = new() { Tier = "supporter", MaxListeners = 100, DefaultListeners = 50 },
            ["premium"] = new() { Tier = "premium", MaxListeners = 300, DefaultListeners = 100 },
            ["patrocinador"] = new() { Tier = "patrocinador", MaxListeners = 600, DefaultListeners = 150 },
            ["fundador"] = new() { Tier = "fundador", MaxListeners = 1000, DefaultListeners = 200 },
        };

        public static LiveTranslationTierLimits ForTier(string? tier)
        {
            if (tier is "fundador" or "admin") return ByTier["fundador"];
            return ByTier.GetValueOrDefault(tier ?? "free", ByTier["free"]);
        }
    }
}
