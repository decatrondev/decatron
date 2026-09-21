using System.Collections.Generic;
using System.Linq;
using Decatron.Core.Models.GameOverlays;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// game -> proveedor. Si el juego no tiene proveedor registrado o el que tiene
    /// no esta disponible (sin key), devuelve el ManualProvider — asi los ocho
    /// juegos del catalogo funcionan desde el dia uno, aunque sea a mano.
    /// </summary>
    public class GameDataProviderRegistry
    {
        private readonly Dictionary<string, IGameDataProvider> _byGame;
        private readonly IGameDataProvider _manual;

        public GameDataProviderRegistry(IEnumerable<IGameDataProvider> providers)
        {
            var list = providers.ToList();
            _manual = list.First(p => p.Provider == GameProviders.Manual);
            _byGame = list.Where(p => p.Provider != GameProviders.Manual).ToDictionary(p => p.Game, p => p);
        }

        /// <summary>Proveedor efectivo para una cuenta concreta (respeta provider=manual de la fila).</summary>
        public IGameDataProvider For(LinkedGameAccount account)
        {
            if (account.Provider == GameProviders.Manual) return _manual;
            return ForGame(account.Game);
        }

        /// <summary>Proveedor "real" del juego si existe y esta disponible; si no, manual.</summary>
        public IGameDataProvider ForGame(string game)
        {
            if (_byGame.TryGetValue(game, out var p) && p.IsAvailable) return p;
            return _manual;
        }

        /// <summary>true si el juego tiene API funcionando ahora mismo (para el panel).</summary>
        public bool HasApi(string game) => _byGame.TryGetValue(game, out var p) && p.IsAvailable;

        public IEnumerable<(string game, IGameDataProvider provider)> All() =>
            GameIds.All.Select(g => (g, ForGame(g)));
    }
}
