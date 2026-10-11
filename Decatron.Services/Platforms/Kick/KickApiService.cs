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

        public async Task<KickChannelInfo?> GetOwnChannelAsync(string accessToken)
        {
            if (string.IsNullOrEmpty(accessToken)) return null;
            // OJO: esta respuesta trae la clave de transmisión del streamer (stream.key). Solo se leen título y categoría y
            // el cuerpo nunca se loga (SendAsync solo lo loga si falla, y una falla no lo trae).
            var (ok, _, body) = await SendAsync(HttpMethod.Get, "channels", accessToken, null);
            if (!ok) return null;
            try
            {
                using var doc = JsonDocument.Parse(body);
                var first = doc.RootElement.GetProperty("data").EnumerateArray().FirstOrDefault();
                if (first.ValueKind != JsonValueKind.Object) return null;
                var title = first.TryGetProperty("stream_title", out var t) ? t.GetString() ?? "" : "";
                long catId = 0; var catName = "";
                if (first.TryGetProperty("category", out var c) && c.ValueKind == JsonValueKind.Object)
                {
                    catId = c.TryGetProperty("id", out var i) && i.TryGetInt64(out var v) ? v : 0;
                    catName = c.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                }
                return new KickChannelInfo(title, catId, catName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick API] No se pudo leer la respuesta de channels");
                return null;
            }
        }

        public async Task<KickUpdateResult> UpdateChannelAsync(string accessToken, string? streamTitle, long? categoryId)
        {
            var body = new Dictionary<string, object>();
            if (streamTitle != null) body["stream_title"] = streamTitle;
            if (categoryId.HasValue) body["category_id"] = categoryId.Value;
            if (body.Count == 0 || string.IsNullOrEmpty(accessToken)) return new KickUpdateResult(false, string.IsNullOrEmpty(accessToken));

            var (ok, status, _) = await SendAsync(new HttpMethod("PATCH"), "channels", accessToken, body);
            return new KickUpdateResult(ok, status is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden);
        }

        public async Task<List<KickCategory>> SearchCategoriesAsync(string accessToken, string name)
        {
            var found = new List<KickCategory>();
            if (string.IsNullOrEmpty(accessToken) || string.IsNullOrWhiteSpace(name)) return found;
            var q = Uri.EscapeDataString(name.Trim());

            // v2 (vigente): filtra por nombre (3 a 100 caracteres) y pone primero la coincidencia exacta
            if (name.Trim().Length >= 3)
            {
                var (ok2, _, body2) = await SendRawAsync(HttpMethod.Get, $"https://api.kick.com/public/v2/categories?name={q}&limit=25", accessToken);
                if (ok2) found = ParseCategories(body2);
            }
            // v1 (obsoleta, por texto): respaldo cuando la v2 no devuelve nada
            if (found.Count == 0)
            {
                var (ok1, _, body1) = await SendRawAsync(HttpMethod.Get, $"https://api.kick.com/public/v1/categories?q={q}", accessToken);
                if (ok1) found = ParseCategories(body1);
            }
            return found;
        }

        private static List<KickCategory> ParseCategories(string body)
        {
            var list = new List<KickCategory>();
            try
            {
                using var doc = JsonDocument.Parse(body);
                if (!doc.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array) return list;
                foreach (var e in data.EnumerateArray())
                {
                    if (!e.TryGetProperty("id", out var id) || !id.TryGetInt64(out var idv)) continue;
                    var nm = e.TryGetProperty("name", out var n) ? n.GetString() : null;
                    if (string.IsNullOrWhiteSpace(nm)) continue;
                    list.Add(new KickCategory(idv, nm!, e.TryGetProperty("thumbnail", out var th) ? th.GetString() : null));
                }
            }
            catch { /* respuesta ilegible: lista vacía */ }
            return list;
        }

        private async Task<(bool Ok, System.Net.HttpStatusCode Status, string Body)> SendRawAsync(HttpMethod method, string url, string accessToken)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var request = new HttpRequestMessage(method, url);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                request.Headers.UserAgent.ParseAdd("Decatron/1.0 (+https://decatron.net)");
                var response = await client.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                    _logger.LogWarning("[Kick API] {Method} {Url} -> {Status}", method, url, response.StatusCode);
                return (response.IsSuccessStatusCode, response.StatusCode, responseBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Kick API] Excepción en {Method} {Url}", method, url);
                return (false, System.Net.HttpStatusCode.InternalServerError, "");
            }
        }

        private async Task<(bool Ok, System.Net.HttpStatusCode Status, string Body)> SendAsync(HttpMethod method, string path, string accessToken, object? body)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var request = new HttpRequestMessage(method, $"https://api.kick.com/public/v1/{path}");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                request.Headers.UserAgent.ParseAdd("Decatron/1.0 (+https://decatron.net)");
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
