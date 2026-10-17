using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Decatron.Services;

/// <summary>Verifica el desafio de Cloudflare Turnstile. Las claves se leen en cada llamada (el archivo de secretos se recarga solo).</summary>
public sealed class TurnstileVerifier
{
    private readonly IConfiguration _cfg;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<TurnstileVerifier> _log;
    public TurnstileVerifier(IConfiguration cfg, IHttpClientFactory http, ILogger<TurnstileVerifier> log) { _cfg = cfg; _http = http; _log = log; }

    public string SiteKey => _cfg["Turnstile:SiteKey"] ?? "";
    public bool Enabled => (_cfg["Turnstile:SecretKey"] ?? "").Length > 0 && SiteKey.Length > 0;

    /// <summary>Si el servicio no responde se rechaza (mas seguro que dejar pasar). Si Turnstile esta apagado, deja pasar.</summary>
    public async Task<bool> VerifyAsync(string? token, string? remoteIp)
    {
        if (!Enabled) return true;
        if (string.IsNullOrWhiteSpace(token) || token.Length > 2048) return false;
        try
        {
            var form = new Dictionary<string, string> { ["secret"] = _cfg["Turnstile:SecretKey"]!, ["response"] = token };
            if (!string.IsNullOrWhiteSpace(remoteIp)) form["remoteip"] = remoteIp;
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(8);
            using var res = await client.PostAsync("https://challenges.cloudflare.com/turnstile/v0/siteverify", new FormUrlEncodedContent(form));
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            return doc.RootElement.TryGetProperty("success", out var ok) && ok.GetBoolean();
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "No se pudo verificar Turnstile");
            return false;
        }
    }
}
