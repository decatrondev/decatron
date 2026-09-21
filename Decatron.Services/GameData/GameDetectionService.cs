using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using Decatron.Core.Models.GameOverlays;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.GameData
{
    /// <summary>
    /// Sabe que juego esta jugando cada canal AHORA. Fuente: la categoria del
    /// stream (Twitch channel.update / Kick livestream.status.updated — se conectan
    /// en el paso 2 de la Fase 1) traducida por game_category_mappings, mas el
    /// override manual (!juego X / panel). Estado en memoria; al arrancar se
    /// rehidrata cuando llega el primer evento o el poller consulta Helix.
    /// </summary>
    public class GameDetectionService
    {
        public class ChannelGameState
        {
            public string? CategoryId { get; set; }
            public string? CategoryName { get; set; }
            /// <summary>Juego interno mapeado desde la categoria, o null si no hay mapeo.</summary>
            public string? DetectedGame { get; set; }
            /// <summary>Override temporal (!juego X). null = seguir la deteccion.</summary>
            public string? OverrideGame { get; set; }
            public DateTime UpdatedAt { get; set; }
        }

        private readonly ConcurrentDictionary<long, ChannelGameState> _byUser = new();
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<GameDetectionService> _logger;

        public event Action<long>? GameChanged;

        public GameDetectionService(IServiceScopeFactory scopeFactory, ILogger<GameDetectionService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public ChannelGameState? Get(long userId) => _byUser.TryGetValue(userId, out var s) ? s : null;

        /// <summary>Llamado por los handlers de plataforma cuando cambia la categoria.</summary>
        public async Task SetCategoryAsync(long userId, string platform, string? categoryId, string? categoryName)
        {
            string? game = null;
            if (!string.IsNullOrEmpty(categoryId))
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                game = await db.GameCategoryMappings.AsNoTracking()
                    .Where(m => m.Platform == platform && m.CategoryId == categoryId)
                    .Select(m => m.Game)
                    .FirstOrDefaultAsync();
            }

            var state = _byUser.GetOrAdd(userId, _ => new ChannelGameState());
            var before = state.DetectedGame;
            state.CategoryId = categoryId;
            state.CategoryName = categoryName;
            state.DetectedGame = game;
            state.UpdatedAt = DateTime.UtcNow;

            if (before != game)
            {
                _logger.LogInformation("🎮 [GameDetection] user {UserId}: categoria '{Category}' -> {Game}", userId, categoryName, game ?? "(sin mapeo)");
                GameChanged?.Invoke(userId);
            }
        }

        /// <summary>!juego X (mod+) o panel. null/"auto" vuelve a la deteccion.</summary>
        public void SetOverride(long userId, string? game)
        {
            var state = _byUser.GetOrAdd(userId, _ => new ChannelGameState());
            var normalized = string.IsNullOrWhiteSpace(game) || game == "auto" ? null : game;
            if (state.OverrideGame == normalized) return;
            state.OverrideGame = normalized;
            state.UpdatedAt = DateTime.UtcNow;
            GameChanged?.Invoke(userId);
        }

        /// <summary>
        /// Juego efectivo para una instancia de overlay, y por que. Prioridad:
        /// detection_mode=manual (forced_game) > override en memoria (!juego) > categoria.
        /// forced_game SOLO cuenta en modo manual: en auto se ignora aunque quede
        /// guardado (bug encontrado 18-09-2026: !rango decia LoL con Just Chatting).
        /// </summary>
        public (string? game, string reason) Resolve(long userId, GameOverlayConfig config)
        {
            if (config.DetectionMode == "manual")
                return (NullIfEmpty(config.ForcedGame), "manual");

            var state = Get(userId);
            if (state?.OverrideGame != null) return (state.OverrideGame, "manual");
            if (state?.DetectedGame != null) return (state.DetectedGame, "category");
            return (null, "idle");
        }

        private static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;
    }
}
