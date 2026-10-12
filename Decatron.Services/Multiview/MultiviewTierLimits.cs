using System.Collections.Generic;

namespace Decatron.Services.Multiview
{
    /// <summary>
    /// Límites por tier del Multi-view (.dev/plans/MULTIVIEW_PLAN.md). Todas las funciones son gratis; el tier solo
    /// amplía cuántas casillas se ven a la vez. Mismo patrón que SongRequestTierLimits. Los números son una propuesta
    /// inicial que se ajusta con las mediciones de rendimiento.
    /// </summary>
    public sealed class MultiviewTierLimits
    {
        public string Tier { get; init; } = "free";
        public int MaxSlots { get; init; }
        /// <summary>Layouts guardados en la cuenta. Bajar de tier no borra los que ya hay: solo impide guardar más.</summary>
        public int MaxLayouts { get; init; }

        /// <summary>Tope técnico: ningún tier pasa de aquí aunque el plan diga "sin tope".</summary>
        public const int HardMaxSlots = 12;

        private static readonly Dictionary<string, MultiviewTierLimits> ByTier = new()
        {
            ["free"] = new() { Tier = "free", MaxSlots = 4, MaxLayouts = 3 },
            ["supporter"] = new() { Tier = "supporter", MaxSlots = 6, MaxLayouts = 10 },
            ["premium"] = new() { Tier = "premium", MaxSlots = 9, MaxLayouts = 25 },
            ["fundador"] = new() { Tier = "fundador", MaxSlots = HardMaxSlots, MaxLayouts = 100 },
        };

        public static MultiviewTierLimits ForTier(string? tier)
        {
            if (tier is "fundador" or "admin") return ByTier["fundador"];
            return ByTier.GetValueOrDefault(tier ?? "free", ByTier["free"]);
        }
    }
}
