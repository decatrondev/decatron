using System;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Decatron.Core.Helpers;

namespace Decatron.Core.Functions
{
    /// <summary>
    /// Variables relacionadas con información de usuarios de Twitch
    /// $(followage), $(followage:username), $(accountage)
    /// </summary>
    public class TwitchInfoVariables
    {
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<TwitchInfoVariables> _logger;

        public TwitchInfoVariables(
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            ILogger<TwitchInfoVariables> logger)
        {
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        /// <summary>
        /// Obtiene la antigüedad de seguidor de un usuario
        /// $(followage) o $(followage:username)
        /// </summary>
        public async Task<string> GetFollowAge(string channelName, string userName)
        {
            try
            {
                // Limpiar y normalizar el nombre de usuario
                userName = userName?.Trim().TrimStart('@').ToLower();

                if (string.IsNullOrWhiteSpace(userName))
                {
                    _logger.LogWarning("GetFollowAge llamado con userName vacío");
                    return "Usuario no especificado";
                }

                _logger.LogDebug($"GetFollowAge - channelName: '{channelName}', userName: '{userName}'");

                var accessToken = await Utils.GetAccessTokenFromDatabaseAsync(_configuration, channelName);
                if (string.IsNullOrEmpty(accessToken))
                {
                    _logger.LogWarning($"No se pudo obtener token para canal: {channelName}");
                    return "Error al obtener token de acceso";
                }

                var httpClient = _httpClientFactory.CreateClient();
                Utils.ConfigureTwitchApiHeaders(httpClient, _configuration, accessToken);

                // Obtener broadcaster ID
                var broadcasterId = await Utils.GetBroadcasterIdFromDatabaseAsync(_configuration, channelName);
                if (string.IsNullOrEmpty(broadcasterId))
                {
                    _logger.LogWarning($"No se pudo obtener broadcaster ID para: {channelName}");
                    return "Error al obtener ID del canal";
                }

                // Obtener user ID del follower
                _logger.LogDebug($"Buscando usuario en Twitch API: {userName}");
                var userResponse = await httpClient.GetAsync($"https://api.twitch.tv/helix/users?login={userName}");

                if (!userResponse.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"API Twitch retornó {userResponse.StatusCode} para usuario: {userName}");
                    return "Usuario no encontrado";
                }

                var userContent = await userResponse.Content.ReadAsStringAsync();
                var userJson = JObject.Parse(userContent);

                if (userJson["data"] == null || !userJson["data"].HasValues)
                {
                    _logger.LogWarning($"Usuario no existe en Twitch: {userName}");
                    return "Usuario no encontrado";
                }

                var userId = userJson["data"][0]["id"].ToString();

                // Obtener información de seguimiento
                var followResponse = await httpClient.GetAsync(
                    $"https://api.twitch.tv/helix/channels/followers?broadcaster_id={broadcasterId}&user_id={userId}");

                if (!followResponse.IsSuccessStatusCode)
                {
                    return "No sigue el canal";
                }

                var followContent = await followResponse.Content.ReadAsStringAsync();
                var followJson = JObject.Parse(followContent);

                if (followJson["data"] == null || !followJson["data"].HasValues)
                {
                    return "No sigue el canal";
                }

                var followedAt = DateTime.Parse(followJson["data"][0]["followed_at"].ToString());
                var duration = DateTime.UtcNow - followedAt;

                return FormatDuration(duration);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo followage de {userName} en {channelName}");
                return "Error al obtener followage";
            }
        }

        /// <summary>
        /// Obtiene la antigüedad de la cuenta de Twitch
        /// $(accountage) o $(accountage:username)
        /// </summary>
        public async Task<string> GetAccountAge(string channelName, string userName)
        {
            try
            {
                // Limpiar y normalizar el nombre de usuario
                userName = userName?.Trim().TrimStart('@').ToLower();

                if (string.IsNullOrWhiteSpace(userName))
                {
                    _logger.LogWarning("GetAccountAge llamado con userName vacío");
                    return "Usuario no especificado";
                }

                _logger.LogDebug($"GetAccountAge - channelName: '{channelName}', userName: '{userName}'");

                var accessToken = await Utils.GetAccessTokenFromDatabaseAsync(_configuration, channelName);
                if (string.IsNullOrEmpty(accessToken))
                {
                    _logger.LogWarning($"No se pudo obtener token para canal: {channelName}");
                    return "Error al obtener token de acceso";
                }

                var httpClient = _httpClientFactory.CreateClient();
                Utils.ConfigureTwitchApiHeaders(httpClient, _configuration, accessToken);

                // Obtener información del usuario
                _logger.LogDebug($"Buscando usuario en Twitch API: {userName}");
                var userResponse = await httpClient.GetAsync($"https://api.twitch.tv/helix/users?login={userName}");

                if (!userResponse.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"API Twitch retornó {userResponse.StatusCode} para usuario: {userName}");
                    return "Usuario no encontrado";
                }

                var userContent = await userResponse.Content.ReadAsStringAsync();
                var userJson = JObject.Parse(userContent);

                if (userJson["data"] == null || !userJson["data"].HasValues)
                {
                    _logger.LogWarning($"Usuario no existe en Twitch: {userName}");
                    return "Usuario no encontrado";
                }

                var createdAt = DateTime.Parse(userJson["data"][0]["created_at"].ToString());
                var duration = DateTime.UtcNow - createdAt;

                return FormatDuration(duration);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo accountage de {userName}");
                return "Error al obtener accountage";
            }
        }

