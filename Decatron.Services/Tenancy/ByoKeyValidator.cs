using System.Net;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text.Json;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Prueba una llave con una llamada de solo lectura al proveedor (sin gastar créditos) y valida la configuración. La URL base de la IA debe ser
/// https y no apuntar a la red interna del servidor (la dirección se resuelve y se rechazan loopback, privadas y link-local).
/// </summary>
public sealed class ByoKeyValidator : IByoKeyValidator
{
    private readonly IHttpClientFactory _http;
    private readonly ILogger<ByoKeyValidator> _log;
    public ByoKeyValidator(IHttpClientFactory http, ILogger<ByoKeyValidator> log) { _http = http; _log = log; }

    public static bool IsPrivate(IPAddress ip)
    {
        if (IPAddress.IsLoopback(ip)) return true;
        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
            return ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6UniqueLocal || ip.Equals(IPAddress.IPv6Any) || (ip.IsIPv4MappedToIPv6 && IsPrivate(ip.MapToIPv4()));
        var b = ip.GetAddressBytes();
        return b[0] == 10 || b[0] == 0 || b[0] == 127 || (b[0] == 172 && b[1] >= 16 && b[1] <= 31) || (b[0] == 192 && b[1] == 168) || (b[0] == 169 && b[1] == 254) || (b[0] == 100 && b[1] >= 64 && b[1] <= 127);
    }

    /// <summary>https, sin usuario en la URL y con un host público.</summary>
    public static async Task<Uri?> SafeBaseUrlAsync(string? raw, CancellationToken ct)
    {
        if (!Uri.TryCreate(raw?.Trim().TrimEnd('/'), UriKind.Absolute, out var u) || u.Scheme != Uri.UriSchemeHttps || !string.IsNullOrEmpty(u.UserInfo)) return null;
        if (u.HostNameType == UriHostNameType.Dns && (u.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || !u.Host.Contains('.'))) return null;
        try
        {
            var addrs = IPAddress.TryParse(u.Host, out var lit) ? new[] { lit } : await Dns.GetHostAddressesAsync(u.Host, ct);
            return addrs.Length == 0 || addrs.Any(IsPrivate) ? null : u;
        }
        catch (Exception ex) when (ex is SocketException or ArgumentException) { return null; }
    }

    public async Task<ByoCheck> ValidateAsync(string provider, string apiKey, IReadOnlyDictionary<string, string> config, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Length < 8 || apiKey.Length > 300 || apiKey.Any(char.IsWhiteSpace)) return ByoCheck.BadConfig;
        HttpRequestMessage req;
        switch (provider)
        {
            case ByoProviders.Ai:
                var baseUrl = await SafeBaseUrlAsync(config.GetValueOrDefault("base_url"), ct);
                if (baseUrl is null || string.IsNullOrWhiteSpace(config.GetValueOrDefault("model"))) return ByoCheck.BadConfig;
                req = new HttpRequestMessage(HttpMethod.Get, baseUrl + "/models");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                break;
            case ByoProviders.Deepgram:
                req = new HttpRequestMessage(HttpMethod.Get, "https://api.deepgram.com/v1/projects");
                req.Headers.Authorization = new AuthenticationHeaderValue("Token", apiKey);
                break;
            case ByoProviders.FishAudio:
                if (config.TryGetValue("voices", out var voices) && !VoicesValid(voices)) return ByoCheck.BadConfig;
                req = new HttpRequestMessage(HttpMethod.Get, "https://api.fish.audio/wallet/self/api-credit");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                break;
            default: return ByoCheck.BadConfig;
        }
        try
        {
            using var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);
            using var res = await client.SendAsync(req, ct);
            if (res.IsSuccessStatusCode) return ByoCheck.Ok;
            if (res.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) return ByoCheck.Rejected;
            _log.LogWarning("byo.validate.unexpected provider={Provider} status={Status}", provider, (int)res.StatusCode);
            return ByoCheck.Unreachable;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _log.LogWarning("byo.validate.unreachable provider={Provider} {Type}", provider, ex.GetType().Name);
            return ByoCheck.Unreachable;
        }
    }

    /// <summary>voices = JSON [{"name":"Toji","referenceId":"…"}], hasta 50 voces con nombre y referencia razonables.</summary>
    public static bool VoicesValid(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array || doc.RootElement.GetArrayLength() > 50) return false;
            foreach (var v in doc.RootElement.EnumerateArray())
            {
                var name = v.TryGetProperty("name", out var n) ? n.GetString() : null;
                var rid = v.TryGetProperty("referenceId", out var r) ? r.GetString() : null;
                if (string.IsNullOrWhiteSpace(name) || name.Length > 40 || string.IsNullOrWhiteSpace(rid) || rid.Length > 64 || !rid.All(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_')) return false;
            }
            return true;
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException) { return false; }
    }
}
