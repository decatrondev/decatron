using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using Decatron.Core.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Decatron.Services
{
    public class TwitchApiService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<TwitchApiService> _logger;
        private readonly TwitchSettings _twitchSettings;
        private readonly IConfiguration _configuration;
        private const string TwitchApiBaseUrl = "https://api.twitch.tv/helix";
        private string? _appAccessToken = null;

        public TwitchApiService(
            HttpClient httpClient,
            ILogger<TwitchApiService> logger,
            IOptions<TwitchSettings> twitchSettings,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _logger = logger;
            _twitchSettings = twitchSettings.Value;
            _configuration = configuration;
        }

        /// <summary>
        /// Clears the cached App Access Token so the next API call fetches a fresh one.
        /// </summary>
        public void InvalidateAppAccessToken()
        {
            _appAccessToken = null;
            _logger.LogInformation("App Access Token cache invalidated");
        }

        /// <summary>
        /// Obtiene un App Access Token para consultas públicas
        /// </summary>
        private async Task<string?> GetAppAccessTokenAsync()
        {
            if (!string.IsNullOrEmpty(_appAccessToken))
                return _appAccessToken;

            try
            {
                var response = await Core.Helpers.TwitchAuthHelper.PostWithFallbackAsync(
                    _httpClient,
                    $"/oauth2/token?client_id={_twitchSettings.ClientId}&client_secret={_twitchSettings.ClientSecret}&grant_type=client_credentials",
                    new StringContent(""),
                    _logger);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Error obtaining App Access Token: {StatusCode}", response.StatusCode);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<JsonElement>(json);

                if (result.TryGetProperty("access_token", out var token))
                {
                    _appAccessToken = token.GetString();
                    _logger.LogInformation("App Access Token obtained successfully");
                    return _appAccessToken;
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obtaining App Access Token");
                return null;
            }
        }

        /// <summary>
        /// Sends a Twitch API request using the App Access Token.
        /// On 401, invalidates the cached token and retries once with a fresh token.
        /// </summary>
        private async Task<HttpResponseMessage> SendWithAppTokenAsync(HttpRequestMessage requestFactory, bool isRetry = false)
        {
            var token = await GetAppAccessTokenAsync();
            if (string.IsNullOrEmpty(token))
                return new HttpResponseMessage(System.Net.HttpStatusCode.Unauthorized);

            requestFactory.Headers.Remove("Authorization");
            requestFactory.Headers.Remove("Client-ID");
            requestFactory.Headers.Add("Client-ID", _twitchSettings.ClientId);
            requestFactory.Headers.Add("Authorization", $"Bearer {token}");

            var response = await _httpClient.SendAsync(requestFactory);

            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized && !isRetry)
            {
                _logger.LogWarning("Twitch API returned 401, invalidating App Access Token and retrying");
                InvalidateAppAccessToken();

                // Rebuild the request (HttpRequestMessage can only be sent once)
                var retryRequest = await CloneRequestAsync(requestFactory);
                return await SendWithAppTokenAsync(retryRequest, isRetry: true);
            }

            return response;
        }

        private static async Task<HttpRequestMessage> CloneRequestAsync(HttpRequestMessage original)
        {
            var clone = new HttpRequestMessage(original.Method, original.RequestUri);
            if (original.Content != null)
            {
                var content = await original.Content.ReadAsByteArrayAsync();
                clone.Content = new ByteArrayContent(content);
                foreach (var header in original.Content.Headers)
                    clone.Content.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }
            // Don't copy auth headers - SendWithAppTokenAsync will set them
            return clone;
        }

        /// <summary>
        /// Obtiene el User Access Token de un broadcaster desde la base de datos
        /// </summary>
        private async Task<string?> GetUserAccessTokenAsync(string broadcasterId)
        {
            try
            {
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                using var connection = new Npgsql.NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                const string query = @"
                    SELECT access_token, token_expiration
                    FROM users
                    WHERE twitch_id = @twitchId
                    LIMIT 1";

                using var command = new Npgsql.NpgsqlCommand(query, connection);
                command.Parameters.AddWithValue("twitchId", broadcasterId);

                using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    var rawToken = reader.GetString(0);
                    var tokenExpiration = reader.GetDateTime(1);

                    // Decrypt token if encrypted (EF Value Converter encrypts on write)
                    var accessToken = Decatron.Data.Encryption.TokenEncryption.Decrypt(rawToken,
                        _configuration["JwtSettings:SecretKey"] ?? "");

                    // Reject fully expired tokens
                    if (tokenExpiration < DateTime.UtcNow)
                    {
                        _logger.LogWarning("User Access Token for broadcaster {BroadcasterId} is expired", broadcasterId);
                        return null;
                    }

                    if (tokenExpiration < DateTime.UtcNow.AddHours(1))
                    {
                        _logger.LogWarning("User Access Token for broadcaster {BroadcasterId} expires soon", broadcasterId);
                    }

                    return accessToken;
                }

                _logger.LogError("No User Access Token found for broadcaster {BroadcasterId}", broadcasterId);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obtaining User Access Token for broadcaster {BroadcasterId}", broadcasterId);
                return null;
            }
        }

        /// <summary>
        /// Obtiene información de un usuario por login (usa App Access Token)
        /// </summary>
        public async Task<TwitchUserData?> GetUserByLoginAsync(string login)
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, $"{TwitchApiBaseUrl}/users?login={login}");
                var response = await SendWithAppTokenAsync(request);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Error in GetUserByLoginAsync ({StatusCode}): {Error}", response.StatusCode, error);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<TwitchApiResponse<TwitchUserData>>(json);

                return result?.data?.FirstOrDefault();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetUserByLoginAsync: {Login}", login);
                return null;
            }
        }

        /// <summary>
        /// Fecha de creación de una cuenta de Twitch por su id (usa App Access Token)
        /// </summary>
        public async Task<DateTime?> GetUserCreatedAtAsync(string userId)
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, $"{TwitchApiBaseUrl}/users?id={userId}");
                var response = await SendWithAppTokenAsync(request);
                if (!response.IsSuccessStatusCode)
                    return null;

                var result = JsonSerializer.Deserialize<TwitchApiResponse<TwitchUserData>>(await response.Content.ReadAsStringAsync());
                var createdAt = result?.data?.FirstOrDefault()?.created_at;
                return DateTime.TryParse(createdAt, null, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var date)
                    ? date
                    : null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetUserCreatedAtAsync: {UserId}", userId);
                return null;
            }
        }

        /// <summary>
        /// Llamada a Helix como moderador (el bot) en el canal: agrega broadcaster_id y moderator_id a la URL.
        /// </summary>
        private async Task<HttpResponseMessage?> SendAsBotModeratorAsync(HttpMethod method, string channelName, string path, object? body, string extraQuery = "")
        {
            var broadcasterUser = await GetUserByLoginAsync(channelName);
            var botTwitchId = await GetBotTwitchIdAsync();
            var accessToken = await GetBotUserAccessTokenAsync();
            if (broadcasterUser == null || string.IsNullOrEmpty(botTwitchId) || string.IsNullOrEmpty(accessToken))
            {
                _logger.LogWarning("No se pudo preparar la llamada de moderador en {ChannelName} ({Path})", channelName, path);
                return null;
            }

            var request = new HttpRequestMessage(method, $"{TwitchApiBaseUrl}/{path}?broadcaster_id={broadcasterUser.id}&moderator_id={botTwitchId}{extraQuery}");
            if (body != null)
                request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            request.Headers.Add("Client-ID", _twitchSettings.ClientId);
            request.Headers.Add("Authorization", $"Bearer {accessToken}");
            return await _httpClient.SendAsync(request);
        }

        /// <summary>
        /// Configuración actual del chat (modos solo seguidores, emotes, subs, lento...). null si falla.
        /// </summary>
        public async Task<JsonElement?> GetChatSettingsAsync(string channelName)
        {
            try
            {
                var response = await SendAsBotModeratorAsync(HttpMethod.Get, channelName, "chat/settings", null);
                if (response == null || !response.IsSuccessStatusCode)
                    return null;

                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                return doc.RootElement.GetProperty("data")[0].Clone();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetChatSettingsAsync: {ChannelName}", channelName);
                return null;
            }
        }

        /// <summary>
        /// Cambia modos del chat. Solo se mandan los campos a cambiar (emote_mode, follower_mode, ...).
        /// </summary>
        public async Task<bool> UpdateChatSettingsAsync(string channelName, Dictionary<string, object?> changes)
        {
            try
            {
                var response = await SendAsBotModeratorAsync(HttpMethod.Patch, channelName, "chat/settings", changes);
                if (response == null) return false;
                if (!response.IsSuccessStatusCode)
                    _logger.LogWarning("Error cambiando el chat de {ChannelName}: {Status} {Body}", channelName, response.StatusCode, await response.Content.ReadAsStringAsync());
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UpdateChatSettingsAsync: {ChannelName}", channelName);
                return false;
            }
        }

        /// <summary>
        /// Quita un ban o un timeout. true si se quitó, false si no estaba sancionado, null si falló.
        /// </summary>
        public async Task<bool?> UnbanUserAsync(string channelName, string username)
        {
            try
            {
                var target = await GetUserByLoginAsync(username);
                if (target == null) return null;

                var response = await SendAsBotModeratorAsync(HttpMethod.Delete, channelName, "moderation/bans", null, $"&user_id={target.id}");
                if (response == null) return null;
                if (response.IsSuccessStatusCode) return true;

                // Twitch responde 400 "user is not banned" cuando el timeout ya venció
                var body = await response.Content.ReadAsStringAsync();
                if (response.StatusCode == System.Net.HttpStatusCode.BadRequest && body.Contains("not banned", StringComparison.OrdinalIgnoreCase))
                    return false;

                _logger.LogWarning("Error quitando la sanción de {Username} en {ChannelName}: {Status} {Body}", username, channelName, response.StatusCode, body);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UnbanUserAsync: {Username} in {ChannelName}", username, channelName);
                return null;
            }
        }

        /// <summary>
        /// Activa o desactiva el Shield Mode de Twitch en el canal
        /// </summary>
        public async Task<bool> SetShieldModeAsync(string channelName, bool active)
        {
            try
            {
                var response = await SendAsBotModeratorAsync(HttpMethod.Put, channelName, "moderation/shield_mode", new { is_active = active });
                if (response == null) return false;
                if (!response.IsSuccessStatusCode)
                    _logger.LogWarning("Error con el Shield Mode de {ChannelName}: {Status} {Body}", channelName, response.StatusCode, await response.Content.ReadAsStringAsync());
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SetShieldModeAsync: {ChannelName}", channelName);
                return false;
            }
        }

        /// <summary>
        /// Obtiene los clips más recientes de un usuario (usa App Access Token)
        /// </summary>
        public async Task<List<TwitchClipData>> GetClipsAsync(string broadcasterId, int first = 1)
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get,
                    $"{TwitchApiBaseUrl}/clips?broadcaster_id={broadcasterId}&first={first}");
                var response = await SendWithAppTokenAsync(request);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Error in GetClipsAsync ({StatusCode}): {Error}", response.StatusCode, error);
                    return new List<TwitchClipData>();
                }

                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<TwitchApiResponse<TwitchClipData>>(json);

                return result?.data ?? new List<TwitchClipData>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetClipsAsync: {BroadcasterId}", broadcasterId);
                return new List<TwitchClipData>();
            }
        }

        /// <summary>
        /// Obtiene el canal actual (stream) para saber qué juego está jugando (usa App Access Token)
        /// </summary>
        public async Task<TwitchChannelData?> GetChannelAsync(string broadcasterId)
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get,
                    $"{TwitchApiBaseUrl}/channels?broadcaster_id={broadcasterId}");
                var response = await SendWithAppTokenAsync(request);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Error in GetChannelAsync ({StatusCode}): {Error}", response.StatusCode, error);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<TwitchApiResponse<TwitchChannelData>>(json);

                return result?.data?.FirstOrDefault();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetChannelAsync: {BroadcasterId}", broadcasterId);
                return null;
            }
        }

        /// <summary>
        /// Verifica si un canal está en vivo (usa App Access Token)
        /// </summary>
        public async Task<TwitchStreamData?> GetStreamAsync(string userId)
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get,
                    $"{TwitchApiBaseUrl}/streams?user_id={userId}");
                var response = await SendWithAppTokenAsync(request);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Error in GetStreamAsync ({StatusCode}): {Error}", response.StatusCode, error);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<TwitchApiResponse<TwitchStreamData>>(json);

                return result?.data?.FirstOrDefault();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetStreamAsync: {UserId}", userId);
                return null;
            }
        }

        /// <summary>
        /// Obtiene toda la información necesaria para un shoutout
        /// </summary>
        public async Task<ShoutoutData?> GetShoutoutDataAsync(string targetUsername)
        {
            try
            {
                // 1. Obtener info del usuario
                var user = await GetUserByLoginAsync(targetUsername);
                if (user == null)
                {
                    _logger.LogWarning("User not found: {TargetUsername}", targetUsername);
                    return null;
                }

                // 2. Obtener canal para saber el juego
                var channel = await GetChannelAsync(user.id);

                // 3. Obtener varios clips y seleccionar uno aleatorio
                var clips = await GetClipsAsync(user.id, 20); // Obtener 20 clips en lugar de 1
                TwitchClipData? clip = null;

                if (clips.Any())
                {
                    // Seleccionar clip aleatorio
                    var random = new Random();
                    var randomIndex = random.Next(clips.Count);
                    clip = clips[randomIndex];
                    _logger.LogInformation("Random clip selected: {Index}/{Total} - {ClipTitle}", randomIndex + 1, clips.Count, clip.title);
                }

                return new ShoutoutData
                {
                    UserId = user.id,
                    Username = user.login,
                    DisplayName = user.display_name,
                    ProfileImageUrl = user.profile_image_url,
                    GameName = channel?.game_name ?? "Sin categoría",
                    ClipUrl = clip?.url,
                    ClipId = clip?.id
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetShoutoutDataAsync: {TargetUsername}", targetUsername);
                return null;
            }
        }

        /// <summary>
        /// Obtiene el User Access Token del bot desde la BD (necesario para moderation)
        /// </summary>
        private async Task<string?> GetBotUserAccessTokenAsync()
        {
            try
            {
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                // chat_token es el User Access Token real (con scopes de moderación,
                // ej. channel:manage:moderators) — access_token es un App Access Token
                // sin usuario asociado que se renueva aparte vía client_credentials
                // (RefreshAppAccessTokenAsync) y no sirve para endpoints de moderación.
                const string query = "SELECT chat_token FROM bot_tokens WHERE bot_username = @botUsername AND is_active = true LIMIT 1";

                using var command = new NpgsqlCommand(query, connection);
                command.Parameters.AddWithValue("@botUsername", _twitchSettings.BotUsername);

                var result = await command.ExecuteScalarAsync();
                if (result != null)
                {
                    var rawToken = result.ToString()!;
                    // Decrypt if encrypted
                    var token = Decatron.Data.Encryption.TokenEncryption.Decrypt(rawToken,
                        _configuration["JwtSettings:SecretKey"] ?? "");
                    return token.StartsWith("oauth:") ? token.Substring(6) : token;
                }

                _logger.LogWarning("Access token del bot no encontrado en BD");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo access token del bot");
                return null;
            }
        }

        /// <summary>
        /// Obtiene el Twitch ID del bot desde la BD
        /// </summary>
        private async Task<string?> GetBotTwitchIdAsync()
        {
            try
            {
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync();

                const string query = "SELECT bot_twitch_id FROM bot_tokens WHERE bot_username = @botUsername AND is_active = true LIMIT 1";

                using var command = new NpgsqlCommand(query, connection);
                command.Parameters.AddWithValue("@botUsername", _twitchSettings.BotUsername);

                var result = await command.ExecuteScalarAsync();
                if (result != null)
                {
                    return result.ToString();
                }

                _logger.LogWarning("bot_twitch_id not found for bot: {BotUsername}", _twitchSettings.BotUsername);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo bot_twitch_id del bot");
                return null;
            }
        }

        /// <summary>
        /// Timeout a un usuario (requiere que el bot sea moderador)
        /// </summary>
        public async Task<bool> TimeoutUserAsync(string channelName, string username, int durationSeconds, string reason = "Violación de normas del chat")
        {
            try
            {
                // Obtener broadcaster_id del canal
                var broadcasterUser = await GetUserByLoginAsync(channelName);
                if (broadcasterUser == null)
                {
                    _logger.LogWarning("Could not get broadcaster for channel: {ChannelName}", channelName);
                    return false;
                }

                // Obtener user_id del usuario a moderar
                var targetUser = await GetUserByLoginAsync(username);
                if (targetUser == null)
                {
                    _logger.LogWarning("Could not get user: {Username}", username);
                    return false;
                }

                // Obtener bot_twitch_id (moderator_id)
                var botTwitchId = await GetBotTwitchIdAsync();
                if (string.IsNullOrEmpty(botTwitchId))
                {
                    _logger.LogWarning("Could not get bot_twitch_id");
                    return false;
                }

                // Obtener User Access Token del bot
                var accessToken = await GetBotUserAccessTokenAsync();
                if (string.IsNullOrEmpty(accessToken))
                {
                    _logger.LogWarning("Could not get bot access token");
                    return false;
                }

                // Crear payload
                var payload = new
                {
                    data = new
                    {
                        user_id = targetUser.id,
                        duration = durationSeconds,
                        reason = reason
                    }
                };

                var jsonContent = JsonSerializer.Serialize(payload);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                // Crear request
                var request = new HttpRequestMessage(HttpMethod.Post,
                    $"{TwitchApiBaseUrl}/moderation/bans?broadcaster_id={broadcasterUser.id}&moderator_id={botTwitchId}")
                {
                    Content = content
                };

                request.Headers.Add("Client-ID", _twitchSettings.ClientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                // Enviar request
                var response = await _httpClient.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Timeout applied: {Username} in {ChannelName} for {Duration}s - {Reason}", username, channelName, durationSeconds, reason);
                    return true;
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Error applying timeout in [{ChannelName}] to {Username}: {StatusCode} - {ErrorContent}", channelName, username, response.StatusCode, errorContent);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in TimeoutUserAsync: {Username} in {ChannelName}", username, channelName);
                return false;
            }
        }

        /// <summary>
        /// Ban permanente a un usuario (requiere que el bot sea moderador)
        /// </summary>
        public async Task<bool> BanUserAsync(string channelName, string username, string reason = "Violación grave de normas del chat")
        {
            try
            {
                // Obtener broadcaster_id del canal
                var broadcasterUser = await GetUserByLoginAsync(channelName);
                if (broadcasterUser == null)
                {
                    _logger.LogWarning("Could not get broadcaster for channel: {ChannelName}", channelName);
                    return false;
                }

                // Obtener user_id del usuario a moderar
                var targetUser = await GetUserByLoginAsync(username);
                if (targetUser == null)
                {
                    _logger.LogWarning("Could not get user: {Username}", username);
                    return false;
                }

                // Obtener bot_twitch_id (moderator_id)
                var botTwitchId = await GetBotTwitchIdAsync();
                if (string.IsNullOrEmpty(botTwitchId))
                {
                    _logger.LogWarning("Could not get bot_twitch_id");
                    return false;
                }

                // Obtener User Access Token del bot
                var accessToken = await GetBotUserAccessTokenAsync();
                if (string.IsNullOrEmpty(accessToken))
                {
                    _logger.LogWarning("Could not get bot access token");
                    return false;
                }

                // Crear payload (sin duration = ban permanente)
                var payload = new
                {
                    data = new
                    {
                        user_id = targetUser.id,
                        reason = reason
                    }
                };

                var jsonContent = JsonSerializer.Serialize(payload);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                // Crear request
                var request = new HttpRequestMessage(HttpMethod.Post,
                    $"{TwitchApiBaseUrl}/moderation/bans?broadcaster_id={broadcasterUser.id}&moderator_id={botTwitchId}")
                {
                    Content = content
                };

                request.Headers.Add("Client-ID", _twitchSettings.ClientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                // Enviar request
                var response = await _httpClient.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Permanent ban applied: {Username} in {ChannelName} - {Reason}", username, channelName, reason);
                    return true;
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Error applying ban in [{ChannelName}] to {Username}: {StatusCode} - {ErrorContent}", channelName, username, response.StatusCode, errorContent);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in BanUserAsync: {Username} in {ChannelName}", username, channelName);
                return false;
            }
        }

        /// <summary>
        /// Quita el status de moderador a un usuario. Necesario antes de poder aplicar
        /// timeout a alguien que ya es mod — Twitch rechaza el endpoint de bans/timeouts
        /// contra un moderador. IMPORTANTE: el endpoint moderation/moderators de Twitch
        /// SOLO acepta el token del propio broadcaster — a diferencia de bans/timeouts,
        /// ni el bot ni ningún otro moderador pueden llamarlo aunque tengan el scope
        /// channel:manage:moderators, ni por API ni con /mod - /unmod en el chat. Por
        /// eso acá se usa GetUserAccessTokenAsync (token del streamer), no el del bot.
        /// </summary>
        public async Task<bool> RemoveModeratorAsync(string channelName, string username)
        {
            try
            {
                var broadcasterUser = await GetUserByLoginAsync(channelName);
                if (broadcasterUser == null)
                {
                    _logger.LogWarning("Could not get broadcaster for channel: {ChannelName}", channelName);
                    return false;
                }

                var targetUser = await GetUserByLoginAsync(username);
                if (targetUser == null)
                {
                    _logger.LogWarning("Could not get user: {Username}", username);
                    return false;
                }

                var accessToken = await GetUserAccessTokenAsync(broadcasterUser.id);
                if (string.IsNullOrEmpty(accessToken))
                {
                    _logger.LogWarning("Could not get broadcaster access token for channel: {ChannelName}", channelName);
                    return false;
                }

                var request = new HttpRequestMessage(HttpMethod.Delete,
                    $"{TwitchApiBaseUrl}/moderation/moderators?broadcaster_id={broadcasterUser.id}&user_id={targetUser.id}");

                request.Headers.Add("Client-ID", _twitchSettings.ClientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                var response = await _httpClient.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Moderator removed: {Username} in {ChannelName}", username, channelName);
                    return true;
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Error removing moderator in [{ChannelName}] for {Username}: {StatusCode} - {ErrorContent}", channelName, username, response.StatusCode, errorContent);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in RemoveModeratorAsync: {Username} in {ChannelName}", username, channelName);
                return false;
            }
        }

        /// <summary>
        /// Agrega el status de moderador a un usuario. Usado para restaurar el mod tras
        /// un timeout de !ruleta contra un moderador. Igual que RemoveModeratorAsync,
        /// requiere el token del broadcaster — el bot no puede llamar este endpoint.
        /// </summary>
        public async Task<bool> AddModeratorAsync(string channelName, string username)
        {
            try
            {
                var broadcasterUser = await GetUserByLoginAsync(channelName);
                if (broadcasterUser == null)
                {
                    _logger.LogWarning("Could not get broadcaster for channel: {ChannelName}", channelName);
                    return false;
                }

                var targetUser = await GetUserByLoginAsync(username);
                if (targetUser == null)
                {
                    _logger.LogWarning("Could not get user: {Username}", username);
                    return false;
                }

                var accessToken = await GetUserAccessTokenAsync(broadcasterUser.id);
                if (string.IsNullOrEmpty(accessToken))
                {
                    _logger.LogWarning("Could not get broadcaster access token for channel: {ChannelName}", channelName);
                    return false;
                }

                var request = new HttpRequestMessage(HttpMethod.Post,
                    $"{TwitchApiBaseUrl}/moderation/moderators?broadcaster_id={broadcasterUser.id}&user_id={targetUser.id}");

                request.Headers.Add("Client-ID", _twitchSettings.ClientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                var response = await _httpClient.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Moderator restored: {Username} in {ChannelName}", username, channelName);
                    return true;
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Error restoring moderator in [{ChannelName}] for {Username}: {StatusCode} - {ErrorContent}", channelName, username, response.StatusCode, errorContent);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in AddModeratorAsync: {Username} in {ChannelName}", username, channelName);
                return false;
            }
        }

        /// <summary>Resultado de consultar o cambiar mods con el token del streamer. Error = por qué falló, para mostrarlo en admin.</summary>
        public sealed record ModeratorCallResult(bool Success, HashSet<string> ModeratorIds, string? Error)
        {
            public static ModeratorCallResult Fail(string error) => new(false, new HashSet<string>(), error);
        }

        /// <summary>
        /// Cuáles de <paramref name="userIds"/> son mods del canal. Usa el token del streamer
        /// (moderation:read o channel:manage:moderators). Admin → Mod en canales.
        /// </summary>
        public async Task<ModeratorCallResult> GetModeratorsAmongAsync(string broadcasterId, IEnumerable<string> userIds)
        {
            try
            {
                var accessToken = await GetUserAccessTokenAsync(broadcasterId);
                if (string.IsNullOrEmpty(accessToken))
                    return ModeratorCallResult.Fail("token_expired");

                var query = string.Join("", userIds.Select(id => $"&user_id={Uri.EscapeDataString(id)}"));
                var request = new HttpRequestMessage(HttpMethod.Get, $"{TwitchApiBaseUrl}/moderation/moderators?broadcaster_id={broadcasterId}{query}");
                request.Headers.Add("Client-ID", _twitchSettings.ClientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                var response = await _httpClient.SendAsync(request);
                var body = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                    return ModeratorCallResult.Fail(ClassifyModeratorError(response.StatusCode, body));

                using var doc = JsonDocument.Parse(body);
                var ids = new HashSet<string>();
                if (doc.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
                    foreach (var mod in data.EnumerateArray())
                        if (mod.TryGetProperty("user_id", out var id) && id.GetString() is { } s)
                            ids.Add(s);
                return new ModeratorCallResult(true, ids, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetModeratorsAmongAsync for broadcaster {BroadcasterId}", broadcasterId);
                return ModeratorCallResult.Fail("failed");
            }
        }

        /// <summary>
        /// Da (<paramref name="add"/>) o quita mod a un usuario, con el token del streamer. A diferencia de
        /// AddModeratorAsync/RemoveModeratorAsync, trabaja con ids y devuelve el motivo si Twitch lo rechaza.
        /// </summary>
        public async Task<ModeratorCallResult> SetModeratorAsync(string broadcasterId, string userId, bool add)
        {
            try
            {
                var accessToken = await GetUserAccessTokenAsync(broadcasterId);
                if (string.IsNullOrEmpty(accessToken))
                    return ModeratorCallResult.Fail("token_expired");

                var request = new HttpRequestMessage(add ? HttpMethod.Post : HttpMethod.Delete,
                    $"{TwitchApiBaseUrl}/moderation/moderators?broadcaster_id={broadcasterId}&user_id={Uri.EscapeDataString(userId)}");
                request.Headers.Add("Client-ID", _twitchSettings.ClientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("[AdminMods] {Action} mod a {UserId} en {BroadcasterId}", add ? "Dio" : "Quitó", userId, broadcasterId);
                    return new ModeratorCallResult(true, new HashSet<string>(), null);
                }

                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("[AdminMods] Twitch rechazó {Action} mod a {UserId} en {BroadcasterId}: {Status} {Body}",
                    add ? "dar" : "quitar", userId, broadcasterId, (int)response.StatusCode, body);
                return ModeratorCallResult.Fail(ClassifyModeratorError(response.StatusCode, body));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SetModeratorAsync: {UserId} in {BroadcasterId}", userId, broadcasterId);
                return ModeratorCallResult.Fail("failed");
            }
        }

        /// <summary>Lo que devuelve Twitch en moderation/moderators, en una clave corta para admin.</summary>
        private static string ClassifyModeratorError(System.Net.HttpStatusCode status, string body)
        {
            var text = body.ToLowerInvariant();
            if (status == System.Net.HttpStatusCode.Unauthorized)
                return text.Contains("scope") ? "missing_scope" : "token_invalid";
            if (text.Contains("is banned")) return "user_banned";
            if (text.Contains("already a mod")) return "already_mod";
            if (text.Contains("is a vip")) return "is_vip";
            if (text.Contains("not a mod")) return "not_mod";
            if (status == System.Net.HttpStatusCode.TooManyRequests) return "rate_limited";
            return $"twitch_{(int)status}";
        }

        /// <summary>
        /// Elimina un mensaje específico (requiere que el bot sea moderador)
        /// </summary>
        public async Task<bool> DeleteMessageAsync(string channelName, string messageId)
        {
            try
            {
                // Obtener broadcaster_id del canal
                var broadcasterUser = await GetUserByLoginAsync(channelName);
                if (broadcasterUser == null)
                {
                    _logger.LogWarning("Could not get broadcaster for channel: {ChannelName}", channelName);
                    return false;
                }

                // Obtener bot_twitch_id (moderator_id)
                var botTwitchId = await GetBotTwitchIdAsync();
                if (string.IsNullOrEmpty(botTwitchId))
                {
                    _logger.LogWarning("Could not get bot_twitch_id");
                    return false;
                }

                // Obtener User Access Token del bot
                var accessToken = await GetBotUserAccessTokenAsync();
                if (string.IsNullOrEmpty(accessToken))
                {
                    _logger.LogWarning("Could not get bot access token");
                    return false;
                }

                // Crear request
                var request = new HttpRequestMessage(HttpMethod.Delete,
                    $"{TwitchApiBaseUrl}/moderation/chat?broadcaster_id={broadcasterUser.id}&moderator_id={botTwitchId}&message_id={messageId}");

                request.Headers.Add("Client-ID", _twitchSettings.ClientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                // Enviar request
                var response = await _httpClient.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Message deleted in {ChannelName}: {MessageId}", channelName, messageId);
                    return true;
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Error deleting message in [{ChannelName}]: {StatusCode} - {ErrorContent}", channelName, response.StatusCode, errorContent);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in DeleteMessageAsync: {MessageId} in {ChannelName}", messageId, channelName);
                return false;
            }
        }

        /// <summary>
        /// Obtiene la lista de usuarios conectados en el chat (chatters)
        /// </summary>
        public async Task<List<string>> GetChattersAsync(string channelName)
        {
            try
            {
                // Obtener broadcaster_id del canal
                var broadcasterUser = await GetUserByLoginAsync(channelName);
                if (broadcasterUser == null)
                {
                    _logger.LogWarning("Could not get broadcaster for channel: {ChannelName}", channelName);
                    return new List<string>();
                }

                // Obtener bot_twitch_id (moderator_id)
                var botTwitchId = await GetBotTwitchIdAsync();
                if (string.IsNullOrEmpty(botTwitchId))
                {
                    _logger.LogWarning("No se pudo obtener bot_twitch_id para chatters");
                    return new List<string>();
                }

                // Obtener User Access Token del bot
                var accessToken = await GetBotUserAccessTokenAsync();
                if (string.IsNullOrEmpty(accessToken))
                {
                    _logger.LogWarning("No se pudo obtener access token del bot para chatters");
                    return new List<string>();
                }

                // Crear request para obtener chatters (máximo 1000 por página)
                var request = new HttpRequestMessage(HttpMethod.Get,
                    $"{TwitchApiBaseUrl}/chat/chatters?broadcaster_id={broadcasterUser.id}&moderator_id={botTwitchId}&first=1000");

                request.Headers.Add("Client-ID", _twitchSettings.ClientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                // Enviar request
                var response = await _httpClient.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    var result = JsonSerializer.Deserialize<TwitchChattersResponse>(json);

                    if (result?.data != null && result.data.Any())
                    {
                        var chatters = result.data.Select(c => c.user_login).ToList();
                        _logger.LogInformation("Obtained {ChatterCount} chatters in {ChannelName}", chatters.Count, channelName);
                        return chatters;
                    }

                    return new List<string>();
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Error obtaining chatters in [{ChannelName}]: {StatusCode} - {ErrorContent}", channelName, response.StatusCode, errorContent);
                    return new List<string>();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetChattersAsync: {ChannelName}", channelName);
                return new List<string>();
            }
        }

        /// <summary>
        /// Obtiene la lista de usuarios conectados en el chat con su user_id (para tracking de lurkers)
        /// </summary>
        public async Task<List<TwitchChatterData>> GetChattersWithIdsAsync(string channelName)
        {
            try
            {
                var broadcasterUser = await GetUserByLoginAsync(channelName);
                if (broadcasterUser == null)
                {
                    _logger.LogWarning("Could not get broadcaster for channel: {ChannelName}", channelName);
                    return new List<TwitchChatterData>();
                }

                var botTwitchId = await GetBotTwitchIdAsync();
                if (string.IsNullOrEmpty(botTwitchId))
                {
                    _logger.LogWarning("No se pudo obtener bot_twitch_id para chatters");
                    return new List<TwitchChatterData>();
                }

                var accessToken = await GetBotUserAccessTokenAsync();
                if (string.IsNullOrEmpty(accessToken))
                {
                    _logger.LogWarning("No se pudo obtener access token del bot para chatters");
                    return new List<TwitchChatterData>();
                }

                var request = new HttpRequestMessage(HttpMethod.Get,
                    $"{TwitchApiBaseUrl}/chat/chatters?broadcaster_id={broadcasterUser.id}&moderator_id={botTwitchId}&first=1000");

                request.Headers.Add("Client-ID", _twitchSettings.ClientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                var response = await _httpClient.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    var result = JsonSerializer.Deserialize<TwitchChattersResponse>(json);
                    return result?.data ?? new List<TwitchChatterData>();
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Error obtaining chatters in [{ChannelName}]: {StatusCode} - {ErrorContent}", channelName, response.StatusCode, errorContent);
                return new List<TwitchChatterData>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetChattersWithIdsAsync: {ChannelName}", channelName);
                return new List<TwitchChatterData>();
            }
        }

        /// <summary>
        /// Obtiene todos los seguidores de un canal de Twitch con paginación
        /// </summary>
        public async Task<List<TwitchFollowerData>> GetChannelFollowersAsync(string broadcasterId)
        {
            var allFollowers = new List<TwitchFollowerData>();
            string? cursor = null;

            try
            {
                // IMPORTANTE: Usar el User Access Token del broadcaster, NO el App Access Token
                // El endpoint de followers requiere el scope moderator:read:followers
                var token = await GetUserAccessTokenAsync(broadcasterId);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogError($"No se pudo obtener User Access Token para broadcaster {broadcasterId}");
                    return allFollowers;
                }

                _logger.LogInformation($"📡 Obteniendo followers con User Access Token para broadcaster {broadcasterId}");

                int pageCount = 0;
                do
                {
                    pageCount++;
                    var url = $"{TwitchApiBaseUrl}/channels/followers?broadcaster_id={broadcasterId}&first=100";
                    if (!string.IsNullOrEmpty(cursor))
                    {
                        url += $"&after={cursor}";
                    }

                    _logger.LogDebug($"🔄 Página {pageCount}: Solicitando hasta 100 followers (cursor: {cursor ?? "null"})");

                    var request = new HttpRequestMessage(HttpMethod.Get, url);
                    request.Headers.Add("Client-ID", _twitchSettings.ClientId);
                    request.Headers.Add("Authorization", $"Bearer {token}");

                    var response = await _httpClient.SendAsync(request);
                    if (!response.IsSuccessStatusCode)
                    {
                        var error = await response.Content.ReadAsStringAsync();
                        _logger.LogWarning($"Error en GetChannelFollowersAsync ({response.StatusCode}): {error}");
                        break;
                    }

                    var json = await response.Content.ReadAsStringAsync();
                    _logger.LogDebug($"📄 Página {pageCount} - Respuesta JSON (primeros 500 chars): {json.Substring(0, Math.Min(500, json.Length))}...");

                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };
                    var result = JsonSerializer.Deserialize<TwitchFollowersResponse>(json, options);

                    if (result?.data != null && result.data.Any())
                    {
                        allFollowers.AddRange(result.data);
                        _logger.LogInformation($"✅ Página {pageCount}: Obtenidos {result.data.Count} followers (total acumulado: {allFollowers.Count})");
                    }
                    else
                    {
                        _logger.LogWarning($"⚠️ Página {pageCount}: No hay datos en la respuesta");
                    }

                    cursor = result?.pagination?.Cursor;
                    _logger.LogInformation($"📍 Página {pageCount} - Total en respuesta: {result?.total ?? 0}, Cursor: '{cursor ?? "null"}', ¿Continuar?: {!string.IsNullOrEmpty(cursor)}");

                    if (result?.pagination == null)
                    {
                        _logger.LogWarning($"⚠️ Página {pageCount}: pagination es null en la respuesta");
                        break;
                    }
                } while (!string.IsNullOrEmpty(cursor));

                _logger.LogInformation($"🎯 Total de followers obtenidos: {allFollowers.Count} para broadcaster {broadcasterId}");
                return allFollowers;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error en GetChannelFollowersAsync: {broadcasterId}");
                return allFollowers;
            }
        }
    }

    // DTOs para respuestas de Twitch API
    public class TwitchApiResponse<T>
    {
        public List<T>? data { get; set; }
    }

    public class TwitchUserData
    {
        public string id { get; set; } = "";
        public string login { get; set; } = "";
        public string display_name { get; set; } = "";
        public string profile_image_url { get; set; } = "";
        public string created_at { get; set; } = ""; // Fecha de creación de la cuenta Twitch
    }

    public class TwitchClipData
    {
        public string id { get; set; } = "";
        public string url { get; set; } = "";
        public string title { get; set; } = "";
        public int view_count { get; set; }
    }

    public class TwitchChannelData
    {
        public string broadcaster_id { get; set; } = "";
        public string broadcaster_name { get; set; } = "";
        public string game_name { get; set; } = "";
        public string game_id { get; set; } = "";
    }

    public class TwitchStreamData
    {
        public string id { get; set; } = "";
        public string user_id { get; set; } = "";
        public string user_login { get; set; } = "";
        public string user_name { get; set; } = "";
        public string game_id { get; set; } = "";
        public string game_name { get; set; } = "";
        public string type { get; set; } = "";
        public string title { get; set; } = "";
        public int viewer_count { get; set; }
        public string started_at { get; set; } = "";
        public string thumbnail_url { get; set; } = "";
    }

    public class ShoutoutData
    {
        public string UserId { get; set; } = "";
        public string Username { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string ProfileImageUrl { get; set; } = "";
        public string GameName { get; set; } = "";
        public string? ClipUrl { get; set; }
        public string? ClipId { get; set; }
    }

    public class TwitchChattersResponse
    {
        public List<TwitchChatterData>? data { get; set; }
        public TwitchPagination? pagination { get; set; }
        public int total { get; set; }
    }

    public class TwitchChatterData
    {
        public string user_id { get; set; } = "";
        public string user_login { get; set; } = "";
        public string user_name { get; set; } = "";
    }

    public class TwitchFollowersResponse
    {
        public List<TwitchFollowerData>? data { get; set; }
        public TwitchPagination? pagination { get; set; }
        public int total { get; set; }
    }

    public class TwitchFollowerData
    {
        public string user_id { get; set; } = "";
        public string user_name { get; set; } = "";
        public string user_login { get; set; } = "";
        public string followed_at { get; set; } = "";
    }
}