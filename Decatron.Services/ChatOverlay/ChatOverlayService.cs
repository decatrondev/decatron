using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Decatron.Core.Interfaces;
using Decatron.Services.Accounts;
using Decatron.Data;
using Decatron.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Decatron.Services.ChatOverlay
{
    /// <summary>
    /// Lleva el chat al overlay: toma el mensaje de Twitch (EventSub) o de Kick (webhook), lo filtra según
    /// la configuración del canal y la lista de bots, resuelve emotes e insignias y lo emite por SignalR
    /// al grupo del canal. Si no hay ningún overlay de chat conectado, no hace nada.
    /// Plan: .dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 1.
    /// </summary>
    public class ChatOverlayService
    {
        public const string OverlayType = "chat";
        private static readonly TimeSpan ConfigTtl = TimeSpan.FromSeconds(30);
        private static readonly Regex KickEmoteTag = new(@"\[emote:(\d+):([^\]]*)\]", RegexOptions.Compiled);

        private readonly IHubContext<OverlayHub> _hub;
        private readonly IServiceScopeFactory _scopes;
        private readonly IBotListService _bots;
        private readonly AccountChannelResolver _accounts;
        private readonly EmoteCatalogService _emotes;
        private readonly ChatBadgeService _badges;
        private readonly ILogger<ChatOverlayService> _logger;

        /// <summary>
        /// A qué cuenta pertenece un mensaje. UserId y Login son los de la fila principal (su config y su grupo de
        /// SignalR); TwitchId y KickId son los de toda la cuenta (para juntar los emotes de los dos canales);
        /// OriginUserId es la fila por la que entró el mensaje (su lista de bots).
        /// </summary>
        private sealed record Target(long UserId, string Login, string? TwitchId, string? KickId, long OriginUserId);

        /// <summary>El canal de chat de una cuenta, tal como lo ve el panel</summary>
        public sealed record ChatChannel(string Login, string? TwitchId, string? KickId, long PrincipalUserId, bool HasTwitch, bool HasKick);
        private readonly ConcurrentDictionary<long, (DateTime At, ChatOverlayServerConfig Config)> _configs = new();

        public ChatOverlayService(IHubContext<OverlayHub> hub, IServiceScopeFactory scopes, IBotListService bots,
            AccountChannelResolver accounts, EmoteCatalogService emotes, ChatBadgeService badges, ILogger<ChatOverlayService> logger)
        {
            _hub = hub;
            _scopes = scopes;
            _bots = bots;
            _accounts = accounts;
            _emotes = emotes;
            _badges = badges;
            _logger = logger;
        }

        public void InvalidateConfig(long userId) => _configs.TryRemove(userId, out _);

        /// <summary>La cuenta de un usuario (para endpoints que ya conocen el user_id): login de la fila principal e ids de toda la cuenta</summary>
        public async Task<ChatChannel?> GetChannelAsync(long userId)
        {
            var account = await _accounts.ResolveByUserIdAsync(userId);
            return account == null ? null
                : new ChatChannel(account.OverlayKey, account.TwitchId, account.KickId, account.Principal.UserId, account.HasTwitch, account.HasKick);
        }

        public Task RefreshEmotesAsync(string? twitchId, string? kickId)
        {
            _emotes.Refresh(twitchId, kickId);
            return Task.CompletedTask;
        }

        // ═══════════════════════════════════════════════════════════════
        // TWITCH
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Un mensaje de Twitch tal como lo arma <c>EventSubNotificationHandler</c> (forma de channel.chat.message)</summary>
        public async Task PublishTwitchAsync(JObject e)
        {
            try
            {
                var broadcasterId = e.Value<string>("broadcaster_user_id");
                var broadcasterLogin = e.Value<string>("broadcaster_user_login")?.ToLowerInvariant();
                var messageId = e.Value<string>("message_id");
                var chatterLogin = (e.Value<string>("chatter_user_login") ?? "").ToLowerInvariant();
                if (string.IsNullOrEmpty(broadcasterLogin) || string.IsNullOrEmpty(messageId) || string.IsNullOrEmpty(chatterLogin))
                    return;

                var target = ToTarget(await _accounts.ResolveLoginAsync(broadcasterLogin));
                if (target == null || !HasOverlay(target.Login)) return;

                var cfg = await GetConfigAsync(target.UserId);
                if (!cfg.Twitch) return;

                // Chat compartido: el mensaje llega al canal anfitrión con el canal de origen aparte
                var sourceId = e.Value<string>("source_broadcaster_user_id");
                var shared = !string.IsNullOrEmpty(sourceId) && sourceId != broadcasterId;
                var originId = shared ? sourceId! : broadcasterId ?? "";
                var originLogin = shared ? (e.Value<string>("source_broadcaster_user_login") ?? "").ToLowerInvariant() : broadcasterLogin;
                var originName = shared ? (e.Value<string>("source_broadcaster_user_name") ?? originLogin) : (e.Value<string>("broadcaster_user_name") ?? broadcasterLogin);
                if (shared && (!cfg.SharedAll || cfg.HiddenChannels.Contains(originLogin))) return;

                if (cfg.HideBots)
                {
                    var fx = await _bots.GetEffectsAsync("twitch", target.OriginUserId, chatterLogin);
                    if (fx is { HideOverlay: true }) return;
                }

                var text = e["message"]?["text"]?.ToString() ?? "";
                if (!PassesFilters(cfg, chatterLogin, text, RolesFromBadges(e["badges"] as JArray))) return;

                // Los emotes del canal de origen mandan sobre los del anfitrión en sus mensajes
                var lookups = new List<IReadOnlyDictionary<string, EmoteInfo>>();
                if (shared && cfg.SharedChannelEmotes)
                    lookups.Add(await _emotes.GetMapAsync(originId, null, cfg.Providers));
                lookups.Add(await _emotes.GetMapAsync(target.TwitchId, target.KickId, cfg.Providers));

                var parts = new List<ChatPart>();
                if (e["message"]?["fragments"] is JArray fragments && fragments.Count > 0)
                {
                    foreach (var f in fragments)
                    {
                        var type = f["type"]?.ToString();
                        var ftext = f["text"]?.ToString() ?? "";
                        if (type == "emote" && f["emote"]?["id"]?.ToString() is { Length: > 0 } emoteId)
                        {
                            var animated = (f["emote"]?["format"] as JArray)?.Any(x => x.ToString() == "animated") == true;
                            parts.Add(new ChatPart("emote", N: ftext, U: TwitchEmoteUrl(emoteId, animated), A: animated, P: "twitch"));
                        }
                        else if (type == "cheermote" && f["cheermote"] is JObject cheer)
                        {
                            var prefix = (cheer.Value<string>("prefix") ?? ftext).ToLowerInvariant();
                            var tier = cheer.Value<int?>("tier") ?? 1;
                            parts.Add(new ChatPart("cheer", N: cheer.Value<string>("prefix") ?? ftext,
                                U: $"https://d3aqoihi2n8ty8.cloudfront.net/actions/{Uri.EscapeDataString(prefix)}/dark/animated/{tier}/2.gif",
                                A: true, B: cheer.Value<int?>("bits")));
                        }
                        else
                        {
                            Tokenize(parts, ftext, lookups, cfg.HiddenEmotes);
                        }
                    }
                }
                else
                {
                    Tokenize(parts, text, lookups, cfg.HiddenEmotes);
                }
                if (parts.Count == 0) return;

                var badgeSource = shared && e["source_badges"] is JArray sb && sb.Count > 0 ? sb : e["badges"] as JArray;
                var badges = new List<ChatBadgeDto>();
                if (badgeSource != null)
                {
                    foreach (var b in badgeSource)
                    {
                        var setId = b["set_id"]?.ToString();
                        var version = b["id"]?.ToString() ?? "";
                        if (string.IsNullOrEmpty(setId)) continue;
                        var image = await _badges.ResolveAsync(originId, setId, version);
                        if (image != null) badges.Add(new ChatBadgeDto($"{setId}/{version}", image.Url, image.Title, null));
                    }
                }

                ChatReplyDto? reply = null;
                if (e["reply"] is JObject r && !string.IsNullOrEmpty(r.Value<string>("parent_user_name")))
                    reply = new ChatReplyDto(r.Value<string>("parent_user_name")!, Truncate(r.Value<string>("parent_message_body") ?? "", 120));

                var message = new ChatOverlayMessage(
                    messageId, "twitch",
                    new ChatOriginDto(originId, originLogin, originName, shared),
                    new ChatUserDto(chatterLogin, e.Value<string>("chatter_user_name") ?? chatterLogin, e.Value<string>("chatter_user_id") ?? "",
                        string.IsNullOrWhiteSpace(e.Value<string>("color")) ? null : e.Value<string>("color")),
                    badges, parts,
                    Highlight: e.Value<string>("message_type") == "channel_points_highlighted",
                    reply, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

                await _hub.Clients.Group($"overlay_{target.Login}").SendAsync("ChatMessage", message);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[ChatOverlay] No se pudo publicar un mensaje de Twitch");
            }
        }

        /// <summary>
        /// Manda un mensaje de prueba por el mismo camino que uno real (filtros, emotes, insignias) para que el
        /// streamer compruebe que le llega a OBS. Devuelve false si no hay ningún overlay de chat conectado.
        /// </summary>
        public async Task<bool> SendTestAsync(long userId, string text)
        {
            var channel = await GetChannelAsync(userId);
            if (channel == null || !HasOverlay(channel.Login)) return false;

            var fragments = new JArray { new JObject { ["type"] = "text", ["text"] = text + " " },
                new JObject { ["type"] = "emote", ["text"] = "Kappa", ["emote"] = new JObject { ["id"] = "25", ["format"] = new JArray("static") } } };
            var evt = new JObject
            {
                ["message_id"] = $"test-{Guid.NewGuid():N}",
                ["broadcaster_user_id"] = channel.TwitchId ?? "0",
                ["broadcaster_user_login"] = channel.Login,
                ["broadcaster_user_name"] = channel.Login,
                ["chatter_user_id"] = "0",
                ["chatter_user_login"] = "decatron",
                ["chatter_user_name"] = "Decatron",
                ["color"] = "#9146FF",
                ["message"] = new JObject { ["text"] = text + " Kappa", ["fragments"] = fragments },
                ["badges"] = new JArray { new JObject { ["set_id"] = "moderator", ["id"] = "1" } }
            };
            await PublishTwitchAsync(evt);
            return true;
        }

        // ═══════════════════════════════════════════════════════════════
        // KICK
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Un mensaje de Kick (payload del webhook chat.message.sent)</summary>
        public async Task PublishKickAsync(JsonElement payload)
        {
            try
            {
                var messageId = Str(payload, "message_id");
                var content = Str(payload, "content") ?? "";
                if (string.IsNullOrEmpty(messageId) || !payload.TryGetProperty("sender", out var sender) || !payload.TryGetProperty("broadcaster", out var broadcaster))
                    return;

                var kickId = Str(broadcaster, "user_id");
                if (string.IsNullOrEmpty(kickId)) return;

                var target = ToTarget(await _accounts.ResolveKickIdAsync(kickId));
                if (target == null || !HasOverlay(target.Login)) return;

                var cfg = await GetConfigAsync(target.UserId);
                if (!cfg.Kick) return;

                var username = Str(sender, "username") ?? "";
                var userKey = Decatron.Services.BotList.BotListService.NormalizeUsername("kick", Str(sender, "channel_slug") ?? username);
                if (string.IsNullOrEmpty(userKey)) return;

                if (cfg.HideBots)
                {
                    var fx = await _bots.GetEffectsAsync("kick", target.OriginUserId, userKey);
                    if (fx is { HideOverlay: true }) return;
                }

                var roles = new HashSet<string>();
                var badges = new List<ChatBadgeDto>();
                string? color = null;
                if (sender.TryGetProperty("identity", out var identity) && identity.ValueKind == JsonValueKind.Object)
                {
                    color = Str(identity, "username_color");
                    if (identity.TryGetProperty("badges", out var badgeList) && badgeList.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var b in badgeList.EnumerateArray())
                        {
                            var type = (Str(b, "type") ?? "").ToLowerInvariant();
                            if (string.IsNullOrEmpty(type)) continue;
                            roles.Add(type);
                            badges.Add(new ChatBadgeDto(type, null, Str(b, "text") ?? type, type));
                        }
                    }
                }
                if (Str(sender, "user_id") == kickId) roles.Add("broadcaster");

                var plain = KickEmoteTag.Replace(content, m => m.Groups[2].Value);
                if (!PassesFilters(cfg, userKey, plain, KickRoles(roles))) return;

                var lookups = new List<IReadOnlyDictionary<string, EmoteInfo>> { await _emotes.GetMapAsync(null, kickId, cfg.Providers) };
                var parts = new List<ChatPart>();
                var cursor = 0;
                foreach (Match m in KickEmoteTag.Matches(content))
                {
                    if (m.Index > cursor) Tokenize(parts, content[cursor..m.Index], lookups, cfg.HiddenEmotes);
                    parts.Add(new ChatPart("emote", N: m.Groups[2].Value, U: $"https://files.kick.com/emotes/{m.Groups[1].Value}/fullsize", P: "kick"));
                    cursor = m.Index + m.Length;
                }
                if (cursor < content.Length) Tokenize(parts, content[cursor..], lookups, cfg.HiddenEmotes);
                if (parts.Count == 0) return;

                ChatReplyDto? reply = null;
                if (payload.TryGetProperty("replies_to", out var replyTo) && replyTo.ValueKind == JsonValueKind.Object
                    && replyTo.TryGetProperty("sender", out var replySender))
                {
                    var replyName = Str(replySender, "username");
                    if (!string.IsNullOrEmpty(replyName))
                        reply = new ChatReplyDto(replyName, Truncate(KickEmoteTag.Replace(Str(replyTo, "content") ?? "", m => m.Groups[2].Value), 120));
                }

                var channelName = Str(broadcaster, "username") ?? Str(broadcaster, "channel_slug") ?? target.Login;
                var message = new ChatOverlayMessage(
                    messageId, "kick",
                    new ChatOriginDto(kickId, channelName.ToLowerInvariant(), channelName, false),
                    new ChatUserDto(userKey, username, Str(sender, "user_id") ?? "", string.IsNullOrWhiteSpace(color) ? null : color),
                    badges, parts, Highlight: false, reply, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

                await _hub.Clients.Group($"overlay_{target.Login}").SendAsync("ChatMessage", message);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[ChatOverlay] No se pudo publicar un mensaje de Kick");
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // BORRADOS (IRC: CLEARMSG / CLEARCHAT)
        // ═══════════════════════════════════════════════════════════════

        public Task PublishDeletedAsync(string twitchChannel, string messageId) =>
            SendToTwitchChannelAsync(twitchChannel, "ChatMessageDeleted", new { id = messageId });

        /// <summary>Ban o timeout: se quitan los mensajes de esa persona que vinieron del propio canal</summary>
        public Task PublishUserClearedAsync(string twitchChannel, string userLogin) =>
            SendToTwitchChannelAsync(twitchChannel, "ChatUserCleared", new { login = userLogin.ToLowerInvariant(), channel = twitchChannel.ToLowerInvariant() });

        public Task PublishChatClearedAsync(string twitchChannel) =>
            SendToTwitchChannelAsync(twitchChannel, "ChatCleared", new { channel = twitchChannel.ToLowerInvariant() });

        private async Task SendToTwitchChannelAsync(string twitchChannel, string method, object payload)
        {
            try
            {
                var login = twitchChannel.TrimStart('#').ToLowerInvariant();
                var target = ToTarget(await _accounts.ResolveLoginAsync(login));
                if (target == null || !HasOverlay(target.Login)) return;
                await _hub.Clients.Group($"overlay_{target.Login}").SendAsync(method, payload);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[ChatOverlay] No se pudo publicar {Method}", method);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // FILTROS Y TOKENIZADO
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Si hay un overlay de chat conectado a ese canal (las pruebas lo reemplazan)</summary>
        public Func<string, bool> OverlayProbe { get; set; } = login => OverlayHub.CountOverlays(login, OverlayType) > 0;

        private bool HasOverlay(string login) => OverlayProbe(login);

        private static HashSet<string> RolesFromBadges(JArray? badges)
        {
            var roles = new HashSet<string>();
            if (badges == null) return roles;
            foreach (var b in badges)
            {
                var id = b["set_id"]?.ToString();
                if (id is "broadcaster") roles.Add("mod");
                else if (id is "moderator" or "lead_moderator" or "staff" or "admin" or "global_mod") roles.Add("mod");
                else if (id == "vip") roles.Add("vip");
                else if (id is "subscriber" or "founder") roles.Add("sub");
            }
            return roles;
        }

        private static HashSet<string> KickRoles(HashSet<string> kickTypes)
        {
            var roles = new HashSet<string>();
            if (kickTypes.Contains("broadcaster") || kickTypes.Contains("moderator")) roles.Add("mod");
            if (kickTypes.Contains("vip")) roles.Add("vip");
            if (kickTypes.Contains("subscriber") || kickTypes.Contains("og") || kickTypes.Contains("founder")) roles.Add("sub");
            return roles;
        }

        /// <summary>Comandos, usuarios y palabras ocultas, y rol mínimo (cada nivel incluye a los de arriba)</summary>
        public static bool PassesFilters(ChatOverlayServerConfig cfg, string userLogin, string text, HashSet<string> roles)
        {
            if (cfg.HideCommands && text.TrimStart().StartsWith('!')) return false;
            if (cfg.BlockedUsers.Contains(userLogin)) return false;

            if (cfg.BlockedWords.Count > 0)
            {
                var lower = text.ToLowerInvariant();
                if (cfg.BlockedWords.Any(w => lower.Contains(w))) return false;
            }

            return cfg.MinRole switch
            {
                "mod" => roles.Contains("mod"),
                "vip" => roles.Contains("mod") || roles.Contains("vip"),
                "sub" => roles.Contains("mod") || roles.Contains("vip") || roles.Contains("sub"),
                _ => true
            };
        }

        /// <summary>
        /// Parte un texto en palabras y reemplaza las que coinciden exactamente (distingue mayúsculas, como 7TV)
        /// con un emote externo. El primer diccionario que tenga la palabra gana.
        /// </summary>
        public static void Tokenize(List<ChatPart> parts, string text, IReadOnlyList<IReadOnlyDictionary<string, EmoteInfo>> lookups, HashSet<string> hidden)
        {
            if (string.IsNullOrEmpty(text)) return;

            var buffer = new StringBuilder();
            void Flush()
            {
                if (buffer.Length == 0) return;
                parts.Add(new ChatPart("text", V: buffer.ToString()));
                buffer.Clear();
            }

            foreach (var token in Regex.Split(text, @"(\s+)"))
            {
                if (token.Length == 0) continue;
                if (!char.IsWhiteSpace(token[0]) && !hidden.Contains(token))
                {
                    EmoteInfo? hit = null;
                    foreach (var map in lookups)
                        if (map.TryGetValue(token, out hit)) break;

                    if (hit != null)
                    {
                        Flush();
                        parts.Add(new ChatPart("emote", N: hit.Name, U: hit.Url, A: hit.Animated, Z: hit.ZeroWidth ? true : null, P: hit.Provider));
                        continue;
                    }
                }
                buffer.Append(token);
            }
            Flush();
        }

        private static string TwitchEmoteUrl(string id, bool animated) =>
            $"https://static-cdn.jtvnw.net/emoticons/v2/{Uri.EscapeDataString(id)}/{(animated ? "animated" : "static")}/dark/2.0";

        private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max] + "…";

        /// <summary>Un campo como texto. Kick manda los ids (user_id) como número, no como texto: se leen igual</summary>
        private static string? Str(JsonElement el, string name)
        {
            if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(name, out var v)) return null;
            return v.ValueKind switch
            {
                JsonValueKind.String => v.GetString(),
                JsonValueKind.Number => v.GetRawText(),
                _ => null
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // CACHÉS
        // ═══════════════════════════════════════════════════════════════

        private static Target? ToTarget(ResolvedAlias? resolved) =>
            resolved == null ? null
                : new Target(resolved.Account.Principal.UserId, resolved.Account.OverlayKey, resolved.Account.TwitchId, resolved.Account.KickId, resolved.Matched.UserId);

        private async Task<ChatOverlayServerConfig> GetConfigAsync(long userId)
        {
            if (_configs.TryGetValue(userId, out var hit) && DateTime.UtcNow - hit.At < ConfigTtl)
                return hit.Config;
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var json = await db.ChatOverlayConfigs.AsNoTracking().Where(c => c.UserId == userId).Select(c => c.Config).FirstOrDefaultAsync();
                var cfg = ChatOverlayServerConfig.Parse(json);
                _configs[userId] = (DateTime.UtcNow, cfg);
                return cfg;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[ChatOverlay] No se pudo leer la config del canal {UserId}", userId);
                return _configs.TryGetValue(userId, out var old) ? old.Config : ChatOverlayServerConfig.Default;
            }
        }
    }
}
