using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;
using Newtonsoft.Json;
using System.Text;
using Decatron.Core.Helpers;

namespace Decatron.Default.Helpers
{
    public static class GameUtils
    {
        /// <summary>
        /// Obtiene la categoría actual del stream desde Twitch API
        /// </summary>
        public static async Task<string?> GetCurrentCategoryAsync(IConfiguration configuration, string twitchId, string accessToken)
        {
            try
            {
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Clear();
                httpClient.DefaultRequestHeaders.Add("Client-ID", configuration["TwitchSettings:ClientId"]);
                httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");

                var response = await httpClient.GetAsync($"https://api.twitch.tv/helix/channels?broadcaster_id={twitchId}");

                if (response.IsSuccessStatusCode)
                {
                    var jsonResponse = await response.Content.ReadAsStringAsync();
                    var channelData = JsonConvert.DeserializeObject<TwitchChannelResponse>(jsonResponse);

                    return channelData?.Data?.FirstOrDefault()?.GameName;
                }

                return null;
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>
        /// Actualiza la categoría del stream via Twitch API
        /// Devuelve el nombre real de la categoría encontrada, o null si falló
        /// </summary>
        public static async Task<string?> UpdateCategoryAsync(IConfiguration configuration, string twitchId, string categoryName, string accessToken, ILogger? logger = null)
        {
            try
            {
                // Primero buscar el game_id
                var gameInfo = await GetGameInfoAsync(configuration, categoryName, accessToken, logger);
                if (gameInfo == null)
                {
                    logger?.LogWarning($"No se pudo encontrar información del juego '{categoryName}' en Twitch API");
                    return null;
                }

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Clear();
                httpClient.DefaultRequestHeaders.Add("Client-ID", configuration["TwitchSettings:ClientId"]);
                httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");

                var updateData = new { game_id = gameInfo.Id };
                var jsonData = JsonConvert.SerializeObject(updateData);
                var content = new StringContent(jsonData, Encoding.UTF8, "application/json");

                var response = await httpClient.PatchAsync($"https://api.twitch.tv/helix/channels?broadcaster_id={twitchId}", content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    logger?.LogError($"Error al actualizar categoría en Twitch API. Status: {response.StatusCode}, Error: {errorContent}");
                    return null;
                }

                // Devolver el nombre REAL del juego que Twitch usó
                return gameInfo.Name;
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, $"Excepción al actualizar categoría '{categoryName}' para broadcaster {twitchId}");
                return null;
            }
        }

        /// <summary>
        /// Obtiene información de un juego desde Twitch API
        /// </summary>
        public static async Task<GameInfo?> GetGameInfoAsync(IConfiguration configuration, string gameName, string accessToken, ILogger? logger = null)
        {
            // BÚSQUEDA HÍBRIDA: Primero game_cache, luego API Twitch
            return await SearchGameHybridAsync(configuration, gameName, accessToken, logger);
        }

        /// <summary>
        /// Búsqueda híbrida: game_cache (rápido) → API Twitch (completo) → guardar en cache
        /// </summary>
        private static async Task<GameInfo?> SearchGameHybridAsync(IConfiguration configuration, string searchTerm, string accessToken, ILogger? logger = null)
        {
            try
            {
                // PASO 1: Buscar en game_cache con fuzzy matching
                logger?.LogInformation($"🔍 Buscando '{searchTerm}' en game_cache...");
                var cachedGame = await SearchGameInCacheAsync(configuration, searchTerm, logger);

                if (cachedGame != null)
                {
                    logger?.LogInformation($"✅ Encontrado en cache: '{cachedGame.Name}' (ID: {cachedGame.Id})");
                    await IncrementGameUsageAsync(configuration, cachedGame.Id, logger);
                    return cachedGame;
                }

                // PASO 2: No encontrado en cache, buscar en API de Twitch
                logger?.LogInformation($"📡 No encontrado en cache, buscando '{searchTerm}' en API Twitch...");
                var apiGame = await SearchGameInTwitchAPIAsync(configuration, searchTerm, accessToken, logger);

                if (apiGame != null)
                {
                    logger?.LogInformation($"✅ Encontrado en API: '{apiGame.Name}' (ID: {apiGame.Id})");

                    // PASO 3: Guardar en cache para futuras búsquedas
                    await SaveGameToCacheAsync(configuration, apiGame, logger);
                    return apiGame;
                }

                logger?.LogWarning($"❌ Juego '{searchTerm}' no encontrado en cache ni en API");
                return null;
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, $"Error en búsqueda híbrida para '{searchTerm}'");
                return null;
            }
        }

