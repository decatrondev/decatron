using System.Net.Http.Headers;
using System.Text.Json;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Platforms.Kick
{
    public class KickApiService : IKickApiService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<KickApiService> _logger;

        public KickApiService(IHttpClientFactory httpClientFactory, ILogger<KickApiService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public async Task<List<KickReward>> GetChannelRewardsAsync(string accessToken)
        {
            if (string.IsNullOrEmpty(accessToken))
                return new List<KickReward>();

            try
            {
                var client = _httpClientFactory.CreateClient();
                var request = new HttpRequestMessage(HttpMethod.Get, "https://api.kick.com/public/v1/channels/rewards");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

                var response = await client.SendAsync(request);
                var body = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("[Kick API] GET channels/rewards -> {Status}: {Body}", response.StatusCode, body);
                    return new List<KickReward>();
                }

                var result = JsonSerializer.Deserialize<KickRewardsResponse>(body);
                return result?.Data ?? new List<KickReward>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick API] Excepcion obteniendo channel rewards");
                return new List<KickReward>();
            }
        }
    }
}
