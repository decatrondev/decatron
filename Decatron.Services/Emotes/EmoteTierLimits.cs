namespace Decatron.Services.Emotes
{
    /// <summary>
    /// Límites por tier de los emotes propios (.dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 3). Todo es gratis;
    /// el tier del dueño del canal solo amplía cuántos emotes aprobados puede tener. Los topes son muy
    /// generosos a propósito: que nadie sienta que necesita pagar para tener los emotes de su comunidad.
    /// Bajar de tier no borra nada: lo que ya existe queda y solo no se puede agregar por encima del tope.
    /// </summary>
    public sealed class EmoteTierLimits
    {
        public string Tier { get; init; } = "free";
        public int MaxEmotes { get; init; }

        /// <summary>Cuántos esperan revisión a la vez en un canal (los pendientes no gastan lugar hasta aprobarse)</summary>
        public const int MaxPendingPerChannel = 100;

        private static readonly Dictionary<string, EmoteTierLimits> ByTier = new()
        {
            ["free"] = new() { Tier = "free", MaxEmotes = 150 },
            ["supporter"] = new() { Tier = "supporter", MaxEmotes = 400 },
            ["premium"] = new() { Tier = "premium", MaxEmotes = 1000 },
            ["fundador"] = new() { Tier = "fundador", MaxEmotes = 3000 },
        };

        public static EmoteTierLimits ForTier(string? tier)
        {
            if (tier is "fundador" or "admin") return ByTier["fundador"];
            return ByTier.GetValueOrDefault(tier ?? "free", ByTier["free"]);
        }
    }
}
