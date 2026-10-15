using System.Collections.Concurrent;
using System.Text.Json;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Plataforma, Fase 4: token de USUARIO de la cuenta de bot del tenant ambiente (el que piden los endpoints de moderación de Helix),
/// con refresco automático contra Twitch usando la app del tenant. El #1 no pasa por aquí (su token vive en bot_tokens y lo renueva
/// BotTokenRefreshService). Falla cerrado: sin bot o sin app del tenant devuelve null, nunca el token del #1.
/// </summary>
public sealed class TenantBotUserToken
{
    private static readonly TimeSpan Margin = TimeSpan.FromMinutes(5);
    private readonly ITenantCredentialStore _store;
    private readonly ICredentialProvider _credentials;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<TenantBotUserToken> _log;
    private readonly ConcurrentDictionary<long, SemaphoreSlim> _locks = new();

    public TenantBotUserToken(ITenantCredentialStore store, ICredentialProvider credentials, IHttpClientFactory http, ILogger<TenantBotUserToken> log)
    { _store = store; _credentials = credentials; _http = http; _log = log; }

    public async Task<string?> GetAsync(CancellationToken ct = default)
    {
        var tenant = TenantAmbient.Current ?? 1;
        if (tenant == 1) return null;
        var gate = _locks.GetOrAdd(tenant, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            var tokens = await _store.GetTwitchBotTokensAsync(tenant, "moderation", ct);
            if (tokens is null) { _log.LogWarning("Tenant {Tenant} sin cuenta de bot propia: no hay token de moderacion", tenant); return null; }
            var fresh = tokens.ExpiresAt is { } e && e - DateTimeOffset.UtcNow > Margin;
            // Sin fecha de vencimiento conocida se asume vigente solo si no hay con que refrescar
            if (fresh || (tokens.ExpiresAt is null && string.IsNullOrEmpty(tokens.RefreshToken))) return tokens.AccessToken;
            if (string.IsNullOrEmpty(tokens.RefreshToken)) return null; // vencido y sin refresh: el dueño debe volver a autorizar
            return (await RefreshAsync(tenant, tokens.RefreshToken, ct))?.AccessToken;
        }
        finally { gate.Release(); }
    }

    private async Task<TwitchBotTokens?> RefreshAsync(long tenant, string refreshToken, CancellationToken ct)
    {
        TwitchAppCredentials app;
        try { app = _credentials.GetTwitchApp(); }
        catch (CredentialsNotConfiguredException) { return null; }
        try
        {
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);
            using var res = await client.PostAsync("https://id.twitch.tv/oauth2/token", new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = app.ClientId, ["client_secret"] = app.ClientSecret ?? "", ["grant_type"] = "refresh_token", ["refresh_token"] = refreshToken,
            }), ct);
            if (!res.IsSuccessStatusCode)
            {
                _log.LogWarning("Refresco del bot del tenant {Tenant}: Twitch respondio {Status} (si es 400/401 hay que volver a autorizar el bot)", tenant, (int)res.StatusCode);
                return null;
            }
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            var access = doc.RootElement.GetProperty("access_token").GetString();
            var newRefresh = doc.RootElement.TryGetProperty("refresh_token", out var r) ? r.GetString() : null;
            var secs = doc.RootElement.TryGetProperty("expires_in", out var x) ? x.GetInt32() : 3600;
            if (string.IsNullOrEmpty(access)) return null;
            var tokens = new TwitchBotTokens(access, string.IsNullOrEmpty(newRefresh) ? refreshToken : newRefresh, DateTimeOffset.UtcNow.AddSeconds(secs));
            await _store.UpdateTwitchBotTokensAsync(tenant, tokens, ct);
            _log.LogInformation("bot.token.refreshed tenant={Tenant} expiresIn={Secs}", tenant, secs);
            return tokens;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _log.LogWarning("Refresco del bot del tenant {Tenant}: sin respuesta ({Type})", tenant, ex.GetType().Name);
            return null;
        }
    }
}
