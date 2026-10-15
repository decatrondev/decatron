using System.Collections.Concurrent;
using System.Text.Json;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tenancy;

/// <summary>
/// App Access Token (client_credentials) de la app de Twitch del tenant ambiente, cacheado por ClientId hasta poco antes de vencer.
/// Es el token con el que el bot de un tenant envía mensajes (igual que el #1, que lo guarda en bot_tokens).
/// </summary>
public sealed class TenantAppTokens
{
    private readonly IHttpClientFactory _http;
    private readonly ICredentialProvider _credentials;
    private readonly ILogger<TenantAppTokens> _log;
    private readonly ConcurrentDictionary<string, (string Token, DateTime Expires)> _cache = new();

    public TenantAppTokens(IHttpClientFactory http, ICredentialProvider credentials, ILogger<TenantAppTokens> log)
    { _http = http; _credentials = credentials; _log = log; }

    public async Task<string?> GetAsync(CancellationToken ct = default)
    {
        var app = _credentials.GetTwitchApp();
        if (_cache.TryGetValue(app.ClientId, out var hit) && hit.Expires > DateTime.UtcNow) return hit.Token;
        try
        {
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);
            using var res = await client.PostAsync("https://id.twitch.tv/oauth2/token", new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = app.ClientId, ["client_secret"] = app.ClientSecret ?? "", ["grant_type"] = "client_credentials",
            }), ct);
            if (!res.IsSuccessStatusCode) { _log.LogWarning("App token de tenant: Twitch respondio {Status}", (int)res.StatusCode); return null; }
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            var token = doc.RootElement.GetProperty("access_token").GetString();
            var secs = doc.RootElement.TryGetProperty("expires_in", out var e) ? e.GetInt32() : 3600;
            if (string.IsNullOrEmpty(token)) return null;
            _cache[app.ClientId] = (token, DateTime.UtcNow.AddSeconds(Math.Max(60, secs - 300)));
            return token;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _log.LogWarning("App token de tenant: sin respuesta ({Type})", ex.GetType().Name);
            return null;
        }
    }

    public void Invalidate(string clientId) => _cache.TryRemove(clientId, out _);
}
