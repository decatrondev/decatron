using Decatron.Core.Models.GameOverlays;
using Microsoft.Extensions.Configuration;

namespace Decatron.Services.GameData.Riot
{
    /// <summary>
    /// Resuelve que key de Riot usar para cada juego de la plataforma (overlays y
    /// vinculacion de cuentas en Settings). Riot obliga a registrar un producto
    /// por juego, y cada registro da una key con scope propio — probado el
    /// 18-09-2026: la key 736779 (RiotApi:PlatformApiKey) responde 200 a lol/* y
    /// 403 a tft/* y val/*. Por eso hay una entrada de config por juego:
    ///
    ///   RiotApi:PlatformApiKey  -> lol       (aprobada)
    ///   RiotApi:TftApiKey       -> tft       (registro enviado 18-09-2026, pendiente)
    ///   RiotApi:ValorantApiKey  -> valorant  (se pide cuando exista la demo publica)
    ///
    /// Las keys por canal-tenant de Torneos (TournamentRiotConfig) NO pasan por
    /// aca: son de scope distinto y viven en la base, no en config.
    /// </summary>
    public class RiotApiKeys
    {
        private readonly IConfiguration _configuration;

        public RiotApiKeys(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        /// <summary>Key para el juego dado, o null si todavia no hay una aprobada.</summary>
        public string? ForGame(string game) => game switch
        {
            GameIds.Lol => Nullable(_configuration["RiotApi:PlatformApiKey"]),
            GameIds.Tft => Nullable(_configuration["RiotApi:TftApiKey"]),
            GameIds.Valorant => Nullable(_configuration["RiotApi:ValorantApiKey"]),
            _ => null,
        };

        public bool HasKeyFor(string game) => ForGame(game) != null;

        private static string? Nullable(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;
    }
}
