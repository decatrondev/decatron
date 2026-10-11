using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Decatron.Discord.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.DiscordServer;

// Lo mínimo de la API REST de Discord que necesita el cargador. A propósito NO hay ningún método que borre nada:
// el cargador solo lee, crea y completa; no puede destruir lo que ya existe.

public record GuildInfo(string Id, string Name, List<string> Features, int VerificationLevel, int ExplicitContentFilter,
    int DefaultMessageNotifications, string PreferredLocale, string? AfkChannelId, int AfkTimeout, string? SystemChannelId, int SystemChannelFlags,
    string? RulesChannelId, string? PublicUpdatesChannelId, string? SafetyAlertsChannelId = null);
public record RoleInfo(string Id, string Name, int Position, ulong Permissions, bool Managed);
public record ChannelInfo(string Id, string Name, int Type, string? ParentId, string? Topic, int Flags = 0);
public record BotInfo(string UserId, List<string> RoleIds);
public record AutoModRuleInfo(string Id, string Name);

public class DiscordApiException : Exception
{
    public int Status { get; }
    public int Code { get; }
    public DiscordApiException(int status, int code, string message) : base($"Discord {status}/{code}: {message}") { Status = status; Code = code; }
    /// <summary>403 / 50013: al bot le faltan permisos.</summary>
    public bool IsMissingPermissions => Status == 403 || Code == 50013;
}

public interface IDiscordRest
{
    Task<GuildInfo> GetGuildAsync(string guildId);
    Task<List<RoleInfo>> GetRolesAsync(string guildId);
    Task<List<ChannelInfo>> GetChannelsAsync(string guildId);
    Task<BotInfo> GetBotMemberAsync(string guildId);
    Task<List<AutoModRuleInfo>> GetAutoModRulesAsync(string guildId);

    Task<RoleInfo> CreateRoleAsync(string guildId, object body);
    Task SetRolePositionsAsync(string guildId, IEnumerable<(string Id, int Position)> positions);
    Task<ChannelInfo> CreateChannelAsync(string guildId, object body);
    Task ModifyChannelAsync(string channelId, object body);
    Task ModifyGuildAsync(string guildId, object body);
    Task<string> CreateMessageAsync(string channelId, string content);
    Task PinMessageAsync(string channelId, string messageId);
    Task<string> CreateAutoModRuleAsync(string guildId, object body);
}

/// <summary>Cliente REST con el token del bot. Respeta los límites de Discord (429) y reintenta unas pocas veces.</summary>
public class DiscordRest : IDiscordRest
{
    private const string Base = "https://discord.com/api/v10";
    private readonly IHttpClientFactory _http;
    private readonly string _token;
    private readonly ILogger<DiscordRest> _logger;

    public DiscordRest(IHttpClientFactory http, IOptions<DiscordSettings> settings, ILogger<DiscordRest> logger)
    {
        _http = http;
        _token = settings.Value.BotToken;
        _logger = logger;
    }

    private async Task<JsonDocument> SendAsync(HttpMethod method, string path, object? body = null)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var client = _http.CreateClient();
            var req = new HttpRequestMessage(method, Base + path);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bot", _token);
            req.Headers.UserAgent.ParseAdd("DiscordBot (https://decatron.net, 1.0)");
            if (body != null) req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            var resp = await client.SendAsync(req);
            var text = await resp.Content.ReadAsStringAsync();

