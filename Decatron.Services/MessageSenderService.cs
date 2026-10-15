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
        private readonly ICredentialProvider _credentials;
        private readonly IBotAccountProvider _bot;
        private readonly IServiceProvider _serviceProvider;
        private readonly ConcurrentQueue<(long tenantId, string channel, string message)> _messageQueue;
        private readonly CancellationTokenSource _cancellationTokenSource;
        private readonly Task _processingTask;

        public MessageSenderService(
            ILogger<MessageSenderService> logger,
            HttpClient httpClient,
            ICredentialProvider credentials,
            IBotAccountProvider bot,
            IServiceProvider serviceProvider)
        {
            _logger = logger;
            _httpClient = httpClient;
            _credentials = credentials;
            _bot = bot;
            _serviceProvider = serviceProvider;
            _messageQueue = new ConcurrentQueue<(long, string, string)>();
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
                _messageQueue.Enqueue((TenantAmbient.Current ?? 1, channel, message));
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
                _messageQueue.Enqueue((TenantAmbient.Current ?? 1, channel, message));
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
                        var (tenantId, channel, message) = messageData;
                        // El hilo consumidor no hereda el contexto de quien encolo: se vuelve a fijar el tenant de ese mensaje.
                        using (TenantAmbient.Push(tenantId))
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

                // Cuenta de bot del tenant (bot_twitch_id es necesario para el verified badge)
                var bot = await _bot.GetAsync();
                if (bot is null)
                {
                    _logger.LogWarning("No se pudo obtener la cuenta del bot para enviar a {Channel}", channel);
                    return;
                }
                var botTwitchId = bot.TwitchId;
                var accessToken = bot.AccessToken;

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

                request.Headers.Add("Client-ID", _credentials.GetTwitchApp().ClientId);
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
                    .Where(u => u.Login == channelName.ToLower())
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