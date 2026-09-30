using System.Collections.Generic;

namespace Decatron.Services.SongRequest
{
    /// <summary>
    /// Límites por tier de Song Request (.dev/plans/SONG_REQUEST_PLAYLISTS_PLAN.md). Todas las funciones son
    /// gratis; el tier del dueño del canal solo amplía cantidades. Bajar de tier no borra nada: lo que ya
    /// existe queda y solo no se puede agregar por encima del tope. Mismo patrón que GameOverlayTierLimits.
    /// </summary>
    public sealed class SongRequestTierLimits
    {
        public string Tier { get; init; } = "free";
        public int MaxPlaylists { get; init; }
        public int MaxItemsPerPlaylist { get; init; }
        /// <summary>Días de historial que se ven (las favoritas se ven siempre). int.MaxValue = sin tope.</summary>
        public int HistoryDays { get; init; }
        /// <summary>Plantillas de diseño propias.</summary>
        public int MaxTemplates { get; init; }
        /// <summary>false = la tarjeta de Decatron sale sí o sí en el overlay (lo que paga el plan gratis).</summary>
        public bool CanHidePromo { get; init; }

        /// <summary>"Sin tope" igual tiene un tope técnico.</summary>
        public const int HardMaxPlaylists = 100;
        public const int HardMaxTemplates = 100;

        public bool UnlimitedHistory => HistoryDays == int.MaxValue;

        private static readonly Dictionary<string, SongRequestTierLimits> ByTier = new()
        {
            ["free"] = new() { Tier = "free", MaxPlaylists = 3, MaxItemsPerPlaylist = 500, HistoryDays = 30, MaxTemplates = 3, CanHidePromo = false },
            ["supporter"] = new() { Tier = "supporter", MaxPlaylists = 10, MaxItemsPerPlaylist = 1000, HistoryDays = 90, MaxTemplates = 10, CanHidePromo = true },
            ["premium"] = new() { Tier = "premium", MaxPlaylists = 25, MaxItemsPerPlaylist = 2500, HistoryDays = 365, MaxTemplates = 25, CanHidePromo = true },
            ["fundador"] = new() { Tier = "fundador", MaxPlaylists = HardMaxPlaylists, MaxItemsPerPlaylist = 5000, HistoryDays = int.MaxValue, MaxTemplates = HardMaxTemplates, CanHidePromo = true },
        };

        public static SongRequestTierLimits ForTier(string? tier)
        {
            if (tier is "fundador" or "admin") return ByTier["fundador"];
            return ByTier.GetValueOrDefault(tier ?? "free", ByTier["free"]);
        }
    }
}
