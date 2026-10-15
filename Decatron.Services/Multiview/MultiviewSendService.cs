using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Decatron.Core.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.Multiview
{
    /// <summary>Resultado de intentar escribir. Code: not_logged, not_linked, reauth, too_long, empty, rate_limited, not_ready, forbidden, dropped, failed.</summary>
    public sealed record SendResult(bool Ok, string? Code = null, string? Detail = null);

    /// <summary>
    /// Escribe en el chat de Twitch o de Kick COMO la persona que mira (con su propio token, no con el del bot). Es lo
    /// mismo que escribir en el chat normal: si el canal está en modo solo seguidores, lento o la persona está baneada,
    /// la plataforma rechaza el mensaje y se le explica por qué. Plan: .dev/plans/MULTIVIEW_PLAN.md, Fase 3.
    /// </summary>
    public sealed class MultiviewSendService
    {
        public const int MaxLength = 500;
        private const int BurstLimit = 15;
        private static readonly TimeSpan BurstWindow = TimeSpan.FromSeconds(30);

        private readonly MultiviewAccountService _accounts;
        private readonly MultiviewStatusService _status;
        private readonly MultiviewChatService _chat;
        private readonly IHttpClientFactory _http;
        private readonly Decatron.Core.Interfaces.ICredentialProvider _credentials;
        private readonly ILogger<MultiviewSendService> _logger;
        private readonly ConcurrentDictionary<long, Queue<DateTime>> _recent = new();

        public MultiviewSendService(MultiviewAccountService accounts, MultiviewStatusService status, MultiviewChatService chat,
            IHttpClientFactory http, Decatron.Core.Interfaces.ICredentialProvider credentials, ILogger<MultiviewSendService> logger)
        {
            _accounts = accounts;
            _status = status;
            _chat = chat;
            _http = http;
            _credentials = credentials;
            _logger = logger;
        }

        public async Task<SendResult> SendAsync(long? userId, string key, string? text, string? replyTo, CancellationToken ct = default)
        {
            if (userId == null) return new SendResult(false, "not_logged");
            text = (text ?? "").Trim();
            if (text.Length == 0) return new SendResult(false, "empty");
            if (text.Length > MaxLength) return new SendResult(false, "too_long");
            if (!MultiviewChatService.TryParseKey(key, out var platform, out var channel)) return new SendResult(false, "failed");
            if (!AllowBurst(userId.Value)) return new SendResult(false, "rate_limited");

            try
            {
                return platform == "twitch"
                    ? await SendTwitchAsync(userId.Value, channel, text, replyTo, ct)
                    : await SendKickAsync(userId.Value, channel, text, replyTo, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "[Multiview] No se pudo enviar un mensaje a {Key}", key);
                return new SendResult(false, "failed");
            }
        }

        private bool AllowBurst(long userId)
        {
            var q = _recent.GetOrAdd(userId, _ => new Queue<DateTime>());
            var now = DateTime.UtcNow;
            lock (q)
            {
                while (q.Count > 0 && now - q.Peek() > BurstWindow) q.Dequeue();
                if (q.Count >= BurstLimit) return false;
                q.Enqueue(now);
                return true;
            }
        }

        private async Task<SendResult> SendTwitchAsync(long userId, string channel, string text, string? replyTo, CancellationToken ct)
        {
            var me = await _accounts.GetTwitchAsync(userId);
            if (me == null) return new SendResult(false, "not_linked");
            var broadcasterId = _chat.TryGetTwitchRoomId(channel);
            if (broadcasterId == null) return new SendResult(false, "not_ready");

            var body = new Dictionary<string, object?> { ["broadcaster_id"] = broadcasterId, ["sender_id"] = me.TwitchId, ["message"] = text };
            if (!string.IsNullOrEmpty(replyTo)) body["reply_parent_message_id"] = replyTo;

            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.twitch.tv/helix/chat/messages")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };
            req.Headers.Add("Client-Id", _credentials.GetTwitchApp().ClientId);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", me.Token);
            using var res = await _http.CreateClient().SendAsync(req, ct);
            var json = await res.Content.ReadAsStringAsync(ct);

            if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized) return new SendResult(false, "reauth");
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogInformation("[Multiview] Twitch rechazó el mensaje de {UserId} en {Channel}: {Status}", userId, channel, (int)res.StatusCode);
                return new SendResult(false, (int)res.StatusCode == 403 ? "forbidden" : "failed", ErrorMessage(json));
            }

            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array && data.GetArrayLength() > 0)
            {
                var first = data[0];
                if (first.TryGetProperty("is_sent", out var sent) && sent.ValueKind == JsonValueKind.True) return new SendResult(true);
                string? why = first.TryGetProperty("drop_reason", out var drop) && drop.ValueKind == JsonValueKind.Object && drop.TryGetProperty("message", out var m) ? m.GetString() : null;
                return new SendResult(false, "dropped", why);
            }
            return new SendResult(false, "failed");
        }

        private async Task<SendResult> SendKickAsync(long userId, string channel, string text, string? replyTo, CancellationToken ct)
        {
            var me = await _accounts.GetKickAsync(userId);
            if (me == null) return new SendResult(false, "not_linked");
            var info = await _status.GetKickAsync(channel, ct);
            if (info is not { Exists: true, UserId: { } broadcasterId }) return new SendResult(false, "not_ready");

            var body = new Dictionary<string, object?> { ["broadcaster_user_id"] = broadcasterId, ["content"] = text, ["type"] = "user" };
            if (!string.IsNullOrEmpty(replyTo)) body["reply_to_message_id"] = replyTo;

            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.kick.com/public/v1/chat")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", me.Token);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            using var res = await _http.CreateClient().SendAsync(req, ct);
            var json = await res.Content.ReadAsStringAsync(ct);

            if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized) return new SendResult(false, "reauth");
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogInformation("[Multiview] Kick rechazó el mensaje de {UserId} en {Channel}: {Status}", userId, channel, (int)res.StatusCode);
                return new SendResult(false, (int)res.StatusCode == 403 ? "forbidden" : "failed", ErrorMessage(json));
            }
            return new SendResult(true);
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