        private string FormatDuration(TimeSpan duration)
        {
            var years = (int)(duration.TotalDays / 365);
            var remainingDays = duration.TotalDays % 365;
            var months = (int)(remainingDays / 30);
            var days = (int)(remainingDays % 30);
            var hours = duration.Hours;
            var minutes = duration.Minutes;

            var parts = new System.Collections.Generic.List<string>();

            // Si tiene años o meses, mostrar formato largo
            if (years > 0)
            {
                parts.Add($"{years} {(years == 1 ? "año" : "años")}");
                if (months > 0)
                    parts.Add($"{months} {(months == 1 ? "mes" : "meses")}");
                if (days > 0)
                    parts.Add($"{days} {(days == 1 ? "día" : "días")}");
            }
            else if (months > 0)
            {
                parts.Add($"{months} {(months == 1 ? "mes" : "meses")}");
                if (days > 0)
                    parts.Add($"{days} {(days == 1 ? "día" : "días")}");
                if (hours > 0)
                    parts.Add($"{hours} {(hours == 1 ? "hora" : "horas")}");
            }
            else if (days > 0)
            {
                parts.Add($"{days} {(days == 1 ? "día" : "días")}");
                if (hours > 0)
                    parts.Add($"{hours} {(hours == 1 ? "hora" : "horas")}");
                if (minutes > 0)
                    parts.Add($"{minutes} {(minutes == 1 ? "minuto" : "minutos")}");
            }
            else if (hours > 0)
            {
                parts.Add($"{hours} {(hours == 1 ? "hora" : "horas")}");
                if (minutes > 0)
                    parts.Add($"{minutes} {(minutes == 1 ? "minuto" : "minutos")}");
            }
            else if (minutes > 0)
            {
                parts.Add($"{minutes} {(minutes == 1 ? "minuto" : "minutos")}");
            }
            else
            {
                return "menos de 1 minuto";
            }

            return string.Join(", ", parts);
        }

        /// <summary>
        /// Formatea duración completa incluyendo años, meses, semanas, días, horas, minutos y segundos
        /// </summary>
        public string FormatDurationComplete(TimeSpan duration)
        {
            var years = (int)(duration.TotalDays / 365);
            var remainingDays = duration.TotalDays % 365;
            var months = (int)(remainingDays / 30);
            remainingDays = remainingDays % 30;
            var weeks = (int)(remainingDays / 7);
            var days = (int)(remainingDays % 7);
            var hours = duration.Hours;
            var minutes = duration.Minutes;
            var seconds = duration.Seconds;

            var parts = new System.Collections.Generic.List<string>();

            if (years > 0)
                parts.Add($"{years} {(years == 1 ? "año" : "años")}");
            if (months > 0)
                parts.Add($"{months} {(months == 1 ? "mes" : "meses")}");
            if (weeks > 0)
                parts.Add($"{weeks} {(weeks == 1 ? "semana" : "semanas")}");
            if (days > 0)
                parts.Add($"{days} {(days == 1 ? "día" : "días")}");
            if (hours > 0)
                parts.Add($"{hours} {(hours == 1 ? "hora" : "horas")}");
            if (minutes > 0)
                parts.Add($"{minutes} {(minutes == 1 ? "minuto" : "minutos")}");
            if (seconds > 0 || parts.Count == 0)
                parts.Add($"{seconds} {(seconds == 1 ? "segundo" : "segundos")}");

            return string.Join(", ", parts);
        }

