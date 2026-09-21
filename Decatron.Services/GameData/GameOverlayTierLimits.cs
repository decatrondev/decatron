using System;
using System.Collections.Generic;
using System.Linq;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// Limites por tier del modulo Game Overlays — mismo patron que
    /// NowPlayingService.TierLimits. Decision de producto (plan §6): TODO lo visual,
    /// la deteccion de juego, los comandos y el catalogo completo son free; lo que
    /// escala por tier es cantidad (cuentas, instancias, partidas, historico) y
    /// frescura (refresco, rotacion avanzada).
    /// </summary>
    public class GameOverlayTierLimits
    {
        public int MaxAccountsPerGame { get; init; }
        /// <summary>int.MaxValue = ilimitado (fundador/admin), con tope tecnico aparte.</summary>
        public int MaxInstances { get; init; }
        public string[] AllowedRotationModes { get; init; } = Array.Empty<string>();
        public int PollingIntervalSeconds { get; init; }
        public int MaxRecentMatches { get; init; }
        /// <summary>0 = solo la sesion actual; int.MaxValue = ilimitado.</summary>
        public int SessionHistoryDays { get; init; }
        /// <summary>
        /// false = la tarjeta de Decatron (publicidad del bot) se muestra si o si en el overlay.
        /// Es lo que paga el tier gratis: cada stream promociona el bot. Los tiers de pago pueden apagarla.
        /// </summary>
        public bool CanHidePromo { get; init; }
        /// <summary>
        /// Llamadas a la IA del coach de LoL por día (UTC). Cada selección de campeón gasta
        /// hasta 8, más briefing/lobby/post-partida. int.MaxValue = ilimitado. La voz va aparte (créditos TTS).
        /// </summary>
        public int MaxCoachCallsPerDay { get; init; }

        public const int HardMaxAccountsPerGame = 10;

        public bool AllowsRotation(string mode) => AllowedRotationModes.Contains(mode);

        private static readonly Dictionary<string, GameOverlayTierLimits> ByTier = new()
        {
            ["free"] = new()
            {
                MaxAccountsPerGame = 1, MaxInstances = 1,
                AllowedRotationModes = new[] { "none" },
                PollingIntervalSeconds = 180, MaxRecentMatches = 5, SessionHistoryDays = 0, CanHidePromo = false, MaxCoachCallsPerDay = 60,
            },
            ["supporter"] = new()
            {
                MaxAccountsPerGame = 3, MaxInstances = 2,
                AllowedRotationModes = new[] { "none", "interval" },
                PollingIntervalSeconds = 120, MaxRecentMatches = 10, SessionHistoryDays = 30, CanHidePromo = true, MaxCoachCallsPerDay = 250,
            },
            ["premium"] = new()
            {
                MaxAccountsPerGame = 5, MaxInstances = 4,
                AllowedRotationModes = new[] { "none", "interval", "active_first" },
                PollingIntervalSeconds = 60, MaxRecentMatches = 20, SessionHistoryDays = 365, CanHidePromo = true, MaxCoachCallsPerDay = 800,
            },
            ["fundador"] = new()
            {
                MaxAccountsPerGame = HardMaxAccountsPerGame, MaxInstances = int.MaxValue,
                AllowedRotationModes = new[] { "none", "interval", "active_first" },
                PollingIntervalSeconds = 60, MaxRecentMatches = 20, SessionHistoryDays = int.MaxValue, CanHidePromo = true, MaxCoachCallsPerDay = int.MaxValue,
            },
        };

        public static GameOverlayTierLimits ForTier(string? tier)
        {
            if (tier is "fundador" or "admin") return ByTier["fundador"];
            return ByTier.GetValueOrDefault(tier ?? "free", ByTier["free"]);
        }
    }
}
