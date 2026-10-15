using System.Net.Http.Headers;
using System.Text.Json;

namespace Decatron.Discord;

public enum DiscordTokenCheck { Ok, InvalidToken, Unreachable }
public sealed record DiscordBotIdentity(DiscordTokenCheck Result, string? BotId = null, string? BotName = null);

/// <summary>Comprueba un token de bot contra Discord (GET /users/@me) antes de guardarlo. El token nunca se registra.</summary>
public interface IDiscordBotValidator { Task<DiscordBotIdentity> ValidateAsync(string token, CancellationToken ct = default); }

public sealed class DiscordBotValidator : IDiscordBotValidator
{
    private readonly IHttpClientFactory _http;
    public DiscordBotValidator(IHttpClientFactory http) => _http = http;

    public async Task<DiscordBotIdentity> ValidateAsync(string token, CancellationToken ct = default)
    {
        try
        {
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);
            using var req = new HttpRequestMessage(HttpMethod.Get, "https://discord.com/api/v10/users/@me");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bot", token);
            using var res = await client.SendAsync(req, ct);
            if ((int)res.StatusCode is 401 or 403) return new DiscordBotIdentity(DiscordTokenCheck.InvalidToken);
            if (!res.IsSuccessStatusCode) return new DiscordBotIdentity(DiscordTokenCheck.Unreachable);
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            var root = doc.RootElement;
            // Un token de usuario (no de bot) no trae "bot": true; se rechaza aqui para no conectar una cuenta personal.
            if (!root.TryGetProperty("bot", out var isBot) || isBot.ValueKind != JsonValueKind.True) return new DiscordBotIdentity(DiscordTokenCheck.InvalidToken);
            var id = root.GetProperty("id").GetString();
            var name = root.TryGetProperty("username", out var u) ? u.GetString() : id;
            return new DiscordBotIdentity(DiscordTokenCheck.Ok, id, name);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException)
        {
            return new DiscordBotIdentity(DiscordTokenCheck.Unreachable);
        }
    }
}
