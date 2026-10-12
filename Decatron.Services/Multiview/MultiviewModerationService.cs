using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Decatron.Core.Interfaces;
using Decatron.Core.Settings;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.Multiview
{
    /// <summary>Una acción de moderación pedida desde el Multi-view. Action: delete | timeout | ban | unban.</summary>
    public sealed record ModRequest(string Action, string Key, string? MessageId, string? TargetId, int? Seconds, string? Reason);

    /// <summary>
    /// Modera el chat de un canal COMO la persona que mira, con su propio token: borrar mensajes, timeout, ban y quitar
    /// la sanción. Solo si ya es moderador (o dueña) de ese canal: el rol viene de Twitch (USERSTATE al unirse al chat)
    /// o de Kick (su endpoint público de usuario del canal). La plataforma decide en última instancia; aquí solo se
    /// evita ofrecer lo que no se puede. Cada acción queda en el registro del servidor. Plan: MULTIVIEW_PLAN.md, Fase 4.
    /// </summary>
    public sealed class MultiviewModerationService
    {
        public const int MaxTimeoutSeconds = 1_209_600; // 14 días, el máximo de Twitch
        private const int ReasonMax = 100;
        private static readonly TimeSpan KickRoleTtl = TimeSpan.FromMinutes(5);
        private const string UserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

        private readonly MultiviewAccountService _accounts;
        private readonly TwitchPresenceService _presence;
        private readonly MultiviewChatService _chat;
        private readonly MultiviewStatusService _status;
        private readonly IServiceScopeFactory _scopes;
        private readonly IHttpClientFactory _http;
        private readonly IHubContext<MultiviewChatHub> _hub;
        private readonly TwitchSettings _twitch;
        private readonly ILogger<MultiviewModerationService> _logger;
        private readonly ConcurrentDictionary<string, (DateTime At, string Role)> _kickRoles = new();

        public MultiviewModerationService(MultiviewAccountService accounts, TwitchPresenceService presence, MultiviewChatService chat,
            MultiviewStatusService status, IServiceScopeFactory scopes, IHttpClientFactory http, IHubContext<MultiviewChatHub> hub,
            IOptions<TwitchSettings> twitch, ILogger<MultiviewModerationService> logger)
        {
            _accounts = accounts;
            _presence = presence;
            _chat = chat;
            _status = status;
            _scopes = scopes;
            _http = http;
            _hub = hub;
            _twitch = twitch.Value;
            _logger = logger;
        }

        /// <summary>Averigua el rol de la persona en un canal de Kick y se lo avisa a esa pestaña si puede moderar.</summary>
        public async Task NotifyKickRoleAsync(long userId, string connectionId, string key, string slug)
        {
            var role = await GetKickRoleAsync(userId, slug);
            if (role != "none") await _hub.Clients.Client(connectionId).SendAsync("Role", key, role);
        }

        private async Task<string> GetKickRoleAsync(long userId, string slug)
        {
            var cacheKey = $"{userId}:{slug}";
            if (_kickRoles.TryGetValue(cacheKey, out var hit) && DateTime.UtcNow - hit.At < KickRoleTtl) return hit.Role;
            var role = "none";
            try
            {
                var me = await _accounts.GetKickAsync(userId);
                if (me != null)
                {
                    var mySlug = me.Login.ToLowerInvariant().Replace('_', '-');
                    var client = _http.CreateClient();
                    client.Timeout = TimeSpan.FromSeconds(8);
                    using var req = new HttpRequestMessage(HttpMethod.Get, $"https://kick.com/api/v2/channels/{Uri.EscapeDataString(slug)}/users/{Uri.EscapeDataString(mySlug)}");
                    req.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
                    req.Headers.TryAddWithoutValidation("Accept", "application/json");
                    using var res = await client.SendAsync(req);
                    if (res.IsSuccessStatusCode)
                    {
                        using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync());
                        var root = doc.RootElement;
                        if (root.TryGetProperty("is_channel_owner", out var o) && o.ValueKind == JsonValueKind.True) role = "broadcaster";
                        else if (root.TryGetProperty("is_moderator", out var m) && m.ValueKind == JsonValueKind.True) role = "mod";
                    }
                }
            }
            catch (Exception ex) { _logger.LogDebug(ex, "[Multiview] No se pudo leer el rol en Kick de {UserId} en {Slug}", userId, slug); }
            _kickRoles[cacheKey] = (DateTime.UtcNow, role);
            return role;
        }

        public async Task<SendResult> ModerateAsync(long? userId, ModRequest req, CancellationToken ct = default)
        {
            if (userId == null) return new SendResult(false, "not_logged");
            if (!MultiviewChatService.TryParseKey((req.Key ?? "").Trim().ToLowerInvariant(), out var platform, out var channel)) return new SendResult(false, "failed");
            var action = (req.Action ?? "").ToLowerInvariant();
            if (action is not ("delete" or "timeout" or "ban" or "unban")) return new SendResult(false, "failed");
            if (action == "delete" ? string.IsNullOrEmpty(req.MessageId) : string.IsNullOrEmpty(req.TargetId)) return new SendResult(false, "failed");
            var reason = (req.Reason ?? "").Trim();
            if (reason.Length > ReasonMax) reason = reason[..ReasonMax];
            var seconds = Math.Clamp(req.Seconds ?? 600, 1, MaxTimeoutSeconds);

            try
            {
                var result = platform == "twitch"
                    ? await ModerateTwitchAsync(userId.Value, channel, action, req, reason, seconds, ct)
                    : await ModerateKickAsync(userId.Value, channel, action, req, reason, seconds, ct);
                _logger.LogInformation("[Multiview] Moderación {Action} de {UserId} en {Platform}:{Channel} sobre {Target}: {Result}",
                    action, userId, platform, channel, req.TargetId ?? req.MessageId, result.Ok ? "ok" : result.Code);
                return result;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "[Multiview] Falló una acción de moderación en {Platform}:{Channel}", platform, channel);
                return new SendResult(false, "failed");
            }
        }

        private async Task<SendResult> ModerateTwitchAsync(long userId, string channel, string action, ModRequest r, string reason, int seconds, CancellationToken ct)
        {
            var role = _presence.GetRole(userId, channel);
            if (role is not ("mod" or "broadcaster")) return new SendResult(false, "not_moderator");
            var me = await _accounts.GetTwitchAsync(userId);
            if (me == null) return new SendResult(false, "not_linked");
            var broadcasterId = _chat.TryGetTwitchRoomId(channel);
            if (broadcasterId == null) return new SendResult(false, "not_ready");

            var q = $"broadcaster_id={Uri.EscapeDataString(broadcasterId)}&moderator_id={Uri.EscapeDataString(me.TwitchId)}";
            HttpRequestMessage req;
            switch (action)
            {
                case "delete":
                    req = new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/moderation/chat?{q}&message_id={Uri.EscapeDataString(r.MessageId!)}");
                    break;
                case "unban":
                    req = new HttpRequestMessage(HttpMethod.Delete, $"https://api.twitch.tv/helix/moderation/bans?{q}&user_id={Uri.EscapeDataString(r.TargetId!)}");
                    break;
                default:
                    var data = new Dictionary<string, object> { ["user_id"] = r.TargetId! };
                    if (action == "timeout") data["duration"] = seconds;
                    if (reason.Length > 0) data["reason"] = reason;
                    req = new HttpRequestMessage(HttpMethod.Post, $"https://api.twitch.tv/helix/moderation/bans?{q}")
                    {
                        Content = new StringContent(JsonSerializer.Serialize(new { data }), Encoding.UTF8, "application/json")
                    };
                    break;
            }
            using (req)
            {
                req.Headers.Add("Client-Id", _twitch.ClientId);
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", me.Token);
                using var res = await _http.CreateClient().SendAsync(req, ct);
                if (res.IsSuccessStatusCode) return new SendResult(true);
                var message = ErrorMessage(await res.Content.ReadAsStringAsync(ct));
                // Twitch responde 401 cuando falta un permiso (scope): hay que volver a autorizar con los de moderación.
                if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    return new SendResult(false, message?.Contains("scope", StringComparison.OrdinalIgnoreCase) == true ? "reauth_mod" : "reauth");
                return new SendResult(false, (int)res.StatusCode == 403 ? "forbidden" : "failed", message);
            }
        }

        private async Task<SendResult> ModerateKickAsync(long userId, string channel, string action, ModRequest r, string reason, int seconds, CancellationToken ct)
        {
            var role = await GetKickRoleAsync(userId, channel);
            if (role is not ("mod" or "broadcaster")) return new SendResult(false, "not_moderator");
            var me = await _accounts.GetKickAsync(userId);
            if (me == null) return new SendResult(false, "not_linked");
            var info = await _status.GetKickAsync(channel, ct);
            if (info is not { Exists: true, UserId: { } broadcasterId }) return new SendResult(false, "not_ready");

            using var scope = _scopes.CreateScope();
            var kick = scope.ServiceProvider.GetRequiredService<IKickApiService>();
            switch (action)
            {
                case "delete":
                    return await kick.DeleteMessageAsync(me.Token, r.MessageId!) ? new SendResult(true) : new SendResult(false, "failed");
                case "unban":
                {
                    if (!long.TryParse(r.TargetId, out var target)) return new SendResult(false, "failed");
                    var ok = await kick.UnbanAsync(me.Token, broadcasterId, target);
                    return ok == true ? new SendResult(true) : new SendResult(false, ok == false ? "dropped" : "failed");
                }
                default:
                {
                    if (!long.TryParse(r.TargetId, out var target)) return new SendResult(false, "failed");
                    int? minutes = action == "timeout" ? Math.Max(1, (int)Math.Ceiling(seconds / 60.0)) : null;
                    return await kick.BanAsync(me.Token, broadcasterId, target, minutes, reason) ? new SendResult(true) : new SendResult(false, "failed");
                }
            }
        }

        private static string? ErrorMessage(string json)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                return doc.RootElement.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null;
            }
            catch (JsonException) { return null; }
        }
    }
}