        /// <summary>
        /// Obtiene un App Access Token para consultas públicas (no requiere permisos de usuario)
        /// </summary>
        private async Task<string?> GetAppAccessTokenAsync()
        {
            try
            {
                var clientId = _configuration["Twitch:ClientId"];
                var clientSecret = _configuration["Twitch:ClientSecret"];

                var client = _httpClientFactory.CreateClient();
                var request = new HttpRequestMessage(HttpMethod.Post,
                    $"https://id.twitch.tv/oauth2/token?client_id={clientId}&client_secret={clientSecret}&grant_type=client_credentials");

                var response = await client.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"[AppToken] Error obteniendo App Access Token: {response.StatusCode}");
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync();
                var result = JObject.Parse(json);
                return result["access_token"]?.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AppToken] Error obteniendo App Access Token");
                return null;
            }
        }

        /// <summary>
        /// Obtiene la antigüedad de seguidor con formato completo (años, meses, semanas, días, horas, minutos, segundos)
        /// </summary>
        public async Task<(string duration, DateTime? followedAt)> GetFollowAgeComplete(string channelName, string userName)
        {
            try
            {
                userName = userName?.Trim().TrimStart('@').ToLower();
                channelName = channelName?.Trim().TrimStart('#').ToLower();

                if (string.IsNullOrWhiteSpace(userName))
                {
                    return ("Usuario no especificado", null);
                }

                _logger.LogDebug($"[FollowageComplete] Consultando followage de '{userName}' en canal '{channelName}'");

                var clientId = _configuration["Twitch:ClientId"];

                // Paso 1: Usar App Token para obtener IDs de usuarios (no requiere permisos de usuario)
                var appToken = await GetAppAccessTokenAsync();
                if (string.IsNullOrEmpty(appToken))
                {
                    _logger.LogError("[FollowageComplete] No se pudo obtener App Token");
                    return ("Error de configuración", null);
                }

                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Clear();
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {appToken}");
                client.DefaultRequestHeaders.Add("Client-Id", clientId);

                // Obtener IDs de usuarios
                var usersUrl = $"https://api.twitch.tv/helix/users?login={userName}";
                if (!userName.Equals(channelName, StringComparison.OrdinalIgnoreCase))
                {
                    usersUrl += $"&login={channelName}";
                }

                _logger.LogDebug($"[FollowageComplete] Obteniendo IDs con App Token: {usersUrl}");
                var userResponse = await client.GetAsync(usersUrl);

                if (!userResponse.IsSuccessStatusCode)
                {
                    var errorContent = await userResponse.Content.ReadAsStringAsync();
                    _logger.LogError($"[FollowageComplete] Error API usuarios: {userResponse.StatusCode} - {errorContent}");
                    return ($"Error API: {userResponse.StatusCode}", null);
                }

                var userContent = await userResponse.Content.ReadAsStringAsync();
                var userJson = JObject.Parse(userContent);

                string? userId = null;
                string? broadcasterId = null;

                foreach (var user in userJson["data"])
                {
                    var login = user["login"].ToString().ToLower();
                    if (login == userName)
                        userId = user["id"].ToString();
                    if (login == channelName.ToLower())
                        broadcasterId = user["id"].ToString();
                }

                if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(broadcasterId))
                {
                    _logger.LogWarning($"[FollowageComplete] Usuario o broadcaster no encontrado. userId={userId}, broadcasterId={broadcasterId}");
                    return ("Usuario no encontrado", null);
                }

                _logger.LogDebug($"[FollowageComplete] IDs obtenidos: userId={userId}, broadcasterId={broadcasterId}");

                // Paso 2: Usar token del broadcaster para verificar seguimiento (requiere moderator:read:followers)
                var broadcasterToken = await Utils.GetAccessTokenFromDatabaseAsync(_configuration, channelName);
                if (string.IsNullOrEmpty(broadcasterToken))
                {
                    _logger.LogWarning($"[FollowageComplete] No se encontró token del broadcaster para {channelName}");
                    return ("Canal no configurado", null);
                }

                // Crear nuevo cliente con token del broadcaster
                var followerClient = _httpClientFactory.CreateClient();
                followerClient.DefaultRequestHeaders.Clear();
                followerClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {broadcasterToken}");
                followerClient.DefaultRequestHeaders.Add("Client-Id", clientId);

                var followUrl = $"https://api.twitch.tv/helix/channels/followers?broadcaster_id={broadcasterId}&user_id={userId}";
                _logger.LogDebug($"[FollowageComplete] Verificando followers con token del broadcaster: {followUrl}");

                var followResponse = await followerClient.GetAsync(followUrl);

                if (!followResponse.IsSuccessStatusCode)
                {
                    var errorContent = await followResponse.Content.ReadAsStringAsync();
                    _logger.LogError($"[FollowageComplete] Error API followers: {followResponse.StatusCode} - {errorContent}");

                    if (followResponse.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    {
                        return ("Token expirado, el streamer debe reconectar su cuenta", null);
                    }
                    if (followResponse.StatusCode == System.Net.HttpStatusCode.Forbidden)
                    {
                        return ("Sin permisos para ver followers (scope: moderator:read:followers)", null);
                    }
                    return ($"Error al verificar seguimiento: {followResponse.StatusCode}", null);
                }

                var followContent = await followResponse.Content.ReadAsStringAsync();
                var followJson = JObject.Parse(followContent);

                if (followJson["data"] == null || !followJson["data"].HasValues)
                {
                    return ("No sigue el canal", null);
                }

                var followedAt = DateTime.Parse(followJson["data"][0]["followed_at"].ToString());
                var duration = DateTime.UtcNow - followedAt;

                return (FormatDurationComplete(duration), followedAt);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo followage completo de {userName} en {channelName}");
                return ("Error al obtener followage", null);
            }
        }
    }
}
