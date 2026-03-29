using Decatron.Core.Models;
using Decatron.Core.Settings;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace Decatron.Services
{
    /// <summary>
    /// Background service que actualiza el cache de juegos populares cada 24 horas
    /// Obtiene Top 200 juegos de Twitch y los guarda en game_cache
    /// </summary>
    public class GameCacheUpdateService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<GameCacheUpdateService> _logger;
        private readonly TimeSpan _updateInterval = TimeSpan.FromHours(24);

        public GameCacheUpdateService(
            IServiceProvider serviceProvider,
            ILogger<GameCacheUpdateService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🎮 GameCacheUpdateService iniciado");

            // Esperar 5 minutos antes de la primera actualización
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await UpdateGameCacheAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error actualizando cache de juegos");
                }

                // Esperar 24 horas hasta la próxima actualización
                await Task.Delay(_updateInterval, stoppingToken);
            }
        }

        private async Task UpdateGameCacheAsync()
        {
            _logger.LogInformation("====================================================");
            _logger.LogInformation("🔄 ACTUALIZANDO CACHE DE JUEGOS POPULARES");
            _logger.LogInformation("====================================================");

            using (var scope = _serviceProvider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var httpClientFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();
                var twitchSettings = scope.ServiceProvider.GetRequiredService<IOptions<TwitchSettings>>().Value;

                try
                {
                    // Obtener token del bot desde la base de datos
                    var botToken = await context.BotTokens
                        .Where(bt => bt.IsActive)
                        .OrderByDescending(bt => bt.UpdatedAt)
                        .FirstOrDefaultAsync();

                    if (botToken == null || string.IsNullOrEmpty(botToken.AccessToken))
                    {
                        _logger.LogWarning("⚠️ No se encontró token del bot en la BD, saltando actualización de cache");
                        return;
                    }

                    _logger.LogInformation($"🔑 Usando AccessToken del bot: {botToken.BotUsername}");

                    var client = httpClientFactory.CreateClient();
                    client.DefaultRequestHeaders.Add("Client-ID", twitchSettings.ClientId);
                    client.DefaultRequestHeaders.Add("Authorization", $"Bearer {botToken.AccessToken}");

                    var allGames = new List<TwitchTopGame>();
                    string? pagination = null;
                    int pageCount = 0;
                    const int gamesPerPage = 100;
                    const int maxGames = 200;

                    // Obtener Top 200 juegos (2 páginas de 100)
                    while (allGames.Count < maxGames && pageCount < 2)
                    {
                        var url = $"https://api.twitch.tv/helix/games/top?first={gamesPerPage}";
                        if (!string.IsNullOrEmpty(pagination))
                        {
                            url += $"&after={pagination}";
                        }

                        var response = await client.GetAsync(url);

                        if (!response.IsSuccessStatusCode)
                        {
                            var errorContent = await response.Content.ReadAsStringAsync();
                            _logger.LogError($"❌ Error obteniendo top games: {response.StatusCode} - {errorContent}");
                            break;
                        }

                        var content = await response.Content.ReadAsStringAsync();
                        var topGamesResponse = JsonConvert.DeserializeObject<TwitchTopGamesResponse>(content);

                        if (topGamesResponse?.Data == null || !topGamesResponse.Data.Any())
                        {
                            break;
                        }

                        allGames.AddRange(topGamesResponse.Data);
                        pagination = topGamesResponse.Pagination?.Cursor;
                        pageCount++;

                        _logger.LogInformation($"📥 Página {pageCount}: obtenidos {topGamesResponse.Data.Count} juegos");

                        if (string.IsNullOrEmpty(pagination))
                        {
                            break;
                        }
                    }

                    _logger.LogInformation($"📊 Total de juegos obtenidos: {allGames.Count}");

                    // Guardar/actualizar en cache
                    int updatedCount = 0;
                    int newCount = 0;

                    for (int i = 0; i < allGames.Count; i++)
                    {
                        var game = allGames[i];
                        var existingGame = await context.GameCache
                            .FirstOrDefaultAsync(g => g.GameId == game.Id);

                        if (existingGame == null)
                        {
                            var newGame = new GameCache
                            {
                                GameId = game.Id,
                                Name = game.Name,
                                BoxArtUrl = game.BoxArtUrl?.Replace("{width}", "52").Replace("{height}", "72"),
                                PopularityRank = i + 1, // Rank basado en posición en top games
                                UsageCount = 0,
                                LastUpdated = DateTime.UtcNow,
                                CreatedAt = DateTime.UtcNow
                            };

                            context.GameCache.Add(newGame);
                            newCount++;
                        }
                        else
                        {
                            existingGame.Name = game.Name;
                            existingGame.BoxArtUrl = game.BoxArtUrl?.Replace("{width}", "52").Replace("{height}", "72");
                            existingGame.PopularityRank = i + 1;
                            existingGame.LastUpdated = DateTime.UtcNow;
                            updatedCount++;
                        }
                    }

                    await context.SaveChangesAsync();

                    _logger.LogInformation($"✅ Cache actualizado exitosamente");
                    _logger.LogInformation($"   - Nuevos: {newCount}");
                    _logger.LogInformation($"   - Actualizados: {updatedCount}");
                    _logger.LogInformation($"   - Total en cache: {await context.GameCache.CountAsync()}");
                    _logger.LogInformation("====================================================");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Error en UpdateGameCacheAsync");
                }
            }
        }
    }

    /// <summary>
    /// Respuesta de Twitch API para top games
    /// </summary>
    public class TwitchTopGamesResponse
    {
        public List<TwitchTopGame> Data { get; set; } = new();
        public TwitchPagination? Pagination { get; set; }
    }

    public class TwitchTopGame
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";

        [JsonProperty("box_art_url")]
        public string? BoxArtUrl { get; set; }
    }

    public class TwitchPagination
    {
        public string? Cursor { get; set; }
    }
}
