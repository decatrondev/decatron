using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Core.Helpers;
using Decatron.Data;
using Decatron.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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
        private readonly ICommandMessagesService _messagesService;
        private readonly IServiceScopeFactory _scopeFactory;

        public string Name => "!followage";
        public string Description => "Muestra cuánto tiempo lleva un usuario siguiendo el canal";

        public FollowageCommand(
            IConfiguration configuration,
            ILogger<FollowageCommand> logger,
            ICommandStateService commandStateService,
            IHttpClientFactory httpClientFactory,
            ICommandMessagesService messagesService,
            IServiceScopeFactory scopeFactory)
        {
            _configuration = configuration;
            _logger = logger;
            _commandStateService = commandStateService;
            _httpClientFactory = httpClientFactory;
            _messagesService = messagesService;
            _scopeFactory = scopeFactory;
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

                var lang = await GetChannelLanguageAsync(channel);

                // Obtener información del canal (igual que GameCommand)
                var userInfo = await Utils.GetUserInfoFromDatabaseAsync(_configuration, channel);
                if (userInfo == null)
                {
                    _logger.LogError($"[Followage] No se pudo obtener información del canal {channel}");
                    await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("followage", "error_channel", lang, username));
                    return;
                }

                // Obtener followage usando el token del canal
                var (duration, followedAt) = await GetFollowAgeAsync(userInfo.TwitchId, userInfo.AccessToken, targetUser, lang);

                // Construir respuesta
                string response;
                if (followedAt.HasValue)
                {
                    var followDate = followedAt.Value.ToString("dd/MM/yyyy HH:mm:ss");
                    if (isSelf)
                    {
                        response = _messagesService.GetMessage("followage", "following_self", lang, username, channel, duration, followDate);
                    }
                    else
                    {
                        response = _messagesService.GetMessage("followage", "following_other", lang, targetUser, channel, duration, followDate);
                    }
                }
                else
                {
                    // El usuario no sigue el canal o hubo un error
                    if (duration == _messagesService.GetMessage("followage", "not_following", lang))
                    {
                        if (isSelf)
                        {
                            response = _messagesService.GetMessage("followage", "not_following_self", lang, username, channel);
                        }
                        else
                        {
                            response = _messagesService.GetMessage("followage", "not_following_other", lang, targetUser, channel);
                        }
                    }
                    else
                    {
                        // Otro error
                        response = _messagesService.GetMessage("followage", "followage_short", lang, username, duration);
                    }
                }

                await messageSender.SendMessageAsync(channel, response);
                _logger.LogInformation($"[Followage] Respuesta enviada: {response}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Followage] Error ejecutando comando en {channel}");
                var lang = await GetChannelLanguageAsync(channel);
                await messageSender.SendMessageAsync(channel, _messagesService.GetMessage("followage", "error_generic", lang, username));
            }
        }

        private async Task<(string duration, DateTime? followedAt)> GetFollowAgeAsync(string broadcasterId, string accessToken, string targetUsername, string lang)
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
                    return (_messagesService.GetMessage("followage", "error_find_user", lang), null);
                }

                var userContent = await userResponse.Content.ReadAsStringAsync();
                var userJson = JObject.Parse(userContent);

                if (userJson["data"] == null || !userJson["data"].HasValues)
                {
                    return (_messagesService.GetMessage("followage", "error_user_not_found", lang), null);
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
                        return (_messagesService.GetMessage("followage", "error_token_expired", lang), null);
                    }
                    if (followResponse.StatusCode == System.Net.HttpStatusCode.Forbidden)
                    {
                        return (_messagesService.GetMessage("followage", "error_no_permission", lang), null);
                    }
                    return (_messagesService.GetMessage("followage", "error_verify", lang), null);
                }

                var followContent = await followResponse.Content.ReadAsStringAsync();
                var followJson = JObject.Parse(followContent);

                if (followJson["data"] == null || !followJson["data"].HasValues)
                {
                    return (_messagesService.GetMessage("followage", "not_following", lang), null);
                }

                var followedAt = DateTime.Parse(followJson["data"][0]["followed_at"].ToString());
                var duration = DateTime.UtcNow - followedAt;

                return (FormatDuration(duration, lang), followedAt);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Followage] Error obteniendo followage de {targetUsername}");
                return (_messagesService.GetMessage("followage", "error_get_followage", lang), null);
            }
        }

        private string FormatDuration(TimeSpan duration, string lang)
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
                parts.Add($"{years} {_messagesService.GetMessage("followage", years == 1 ? "year" : "years", lang)}");
            if (months > 0)
                parts.Add($"{months} {_messagesService.GetMessage("followage", months == 1 ? "month" : "months", lang)}");
            if (weeks > 0)
                parts.Add($"{weeks} {_messagesService.GetMessage("followage", weeks == 1 ? "week" : "weeks", lang)}");
            if (days > 0)
                parts.Add($"{days} {_messagesService.GetMessage("followage", days == 1 ? "day" : "days", lang)}");
            if (hours > 0)
                parts.Add($"{hours} {_messagesService.GetMessage("followage", hours == 1 ? "hour" : "hours", lang)}");
            if (minutes > 0)
                parts.Add($"{minutes} {_messagesService.GetMessage("followage", minutes == 1 ? "minute" : "minutes", lang)}");
            if (seconds > 0 || parts.Count == 0)
                parts.Add($"{seconds} {_messagesService.GetMessage("followage", seconds == 1 ? "second" : "seconds", lang)}");

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

        private async Task<string> GetChannelLanguageAsync(string channel)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var lang = await db.Users
                    .Where(u => u.Login == channel.ToLower())
                    .Select(u => u.PreferredLanguage)
                    .FirstOrDefaultAsync();
                return lang ?? "es";
            }
            catch { return "es"; }
        }
    }
}
