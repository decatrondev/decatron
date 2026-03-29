using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Helpers;
using Decatron.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Decatron.Default.Commands
{
    /// <summary>
    /// Comando para consultar cuánto tiempo lleva un usuario siguiendo el canal
    /// Uso: !followage o !followage @usuario
    /// </summary>
    public class FollowageCommand : ICommand
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<FollowageCommand> _logger;
        private readonly ICommandStateService _commandStateService;
        private readonly IHttpClientFactory _httpClientFactory;

        public string Name => "!followage";
        public string Description => "Muestra cuánto tiempo lleva un usuario siguiendo el canal";

        public FollowageCommand(
            IConfiguration configuration,
            ILogger<FollowageCommand> logger,
            ICommandStateService commandStateService,
            IHttpClientFactory httpClientFactory)
        {
            _configuration = configuration;
            _logger = logger;
            _commandStateService = commandStateService;
            _httpClientFactory = httpClientFactory;
        }

        public async Task ExecuteAsync(CommandContext context, IMessageSender messageSender)
        {
            var username = context.Username;
            var channel = context.Channel;
            var message = context.Message;

            try
            {
                _logger.LogInformation($"[Followage] Ejecutando comando por {username} en {channel}");

                // Verificar si el comando está habilitado
                var isCommandEnabled = await IsCommandEnabledForChannel(channel);
                if (!isCommandEnabled)
                {
                    _logger.LogDebug($"[Followage] Comando deshabilitado para {channel}");
                    return;
                }

                // Parsear argumentos - si hay un usuario especificado, usarlo
                var messageWithoutPrefix = message.StartsWith("!") ? message.Substring(1) : message;
                var args = messageWithoutPrefix.Split(' ', StringSplitOptions.RemoveEmptyEntries);

                string targetUser;
                bool isSelf = false;

                if (args.Length >= 2)
                {
                    // !followage @usuario o !followage usuario
                    // Limpiar espacios y caracteres invisibles
                    var potentialUser = args[1].TrimStart('@').Trim().ToLower();

                    // Si después de limpiar está vacío, consultar para sí mismo
                    if (string.IsNullOrWhiteSpace(potentialUser))
                    {
                        targetUser = username.ToLower();
                        isSelf = true;
                    }
                    else
                    {
                        targetUser = potentialUser;
                    }
                }
                else
                {
                    // !followage (consulta para sí mismo)
                    targetUser = username.ToLower();
                    isSelf = true;
                }

                _logger.LogDebug($"[Followage] Consultando followage de {targetUser} en {channel}");

                // Obtener información del canal (igual que GameCommand)
                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channel);
                if (userInfo == null)
                {
                    _logger.LogError($"[Followage] No se pudo obtener información del canal {channel}");
                    await messageSender.SendMessageAsync(channel, $"@{username}, error: canal no configurado.");
                    return;
                }

                // Obtener followage usando el token del canal
                var (duration, followedAt) = await GetFollowAgeAsync(userInfo.TwitchId, userInfo.AccessToken, targetUser);

                // Construir respuesta
                string response;
                if (followedAt.HasValue)
                {
                    var followDate = followedAt.Value.ToString("dd/MM/yyyy HH:mm:ss");
                    if (isSelf)
                    {
                        response = $"@{username}, llevas siguiendo a {channel} por {duration} (desde {followDate} UTC)";
                    }
                    else
                    {
                        response = $"@{targetUser} lleva siguiendo a {channel} por {duration} (desde {followDate} UTC)";
                    }
                }
                else
                {
                    // El usuario no sigue el canal o hubo un error
                    if (duration == "No sigue el canal")
                    {
                        if (isSelf)
                        {
                            response = $"@{username}, no sigues el canal {channel}. Dale follow!";
                        }
                        else
                        {
                            response = $"@{targetUser} no sigue el canal {channel}";
                        }
                    }
                    else
                    {
                        // Otro error
                        response = $"@{username}, {duration}";
                    }
                }

                await messageSender.SendMessageAsync(channel, response);
                _logger.LogInformation($"[Followage] Respuesta enviada: {response}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Followage] Error ejecutando comando en {channel}");
                await messageSender.SendMessageAsync(channel, $"@{username}, hubo un error al obtener el followage.");
            }
        }

        private async Task<(string duration, DateTime? followedAt)> GetFollowAgeAsync(string broadcasterId, string accessToken, string targetUsername)
        {
            try
            {
                var clientId = _configuration["TwitchSettings:ClientId"];
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Clear();
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");
                client.DefaultRequestHeaders.Add("Client-Id", clientId);

                // Paso 1: Obtener ID del usuario target
                var userResponse = await client.GetAsync($"https://api.twitch.tv/helix/users?login={targetUsername}");
                if (!userResponse.IsSuccessStatusCode)
                {
                    _logger.LogError($"[Followage] Error obteniendo usuario: {userResponse.StatusCode}");
                    return ("Error al buscar usuario", null);
                }

                var userContent = await userResponse.Content.ReadAsStringAsync();
                var userJson = JObject.Parse(userContent);

                if (userJson["data"] == null || !userJson["data"].HasValues)
                {
                    return ("Usuario no encontrado", null);
                }

                var userId = userJson["data"][0]["id"].ToString();
                _logger.LogDebug($"[Followage] Usuario {targetUsername} tiene ID: {userId}");

                // Paso 2: Verificar seguimiento
                var followResponse = await client.GetAsync(
                    $"https://api.twitch.tv/helix/channels/followers?broadcaster_id={broadcasterId}&user_id={userId}");

                if (!followResponse.IsSuccessStatusCode)
                {
                    var errorContent = await followResponse.Content.ReadAsStringAsync();
                    _logger.LogError($"[Followage] Error API followers: {followResponse.StatusCode} - {errorContent}");

                    if (followResponse.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    {
                        return ("Token expirado, el streamer debe reconectar", null);
                    }
                    if (followResponse.StatusCode == System.Net.HttpStatusCode.Forbidden)
                    {
                        return ("Sin permisos para ver followers", null);
                    }
                    return ("Error al verificar seguimiento", null);
                }

                var followContent = await followResponse.Content.ReadAsStringAsync();
                var followJson = JObject.Parse(followContent);

                if (followJson["data"] == null || !followJson["data"].HasValues)
                {
                    return ("No sigue el canal", null);
                }

                var followedAt = DateTime.Parse(followJson["data"][0]["followed_at"].ToString());
                var duration = DateTime.UtcNow - followedAt;

                return (FormatDuration(duration), followedAt);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Followage] Error obteniendo followage de {targetUsername}");
                return ("Error al obtener followage", null);
            }
        }

        private string FormatDuration(TimeSpan duration)
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

            var parts = new List<string>();

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

        private async Task<bool> IsCommandEnabledForChannel(string channelLogin)
        {
            try
            {
                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channelLogin);
                if (userInfo == null)
                {
                    return true; // Por defecto habilitado
                }

                return await _commandStateService.IsCommandEnabledAsync(userInfo.Id, "followage");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Followage] Error verificando si comando está habilitado para {channelLogin}");
                return true;
            }
        }
    }
}
