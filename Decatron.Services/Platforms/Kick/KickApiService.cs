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

        public async Task<bool> BanAsync(string accessToken, long broadcasterUserId, long userId, int? durationMinutes, string reason)
        {
            var body = new Dictionary<string, object>
            {
                ["broadcaster_user_id"] = broadcasterUserId,
                ["user_id"] = userId,
                ["reason"] = reason.Length > 100 ? reason[..100] : reason
            };
            if (durationMinutes.HasValue)
                body["duration"] = Math.Clamp(durationMinutes.Value, 1, 10080);

            var (ok, _, _) = await SendAsync(HttpMethod.Post, "moderation/bans", accessToken, body);
            return ok;
        }

        public async Task<bool?> UnbanAsync(string accessToken, long broadcasterUserId, long userId)
        {
            var (ok, status, responseBody) = await SendAsync(HttpMethod.Delete, "moderation/bans", accessToken,
                new { broadcaster_user_id = broadcasterUserId, user_id = userId });
            if (ok) return true;
            // Kick responde 400/404 cuando el usuario no está sancionado (el timeout ya venció)
            if (status is System.Net.HttpStatusCode.BadRequest or System.Net.HttpStatusCode.NotFound
                && responseBody.Contains("ban", StringComparison.OrdinalIgnoreCase))
                return false;
            return null;
        }

        public async Task<bool> DeleteMessageAsync(string accessToken, string messageId)
        {
            var (ok, _, _) = await SendAsync(HttpMethod.Delete, $"chat/{Uri.EscapeDataString(messageId)}", accessToken, null);
            return ok;
        }

        private async Task<(bool Ok, System.Net.HttpStatusCode Status, string Body)> SendAsync(HttpMethod method, string path, string accessToken, object? body)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var request = new HttpRequestMessage(method, $"https://api.kick.com/public/v1/{path}");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                if (body != null)
                    request.Content = new StringContent(JsonSerializer.Serialize(body), System.Text.Encoding.UTF8, "application/json");

                var response = await client.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                    _logger.LogWarning("[Kick API] {Method} {Path} -> {Status}: {Body}", method, path, response.StatusCode, responseBody);
                return (response.IsSuccessStatusCode, response.StatusCode, responseBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick API] Excepción en {Method} {Path}", method, path);
                return (false, System.Net.HttpStatusCode.InternalServerError, "");
            }
        }
    }
}
