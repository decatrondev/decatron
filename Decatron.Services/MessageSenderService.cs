using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Decatron.Core.Interfaces;
using Decatron.Core.Settings;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Decatron.Services
{
    public class MessageSenderService : IMessageSender
    {
        private readonly ILogger<MessageSenderService> _logger;
        private readonly HttpClient _httpClient;
        private readonly TwitchSettings _twitchSettings;
        private readonly IServiceProvider _serviceProvider;
        private readonly ConcurrentQueue<(string channel, string message)> _messageQueue;
        private readonly CancellationTokenSource _cancellationTokenSource;
        private readonly Task _processingTask;

        public MessageSenderService(
            ILogger<MessageSenderService> logger,
            HttpClient httpClient,
            IOptions<TwitchSettings> twitchSettings,
            IServiceProvider serviceProvider)
        {
            _logger = logger;
            _httpClient = httpClient;
            _twitchSettings = twitchSettings.Value;
            _serviceProvider = serviceProvider;
            _messageQueue = new ConcurrentQueue<(string, string)>();
            _cancellationTokenSource = new CancellationTokenSource();
            _processingTask = ProcessMessageQueue(_cancellationTokenSource.Token);
        }

        public async Task SendMessageAsync(string channel, string message)
        {
            try
            {
                if (string.IsNullOrEmpty(channel) || string.IsNullOrEmpty(message))
                {
                    _logger.LogWarning("Channel o mensaje vacío");
                    return;
                }
                _messageQueue.Enqueue((channel, message));
                await Task.CompletedTask;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enqueue mensaje");
            }
        }

        public void SendMessage(string channel, string message)
        {
            try
            {
                if (string.IsNullOrEmpty(channel) || string.IsNullOrEmpty(message))
                {
                    _logger.LogWarning("Channel o mensaje vacío");
                    return;
                }
                _messageQueue.Enqueue((channel, message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error queue mensaje");
            }
        }

        private async Task ProcessMessageQueue(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    if (_messageQueue.TryDequeue(out var messageData))
                    {
                        var (channel, message) = messageData;
                        await SendMessageViaAPI(channel, message);
                        await Task.Delay(100, cancellationToken); // Rate limiting
                    }
                    else
                    {
                        await Task.Delay(50, cancellationToken);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error procesando cola");
                    await Task.Delay(1000, cancellationToken);
                }
            }
        }

        private async Task SendMessageViaAPI(string channel, string message)
        {
            try
            {
                // Obtener broadcaster_id del canal
                var broadcasterId = await GetBroadcasterIdFromChannel(channel);
                if (string.IsNullOrEmpty(broadcasterId))
                {
                    _logger.LogWarning($"No se pudo obtener broadcaster_id para canal: {channel}");
                    return;
                }

                // Obtener bot_twitch_id (necesario para verified badge)
                var botTwitchId = await GetBotTwitchId();
                if (string.IsNullOrEmpty(botTwitchId))
                {
                    _logger.LogWarning("No se pudo obtener bot_twitch_id del bot");
                    return;
                }

                // Obtener access token del bot (App Access Token para verified badge)
                var accessToken = await GetBotAccessToken();
                if (string.IsNullOrEmpty(accessToken))
                {
                    _logger.LogWarning("No se pudo obtener access token del bot");
                    return;
                }

                // Crear payload para API
                var payload = new
                {
                    broadcaster_id = broadcasterId,
                    sender_id = botTwitchId, // ID del bot (necesario para verified badge)
                    message = message
                };

                var jsonContent = JsonSerializer.Serialize(payload);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                // Crear request
                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/chat/messages")
                {
                    Content = content
                };

                request.Headers.Add("Client-ID", _twitchSettings.ClientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                // Enviar mensaje
                var response = await _httpClient.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"📤 [{channel}] Bot: {message}");
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning($"❌ Error enviando mensaje via API a [{channel}]: {response.StatusCode} - {errorContent}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error enviando mensaje via API a [{channel}]: {message}");
            }
        }

        private async Task<string?> GetBroadcasterIdFromChannel(string channelName)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();

                var twitchId = await dbContext.Users
                    .Where(u => u.Login == channelName)
                    .Select(u => u.TwitchId)
                    .FirstOrDefaultAsync();

                if (twitchId != null)
                {
                    return twitchId;
                }

                _logger.LogWarning($"No se encontró broadcaster_id para canal: {channelName}");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo broadcaster_id para canal: {channelName}");
                return null;
            }
        }


        private async Task<string?> GetBotAccessToken()
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var botTokenRepo = scope.ServiceProvider.GetRequiredService<IBotTokenRepository>();

                var botToken = await botTokenRepo.GetByBotUsernameAsync(_twitchSettings.BotUsername);
                if (botToken != null && !string.IsNullOrEmpty(botToken.AccessToken))
                {
                    var token = botToken.AccessToken;
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

        private async Task<string?> GetBotTwitchId()
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var botTokenRepo = scope.ServiceProvider.GetRequiredService<IBotTokenRepository>();

                var botToken = await botTokenRepo.GetByBotUsernameAsync(_twitchSettings.BotUsername);
                if (botToken?.BotTwitchId != null)
                {
                    return botToken.BotTwitchId;
                }

                _logger.LogWarning($"bot_twitch_id no encontrado para bot: {_twitchSettings.BotUsername}");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo bot_twitch_id del bot");
                return null;
            }
        }

        public void Dispose()
        {
            _cancellationTokenSource?.Cancel();
            try
            {
                _processingTask?.Wait(TimeSpan.FromSeconds(5));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deteniendo MessageSenderService");
            }
            _cancellationTokenSource?.Dispose();
        }
    }
}