        /// <summary>
        /// Busca un juego en game_cache priorizando match EXACTO case-sensitive
        /// </summary>
        private static async Task<GameInfo?> SearchGameInCacheAsync(IConfiguration configuration, string searchTerm, ILogger? logger = null)
        {
            try
            {
                var connectionString = configuration.GetConnectionString("DefaultConnection");
                using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                // Prioridad: 1) Match exacto case-sensitive, 2) case-insensitive, 3) fuzzy
                const string query = @"
                    SELECT game_id, name
                    FROM game_cache
                    WHERE LOWER(name) LIKE LOWER(@searchPattern)
                    ORDER BY
                        -- Prioridad 1: Match EXACTO case-sensitive (PEAK = PEAK)
                        CASE WHEN name = @searchTerm THEN 0 ELSE 1 END,
                        -- Prioridad 2: Match exacto case-insensitive
                        CASE WHEN LOWER(name) = LOWER(@searchTerm) THEN 0 ELSE 1 END,
                        -- Prioridad 3: Empieza con el término
                        CASE WHEN LOWER(name) LIKE LOWER(@searchTerm || '%') THEN 0 ELSE 1 END,
                        -- Prioridad 4: Popularidad
                        usage_count DESC,
                        popularity_rank ASC
                    LIMIT 1";

                using var command = new NpgsqlCommand(query, connection);
                command.Parameters.AddWithValue("@searchTerm", searchTerm);
                command.Parameters.AddWithValue("@searchPattern", $"%{searchTerm}%");

                using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    return new GameInfo
                    {
                        Id = reader.GetString(0),
                        Name = reader.GetString(1)
                    };
                }

                return null;
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, $"Error buscando en game_cache: '{searchTerm}'");
                return null;
            }
        }

        /// <summary>
        /// Busca un juego en la API de Twitch usando /helix/search/categories
        /// Prioriza match EXACTO case-sensitive en los resultados
        /// </summary>
        private static async Task<GameInfo?> SearchGameInTwitchAPIAsync(IConfiguration configuration, string gameName, string accessToken, ILogger? logger = null)
        {
            try
            {
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Clear();
                httpClient.DefaultRequestHeaders.Add("Client-ID", configuration["TwitchSettings:ClientId"]);
                httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");

                var encodedName = Uri.EscapeDataString(gameName);

                // Usar /helix/search/categories que devuelve TODOS los juegos que coinciden
                // Luego buscamos el match exacto case-sensitive en los resultados
                logger?.LogInformation($"🔍 Buscando '{gameName}' en Twitch API...");
                var searchResponse = await httpClient.GetAsync($"https://api.twitch.tv/helix/search/categories?query={encodedName}&first=50");

                if (searchResponse.IsSuccessStatusCode)
                {
                    var searchJson = await searchResponse.Content.ReadAsStringAsync();
                    var searchData = JsonConvert.DeserializeObject<TwitchCategorySearchResponse>(searchJson);

                    if (searchData?.Data != null && searchData.Data.Length > 0)
                    {
                        // Log todos los resultados para debug
                        logger?.LogDebug($"📋 Resultados de búsqueda para '{gameName}': {string.Join(", ", searchData.Data.Take(10).Select(g => $"'{g.Name}'"))}");

                        // PRIORIDAD 1: Buscar match EXACTO case-sensitive
                        var exactMatch = searchData.Data.FirstOrDefault(g => g.Name == gameName);
                        if (exactMatch != null)
                        {
                            logger?.LogInformation($"✅ Match EXACTO encontrado: '{exactMatch.Name}' (ID: {exactMatch.Id})");
                            return new GameInfo
                            {
                                Id = exactMatch.Id,
                                Name = exactMatch.Name
                            };
                        }

                        // PRIORIDAD 2: Buscar match case-insensitive
                        var caseInsensitiveMatch = searchData.Data.FirstOrDefault(g =>
                            string.Equals(g.Name, gameName, StringComparison.OrdinalIgnoreCase));
                        if (caseInsensitiveMatch != null)
                        {
                            logger?.LogInformation($"✅ Match case-insensitive: '{caseInsensitiveMatch.Name}' (buscado: '{gameName}')");
                            return new GameInfo
                            {
                                Id = caseInsensitiveMatch.Id,
                                Name = caseInsensitiveMatch.Name
                            };
                        }

                        // PRIORIDAD 3: Buscar resultado que contenga TODAS las palabras clave
                        // Ejemplo: "Call of Duty Black Ops 4" debe encontrar "Call of Duty: Black Ops 4"
                        var searchWords = gameName.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                            .Where(w => w.Length > 1) // Ignorar palabras de 1 caracter excepto números
                            .Select(w => w.ToLower())
                            .ToList();

                        var allWordsMatch = searchData.Data.FirstOrDefault(g =>
                        {
                            var resultWords = g.Name.ToLower();
                            return searchWords.All(word => resultWords.Contains(word));
                        });

                        if (allWordsMatch != null)
                        {
                            logger?.LogInformation($"✅ Match por palabras clave: '{allWordsMatch.Name}' (buscado: '{gameName}')");
                            return new GameInfo
                            {
                                Id = allWordsMatch.Id,
                                Name = allWordsMatch.Name
                            };
                        }

                        // PRIORIDAD 4: Usar el primer resultado (fuzzy match)
                        var firstResult = searchData.Data.First();
                        logger?.LogInformation($"📋 Usando primer resultado: '{firstResult.Name}' (buscado: '{gameName}')");
                        return new GameInfo
                        {
                            Id = firstResult.Id,
                            Name = firstResult.Name
                        };
                    }
                    else
                    {
                        logger?.LogWarning($"Juego '{gameName}' no encontrado en Twitch API");
                    }
                }
                else
                {
                    var errorContent = await searchResponse.Content.ReadAsStringAsync();
                    logger?.LogError($"Error buscando '{gameName}'. Status: {searchResponse.StatusCode}, Error: {errorContent}");
                }

                return null;
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, $"Excepción al buscar información del juego '{gameName}'");
                return null;
            }
        }

        /// <summary>
        /// Incrementa el contador de uso de un juego en game_cache
        /// </summary>
        private static async Task IncrementGameUsageAsync(IConfiguration configuration, string gameId, ILogger? logger = null)
        {
            try
            {
                var connectionString = configuration.GetConnectionString("DefaultConnection");
                using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                const string query = @"
                    UPDATE game_cache
                    SET usage_count = usage_count + 1,
                        last_updated = @now
                    WHERE game_id = @gameId";

                using var command = new NpgsqlCommand(query, connection);
                command.Parameters.AddWithValue("@gameId", gameId);
                command.Parameters.AddWithValue("@now", DateTime.UtcNow);

                await command.ExecuteNonQueryAsync();
                logger?.LogDebug($"📊 Incrementado usage_count para game_id: {gameId}");
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, $"Error incrementando usage_count para game_id: {gameId}");
            }
        }

        /// <summary>
        /// Guarda un juego en game_cache (si aún no existe)
        /// </summary>
        private static async Task SaveGameToCacheAsync(IConfiguration configuration, GameInfo gameInfo, ILogger? logger = null)
        {
            try
            {
                var connectionString = configuration.GetConnectionString("DefaultConnection");
                using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                const string query = @"
                    INSERT INTO game_cache (game_id, name, popularity_rank, usage_count, last_updated, created_at)
                    VALUES (@gameId, @name, @popularityRank, @usageCount, @now, @now)
                    ON CONFLICT (game_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        last_updated = EXCLUDED.last_updated";

                using var command = new NpgsqlCommand(query, connection);
                command.Parameters.AddWithValue("@gameId", gameInfo.Id);
                command.Parameters.AddWithValue("@name", gameInfo.Name);
                command.Parameters.AddWithValue("@popularityRank", 999); // Baja prioridad para juegos encontrados por API
                command.Parameters.AddWithValue("@usageCount", 1); // Primera vez usado
                command.Parameters.AddWithValue("@now", DateTime.UtcNow);

                await command.ExecuteNonQueryAsync();
                logger?.LogInformation($"💾 Guardado en cache: '{gameInfo.Name}' (ID: {gameInfo.Id})");
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, $"Error guardando en cache: '{gameInfo.Name}'");
            }
        }

        /// <summary>
        /// Valida el nombre de una categoría
        /// </summary>
        public static (bool isValid, string errorMessage) ValidateCategory(string categoryName)
        {
            if (string.IsNullOrWhiteSpace(categoryName))
            {
                return (false, "El nombre de la categoría no puede estar vacío");
            }

            if (categoryName.Length > 255)
            {
                return (false, "El nombre de la categoría es demasiado largo (máximo 255 caracteres)");
            }

            if (categoryName.Trim() != categoryName)
            {
                return (false, "El nombre de la categoría no puede empezar o terminar con espacios");
            }

            return (true, "");
        }

        /// <summary>
        /// Guarda un cambio de categoría en el historial
        /// </summary>
        public static async Task SaveCategoryToHistoryAsync(IConfiguration configuration, string channelLogin, string categoryName, string changedBy)
        {
            try
            {
                var connectionString = configuration.GetConnectionString("DefaultConnection");
                using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                const string query = @"
                    INSERT INTO game_history (channel_login, category_name, changed_by, changed_at)
                    VALUES (@channelLogin, @categoryName, @changedBy, @changedAt)";

                using var command = new NpgsqlCommand(query, connection);
                command.Parameters.AddWithValue("@channelLogin", channelLogin);
                command.Parameters.AddWithValue("@categoryName", categoryName);
                command.Parameters.AddWithValue("@changedBy", changedBy);
                command.Parameters.AddWithValue("@changedAt", DateTime.UtcNow);

                await command.ExecuteNonQueryAsync();
            }
            catch (Exception)
            {
                // Log error pero no fallar el proceso principal
            }
        }

        /// <summary>
        /// Busca una categoría en la base de datos local
        /// </summary>
        public static async Task<string?> SearchCategoryInDatabaseAsync(IConfiguration configuration, string searchTerm)
        {
            try
            {
                var connectionString = configuration.GetConnectionString("DefaultConnection");
                using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                const string query = @"
                    SELECT name
                    FROM categories
                    WHERE 
                        -- Coincidencia por iniciales
                        (
                            SELECT CONCAT(
                                SUBSTRING(SUBSTRING_INDEX(name, ' ', 1), 1, 1),
                                IFNULL(SUBSTRING(SUBSTRING_INDEX(SUBSTRING_INDEX(name, ' ', 2), ' ', -1), 1, 1), ''),
                                IFNULL(SUBSTRING(SUBSTRING_INDEX(SUBSTRING_INDEX(name, ' ', 3), ' ', -1), 1, 1), '')
                            )
                        ) COLLATE utf8mb4_unicode_ci LIKE CONCAT(@searchTerm, '%')
                        OR
                        -- Coincidencia al inicio de cada palabra
                        name COLLATE utf8mb4_unicode_ci LIKE CONCAT(@searchTerm, '%')
                        OR name COLLATE utf8mb4_unicode_ci LIKE CONCAT('% ', @searchTerm, '%')
                        OR
                        -- Coincidencia en cualquier parte del nombre
                        name COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', @searchTerm, '%')
                    ORDER BY 
                        -- Prioridad primero (1 antes que 0)
                        priority DESC,
                        -- Luego por tipo de coincidencia
                        CASE 
                            WHEN (
                                SELECT CONCAT(
                                    SUBSTRING(SUBSTRING_INDEX(name, ' ', 1), 1, 1),
                                    IFNULL(SUBSTRING(SUBSTRING_INDEX(SUBSTRING_INDEX(name, ' ', 2), ' ', -1), 1, 1), ''),
                                    IFNULL(SUBSTRING(SUBSTRING_INDEX(SUBSTRING_INDEX(name, ' ', 3), ' ', -1), 1, 1), '')
                                )
                            ) COLLATE utf8mb4_unicode_ci LIKE CONCAT(@searchTerm, '%') THEN 1
                            WHEN name COLLATE utf8mb4_unicode_ci LIKE CONCAT(@searchTerm, '%') THEN 2
                            WHEN name COLLATE utf8mb4_unicode_ci LIKE CONCAT('% ', @searchTerm, '%') THEN 3
                            ELSE 4
                        END,
                        -- Finalmente por nombre
                        name
                    LIMIT 1";

                using var command = new NpgsqlCommand(query, connection);
                command.Parameters.AddWithValue("@searchTerm", searchTerm);

                var result = await command.ExecuteScalarAsync();
                return result?.ToString();
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>
        /// Verifica si un usuario tiene permisos para cambiar categorías
        /// </summary>
        public static async Task<bool> HasPermissionToChangeCategoryAsync(IConfiguration configuration, string username, string channel, ILogger logger)
        {
            try
            {
                // Verificar si es el propietario del canal (streamer)
                if (string.Equals(username, channel, StringComparison.OrdinalIgnoreCase))
                {
                    logger.LogDebug($"Usuario {username} es el propietario del canal {channel}");
                    return true;
                }

                // Verificar si es moderador del canal via Twitch API
                var isModerator = await IsUserModeratorAsync(configuration, username, channel, logger);
                if (isModerator)
                {
                    logger.LogDebug($"Usuario {username} es moderador en el canal {channel}");
                    return true;
                }

                logger.LogDebug($"Usuario {username} no tiene permisos para cambiar categoría en {channel}");
                return false;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, $"Error verificando permisos de {username} en {channel}");
                return false;
            }
        }

        /// <summary>
        /// Verifica si un usuario es moderador del canal via Twitch API
        /// </summary>
        private static async Task<bool> IsUserModeratorAsync(IConfiguration configuration, string username, string channel, ILogger logger)
        {
            try
            {
                // Obtener información del canal desde la BD (el canal debe estar registrado)
                var channelInfo = await Utils.GetUserInfoFromDatabaseAsync(configuration, channel);
                if (channelInfo == null)
                {
                    logger.LogWarning($"No se encontró información para el canal {channel}");
                    return false;
                }

                // IMPORTANTE: No buscar al usuario en BD porque los moderadores no están registrados
                // En su lugar, obtener el user_id desde la API de Twitch usando el username
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {channelInfo.AccessToken}");
                httpClient.DefaultRequestHeaders.Add("Client-Id", configuration["TwitchSettings:ClientId"]);

                // Paso 1: Obtener el user_id del moderador desde Twitch API
                var userId = await Utils.GetUserId(httpClient, username);
                if (string.IsNullOrEmpty(userId))
                {
                    logger.LogDebug($"No se pudo obtener user_id para {username} desde Twitch API");
                    return false;
                }

                // Paso 2: Verificar si es moderador usando la API de Twitch
                var twitchApiUrl = $"https://api.twitch.tv/helix/moderation/moderators?broadcaster_id={channelInfo.TwitchId}&user_id={userId}";
                var response = await httpClient.GetAsync(twitchApiUrl);

                if (response.IsSuccessStatusCode)
                {
                    var jsonResponse = await response.Content.ReadAsStringAsync();
                    var moderatorData = JsonConvert.DeserializeObject<TwitchModeratorsResponse>(jsonResponse);

                    var isModerator = moderatorData?.Data?.Length > 0;
                    logger.LogDebug($"Verificación de moderador para {username} (userId: {userId}) en {channel}: {isModerator}");
                    return isModerator;
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    logger.LogWarning($"Error consultando API de Twitch para verificar moderador: {response.StatusCode} - {errorContent}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, $"Error verificando si {username} es moderador de {channel}");
                return false;
            }
        }

        /// <summary>
        /// Formatea el mensaje de respuesta para categoría actual
        /// </summary>
        public static string FormatCurrentCategoryMessage(string categoryName)
        {
            return $"La categoría actual del canal es: {categoryName}";
        }

        /// <summary>
        /// Formatea el mensaje de respuesta para categoría cambiada
        /// </summary>
        public static string FormatCategoryChangedMessage(string categoryName, string username)
        {
            return $"¡Categoría del stream cambiada a: {categoryName}!";
        }
    }

    // Clases para deserializar respuestas de Twitch API
    public class TwitchChannelResponse
    {
        public TwitchChannelData[]? Data { get; set; }
    }

    public class TwitchChannelData
    {
        [JsonProperty("broadcaster_id")]
        public string BroadcasterId { get; set; } = "";

        [JsonProperty("broadcaster_login")]
        public string BroadcasterLogin { get; set; } = "";

        [JsonProperty("broadcaster_name")]
        public string BroadcasterName { get; set; } = "";

        [JsonProperty("game_name")]
        public string GameName { get; set; } = "";

        [JsonProperty("game_id")]
        public string GameId { get; set; } = "";

        [JsonProperty("title")]
        public string Title { get; set; } = "";
    }

    public class TwitchGameResponse
    {
        public TwitchGameData[]? Data { get; set; }
    }

    public class TwitchGameData
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
    }

    /// <summary>
    /// Respuesta del endpoint /helix/search/categories
    /// </summary>
    public class TwitchCategorySearchResponse
    {
        public TwitchCategorySearchData[]? Data { get; set; }
    }

    public class TwitchCategorySearchData
    {
        [JsonProperty("id")]
        public string Id { get; set; } = "";

        [JsonProperty("name")]
        public string Name { get; set; } = "";

        [JsonProperty("box_art_url")]
        public string BoxArtUrl { get; set; } = "";
    }

    public class TwitchModeratorsResponse
    {
        public TwitchModeratorData[]? Data { get; set; }
    }

    public class TwitchModeratorData
    {
        [JsonProperty("user_id")]
        public string UserId { get; set; } = "";

        [JsonProperty("user_login")]
        public string UserLogin { get; set; } = "";

        [JsonProperty("user_name")]
        public string UserName { get; set; } = "";
    }

    public class GameInfo
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
    }
}