using System.Text;
using System.Text.Json;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Platforms.Kick
{
    public class KickEventSubService : IKickEventSubService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<KickEventSubService> _logger;

        public KickEventSubService(IHttpClientFactory httpClientFactory, ILogger<KickEventSubService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public async Task<KickSubscriptionResult> SubscribeAsync(string kickId, string accessToken, string eventName, int version = 1)
        {
            if (string.IsNullOrEmpty(accessToken) || !long.TryParse(kickId, out var broadcasterId))
                return new KickSubscriptionResult(false, 0, "kickId o accessToken invalido");

            try
            {
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
                client.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));

                var existing = await client.GetAsync("https://api.kick.com/public/v1/events/subscriptions");
                if (existing.IsSuccessStatusCode)
                {
                    var content = await existing.Content.ReadAsStringAsync();
                    if (content.Contains(eventName))
                    {
                        _logger.LogInformation("[Kick EventSub] {KickId} ya tenia {EventName} activo", kickId, eventName);
                        return new KickSubscriptionResult(true, 200, content);
                    }
                }

                var payload = new
                {
                    method = "webhook",
                    broadcaster_user_id = broadcasterId,
                    events = new[] { new { name = eventName, version } }
                };

                var response = await client.PostAsync(
                    "https://api.kick.com/public/v1/events/subscriptions",
                    new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));

                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                    _logger.LogInformation("✅ [Kick EventSub] {EventName} suscripto para {KickId}: {Body}", eventName, kickId, responseBody);
                else
                    _logger.LogWarning("⚠️ [Kick EventSub] No se pudo suscribir a {EventName} {KickId}: {Status} {Body}", eventName, kickId, response.StatusCode, responseBody);

                return new KickSubscriptionResult(response.IsSuccessStatusCode, (int)response.StatusCode, responseBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick EventSub] Excepcion suscribiendo a {EventName} {KickId}", eventName, kickId);
                return new KickSubscriptionResult(false, 0, ex.Message);
            }
        }
    }
}
