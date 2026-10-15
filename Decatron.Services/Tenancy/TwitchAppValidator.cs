using Decatron.Core.Interfaces;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tenancy;

/// <summary>Valida client_id/client_secret pidiendo un App Access Token. El secreto va en el cuerpo y no se registra nunca.</summary>
public sealed class TwitchAppValidator : ITwitchAppValidator
{
    private readonly IHttpClientFactory _http;
    private readonly ILogger<TwitchAppValidator> _log;
    public TwitchAppValidator(IHttpClientFactory http, ILogger<TwitchAppValidator> log) { _http = http; _log = log; }

    public async Task<AppValidationResult> ValidateAsync(string clientId, string clientSecret, CancellationToken ct = default)
    {
        try
        {
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);
            using var res = await client.PostAsync("https://id.twitch.tv/oauth2/token", new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = clientId, ["client_secret"] = clientSecret, ["grant_type"] = "client_credentials",
            }), ct);
            if (res.IsSuccessStatusCode) return AppValidationResult.Ok;
            if ((int)res.StatusCode is 400 or 401 or 403) return AppValidationResult.InvalidCredentials;
            _log.LogWarning("Validacion de app de Twitch: respuesta inesperada {Status}", (int)res.StatusCode);
            return AppValidationResult.Unreachable;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _log.LogWarning("Validacion de app de Twitch: sin respuesta ({Type})", ex.GetType().Name);
            return AppValidationResult.Unreachable;
        }
    }
}