            if (resp.StatusCode == HttpStatusCode.TooManyRequests)
            {
                var wait = 1.0;
                try { wait = JsonDocument.Parse(text).RootElement.GetProperty("retry_after").GetDouble(); } catch { /* 1 s */ }
                _logger.LogWarning("[Discord] Límite de ritmo en {Path}: se espera {Wait:F1} s", path, wait);
                await Task.Delay(TimeSpan.FromSeconds(Math.Min(wait, 30) + 0.2));
                continue;
            }
            if (!resp.IsSuccessStatusCode)
            {
                int code = 0; var msg = text;
                try { var j = JsonDocument.Parse(text).RootElement; code = j.TryGetProperty("code", out var c) ? c.GetInt32() : 0; msg = j.TryGetProperty("message", out var m) ? m.GetString() ?? text : text; } catch { /* texto crudo */ }
                throw new DiscordApiException((int)resp.StatusCode, code, msg);
            }
            return string.IsNullOrWhiteSpace(text) ? JsonDocument.Parse("{}") : JsonDocument.Parse(text);
        }
        throw new DiscordApiException(429, 0, "Demasiados reintentos por límite de ritmo");
    }

    private static string? Str(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    private static int Int(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : 0;

    public async Task<GuildInfo> GetGuildAsync(string guildId)
    {
        using var d = await SendAsync(HttpMethod.Get, $"/guilds/{guildId}");
        var g = d.RootElement;
        var features = g.TryGetProperty("features", out var f) ? f.EnumerateArray().Select(x => x.GetString() ?? "").ToList() : new List<string>();
        return new GuildInfo(Str(g, "id")!, Str(g, "name") ?? "", features, Int(g, "verification_level"), Int(g, "explicit_content_filter"),
            Int(g, "default_message_notifications"), Str(g, "preferred_locale") ?? "en-US", Str(g, "afk_channel_id"), Int(g, "afk_timeout"),
            Str(g, "system_channel_id"), Int(g, "system_channel_flags"), Str(g, "rules_channel_id"), Str(g, "public_updates_channel_id"), Str(g, "safety_alerts_channel_id"));
    }

    public async Task<List<RoleInfo>> GetRolesAsync(string guildId)
    {
        using var d = await SendAsync(HttpMethod.Get, $"/guilds/{guildId}/roles");
        return d.RootElement.EnumerateArray().Select(r => new RoleInfo(Str(r, "id")!, Str(r, "name") ?? "", Int(r, "position"),
            ulong.TryParse(Str(r, "permissions"), out var p) ? p : 0, r.TryGetProperty("managed", out var m) && m.ValueKind == JsonValueKind.True)).ToList();
    }

    public async Task<List<ChannelInfo>> GetChannelsAsync(string guildId)
    {
        using var d = await SendAsync(HttpMethod.Get, $"/guilds/{guildId}/channels");
        return d.RootElement.EnumerateArray().Select(c => new ChannelInfo(Str(c, "id")!, Str(c, "name") ?? "", Int(c, "type"), Str(c, "parent_id"), Str(c, "topic"), Int(c, "flags"))).ToList();
    }

    public async Task<BotInfo> GetBotMemberAsync(string guildId)
    {
        using var me = await SendAsync(HttpMethod.Get, "/users/@me");
        var id = Str(me.RootElement, "id")!;
        using var m = await SendAsync(HttpMethod.Get, $"/guilds/{guildId}/members/{id}");
        var roles = m.RootElement.TryGetProperty("roles", out var r) ? r.EnumerateArray().Select(x => x.GetString() ?? "").ToList() : new List<string>();
        return new BotInfo(id, roles);
    }

    public async Task<List<AutoModRuleInfo>> GetAutoModRulesAsync(string guildId)
    {
        try
        {
            using var d = await SendAsync(HttpMethod.Get, $"/guilds/{guildId}/auto-moderation/rules");
            return d.RootElement.EnumerateArray().Select(r => new AutoModRuleInfo(Str(r, "id")!, Str(r, "name") ?? "")).ToList();
        }
        catch (DiscordApiException ex) when (ex.IsMissingPermissions) { return new List<AutoModRuleInfo>(); }
    }

    public async Task<RoleInfo> CreateRoleAsync(string guildId, object body)
    {
        using var d = await SendAsync(HttpMethod.Post, $"/guilds/{guildId}/roles", body);
        var r = d.RootElement;
        return new RoleInfo(Str(r, "id")!, Str(r, "name") ?? "", Int(r, "position"), ulong.TryParse(Str(r, "permissions"), out var p) ? p : 0, false);
    }

    public async Task SetRolePositionsAsync(string guildId, IEnumerable<(string Id, int Position)> positions)
    {
        using var _ = await SendAsync(new HttpMethod("PATCH"), $"/guilds/{guildId}/roles", positions.Select(p => new { id = p.Id, position = p.Position }).ToList());
    }

    public async Task<ChannelInfo> CreateChannelAsync(string guildId, object body)
    {
        using var d = await SendAsync(HttpMethod.Post, $"/guilds/{guildId}/channels", body);
        var c = d.RootElement;
        return new ChannelInfo(Str(c, "id")!, Str(c, "name") ?? "", Int(c, "type"), Str(c, "parent_id"), Str(c, "topic"), Int(c, "flags"));
    }

    public async Task ModifyChannelAsync(string channelId, object body)
    {
        using var _ = await SendAsync(new HttpMethod("PATCH"), $"/channels/{channelId}", body);
    }

    public async Task ModifyGuildAsync(string guildId, object body)
    {
        using var _ = await SendAsync(new HttpMethod("PATCH"), $"/guilds/{guildId}", body);
    }

    public async Task<string> CreateMessageAsync(string channelId, string content)
    {
        // allowed_mentions vacío: un texto del servidor nunca debe mencionar a nadie
        using var d = await SendAsync(HttpMethod.Post, $"/channels/{channelId}/messages", new { content, allowed_mentions = new { parse = Array.Empty<string>() } });
        return Str(d.RootElement, "id")!;
    }

    public async Task PinMessageAsync(string channelId, string messageId)
    {
        using var _ = await SendAsync(HttpMethod.Put, $"/channels/{channelId}/pins/{messageId}");
    }

    public async Task<string> CreateAutoModRuleAsync(string guildId, object body)
    {
        using var d = await SendAsync(HttpMethod.Post, $"/guilds/{guildId}/auto-moderation/rules", body);
        return Str(d.RootElement, "id")!;
    }
}
