using Decatron.Core.Models;
using Decatron.Core.Settings;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace Decatron.Services
{
    /// <summary>
    /// Servicio híbrido para búsqueda de juegos de Twitch
    /// 1. Busca primero en aliases (búsqueda instantánea)
    /// 2. Luego en cache local (rápido)
    /// 3. Fallback a Twitch API (si no hay resultados)
    /// 4. Guarda resultados en cache para futuras búsquedas
    /// </summary>
    public class GameSearchService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly DecatronDbContext _context;
        private readonly TwitchSettings _twitchSettings;
        private readonly ILogger<GameSearchService> _logger;

        public GameSearchService(
            IHttpClientFactory httpClientFactory,
            DecatronDbContext context,
            IOptions<TwitchSettings> twitchSettings,
            ILogger<GameSearchService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _context = context;
            _twitchSettings = twitchSettings.Value;
            _logger = logger;
        }

        /// <summary>
        /// Busca juegos usando estrategia híbrida
        /// </summary>
        public async Task<List<GameSearchResult>> SearchGamesAsync(string query, int limit = 10)
        {
            if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
            {
                return new List<GameSearchResult>();
            }

            query = query.Trim();
            _logger.LogInformation($"🔍 Buscando juegos con query: '{query}'");

            try
            {
                var results = new List<GameSearchResult>();

                // PASO 1: Buscar en aliases (más rápido)
                var aliasResults = await SearchInAliasesAsync(query, limit);
                results.AddRange(aliasResults);
                _logger.LogInformation($"📌 Encontrados {aliasResults.Count} resultado(s) en aliases");

                if (results.Count >= limit)
                {
                    return results.Take(limit).ToList();
                }

                // PASO 2: Buscar en cache local
                var cacheResults = await SearchInCacheAsync(query, limit - results.Count);
                results.AddRange(cacheResults);
                _logger.LogInformation($"💾 Encontrados {cacheResults.Count} resultado(s) en cache");

                if (results.Count >= limit)
                {
                    return results.Take(limit).ToList();
                }

                // PASO 3: Fallback a Twitch API
                var apiResults = await SearchInTwitchApiAsync(query, limit - results.Count);
                results.AddRange(apiResults);
                _logger.LogInformation($"🌐 Encontrados {apiResults.Count} resultado(s) en Twitch API");

                // PASO 4: Guardar resultados de API en cache
                if (apiResults.Any())
                {
                    await SaveToCacheAsync(apiResults);
                }

                // Eliminar duplicados (por game_id)
                var uniqueResults = results
                    .GroupBy(r => r.Id)
                    .Select(g => g.First())
                    .Take(limit)
                    .ToList();

                _logger.LogInformation($"✅ Total de {uniqueResults.Count} resultado(s) únicos");
                return uniqueResults;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error searching games with query: {query}");
                return new List<GameSearchResult>();
            }
        }

        /// <summary>
        /// Busca en tabla de aliases
        /// </summary>
        private async Task<List<GameSearchResult>> SearchInAliasesAsync(string query, int limit)
        {
            try
            {
                var queryLower = query.ToLower();

                var aliases = await _context.GameAliases
                    .Where(a => a.Alias.ToLower().Contains(queryLower) ||
                                a.GameName.ToLower().Contains(queryLower))
                    .OrderBy(a => a.Alias.Length) // Prioriza matches más cortos
                    .Take(limit)
                    .ToListAsync();

                return aliases.Select(a => new GameSearchResult
                {
                    Id = a.GameId,
                    Name = a.GameName,
                    BoxArtUrl = null, // Se puede hacer join con GameCache si se necesita
                    Source = "alias"
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching in aliases");
                return new List<GameSearchResult>();
            }
        }

        /// <summary>
        /// Busca en cache local
        /// </summary>
        private async Task<List<GameSearchResult>> SearchInCacheAsync(string query, int limit)
        {
            try
            {
                var queryLower = query.ToLower();

                var games = await _context.GameCache
                    .Where(g => g.Name.ToLower().Contains(queryLower))
                    .OrderByDescending(g => g.UsageCount) // Prioriza juegos más usados
                    .ThenBy(g => g.PopularityRank)
                    .Take(limit)
                    .ToListAsync();

                return games.Select(g => new GameSearchResult
                {
                    Id = g.GameId,
                    Name = g.Name,
                    BoxArtUrl = g.BoxArtUrl,
                    Source = "cache"
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching in cache");
                return new List<GameSearchResult>();
            }
        }

        /// <summary>
        /// Busca en Twitch API como último recurso
        /// </summary>
        private async Task<List<GameSearchResult>> SearchInTwitchApiAsync(string query, int limit)
        {
            try
            {
                // Obtener token del bot desde la base de datos
                var botToken = await _context.BotTokens
                    .Where(bt => bt.IsActive)
                    .OrderByDescending(bt => bt.UpdatedAt)
                    .FirstOrDefaultAsync();

                if (botToken == null || string.IsNullOrEmpty(botToken.AccessToken))
                {
                    _logger.LogWarning("No se encontró token del bot en BD para búsqueda en API");
                    return new List<GameSearchResult>();
                }

                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Add("Client-ID", _twitchSettings.ClientId);
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {botToken.AccessToken}");

                var url = $"https://api.twitch.tv/helix/search/categories?query={Uri.EscapeDataString(query)}&first={limit}";
                var response = await client.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"Twitch API error: {response.StatusCode} - {errorContent}");
                    return new List<GameSearchResult>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var searchResponse = JsonConvert.DeserializeObject<TwitchSearchCategoriesResponse>(content);

                if (searchResponse?.Data == null || !searchResponse.Data.Any())
                {
                    return new List<GameSearchResult>();
                }

                return searchResponse.Data.Select(g => new GameSearchResult
                {
                    Id = g.Id,
                    Name = g.Name,
                    BoxArtUrl = g.BoxArtUrl?.Replace("{width}", "52").Replace("{height}", "72"),
                    Source = "api"
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching in Twitch API");
                return new List<GameSearchResult>();
            }
        }

        /// <summary>
        /// Guarda resultados de API en cache para futuras búsquedas
        /// </summary>
        private async Task SaveToCacheAsync(List<GameSearchResult> results)
        {
            try
            {
                foreach (var result in results)
                {
                    var existingGame = await _context.GameCache
                        .FirstOrDefaultAsync(g => g.GameId == result.Id);

                    if (existingGame == null)
                    {
                        var newGame = new GameCache
                        {
                            GameId = result.Id,
                            Name = result.Name,
                            BoxArtUrl = result.BoxArtUrl,
                            PopularityRank = 9999, // Se actualizará con el background service
                            UsageCount = 0,
                            LastUpdated = DateTime.UtcNow,
                            CreatedAt = DateTime.UtcNow
                        };

                        _context.GameCache.Add(newGame);
                    }
                    else
                    {
                        // Actualizar datos si cambió
                        existingGame.Name = result.Name;
                        existingGame.BoxArtUrl = result.BoxArtUrl;
                        existingGame.LastUpdated = DateTime.UtcNow;
                    }
                }

                await _context.SaveChangesAsync();
                _logger.LogInformation($"💾 Guardados {results.Count} juego(s) en cache");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving games to cache");
            }
        }

        /// <summary>
        /// Incrementa el contador de uso cuando se crea un micro comando con este juego
        /// </summary>
        public async Task IncrementUsageCountAsync(string gameName)
        {
            try
            {
                var game = await _context.GameCache
                    .FirstOrDefaultAsync(g => g.Name.ToLower() == gameName.ToLower());

                if (game != null)
                {
                    game.UsageCount++;
                    game.LastUpdated = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    _logger.LogInformation($"📈 Incrementado UsageCount para {gameName}: {game.UsageCount}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error incrementing usage count for {gameName}");
            }
        }
    }

    /// <summary>
    /// Resultado de búsqueda de juego
    /// </summary>
    public class GameSearchResult
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string? BoxArtUrl { get; set; }
        public string Source { get; set; } = ""; // "alias", "cache", o "api"
    }

    /// <summary>
    /// Respuesta de Twitch API para búsqueda de categorías
    /// </summary>
    public class TwitchSearchCategoriesResponse
    {
        public List<TwitchCategoryData> Data { get; set; } = new();
    }

    public class TwitchCategoryData
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";

        [JsonProperty("box_art_url")]
        public string? BoxArtUrl { get; set; }
    }
}
