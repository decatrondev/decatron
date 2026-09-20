using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.GameOverlays;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// Un adaptador por juego. Traduce la API del proveedor (Riot, FACEIT, manual...)
    /// al modelo normalizado de Decatron.Core.Models.GameOverlays.GameDataModels.
    /// Agregar un juego = implementar esto + registrarlo en Program.cs; el poller,
    /// el overlay, los comandos y el panel no cambian.
    ///
    /// Reglas:
    /// - Nunca lanzar por errores del proveedor: devolver null/lista vacia y loguear.
    ///   El poller conserva el ultimo estado bueno.
    /// - No cachear aca: lo hace GameDataCache arriba, por (provider, external_id, kind).
    /// - IsAvailable = false cuando falta la key/config (ej. TFT hasta que Riot apruebe):
    ///   el juego sigue en el catalogo pero se comporta como manual.
    /// </summary>
    public interface IGameDataProvider
    {
        string Game { get; }
        string Provider { get; }
        ProviderCapabilities Capabilities { get; }

        /// <summary>false = sin credenciales/config todavia. El panel lo muestra como "solo manual".</summary>
        bool IsAvailable { get; }

        /// <summary>Resuelve nombre (+tag, +region) a id externo. null = no existe.</summary>
        Task<(ResolvedAccount? account, string? error)> ResolveAsync(string name, string? tag, string? region, CancellationToken ct = default);

        /// <summary>queue = una de Capabilities.SupportedQueues, o null para la default del proveedor.</summary>
        Task<RankInfo?> GetRankAsync(LinkedGameAccount account, string? queue = null, CancellationToken ct = default);

        /// <summary>Ultimas partidas, mas reciente primero. since = solo desde esa fecha (sesion).</summary>
        Task<IReadOnlyList<MatchSummary>> GetRecentMatchesAsync(LinkedGameAccount account, int count, DateTime? since, string? queue = null, CancellationToken ct = default);

        /// <summary>null si el proveedor no lo soporta.</summary>
        Task<LiveGameInfo?> GetLiveGameAsync(LinkedGameAccount account, CancellationToken ct = default);

        /// <summary>
        /// Promedios de las ultimas partidas, top campeones, racha, maestria. Null si el
        /// proveedor no lo soporta (default). El proveedor decide cuanto cachear.
        /// </summary>
        Task<AccountStats?> GetStatsAsync(LinkedGameAccount account, string? queue = null, CancellationToken ct = default) => Task.FromResult<AccountStats?>(null);
    }
}
