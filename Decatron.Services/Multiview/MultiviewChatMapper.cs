using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Decatron.Services.ChatOverlay;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Multiview
{
    /// <summary>
    /// Convierte un mensaje crudo de Twitch (IRC) o de Kick (Pusher) en el mismo mensaje que usa el chat en pantalla
    /// (<see cref="ChatOverlayMessage"/>), con los emotes de terceros y de Decatron ya resueltos. Así el Multi-view
    /// reutiliza el formato y el catálogo de emotes del overlay de chat. Plan: .dev/plans/MULTIVIEW_PLAN.md, Fase 2.
    /// </summary>
    public sealed class MultiviewChatMapper
    {
        private static readonly Regex KickEmoteTag = new(@"\[emote:(\d+):([^\]]*)\]", RegexOptions.Compiled);
        private const int ReplyMax = 120;

        private readonly EmoteCatalogService _emotes;
        private readonly ChatBadgeService _badges;
        private readonly ILogger<MultiviewChatMapper> _logger;

        public MultiviewChatMapper(EmoteCatalogService emotes, ChatBadgeService badges, ILogger<MultiviewChatMapper> logger)
        {
            _emotes = emotes;
            _badges = badges;
            _logger = logger;
        }

        public async Task<ChatOverlayMessage?> FromTwitchAsync(IrcLine line)
        {
            if (line.Command != "PRIVMSG" || line.Params.Length == 0 || line.Trailing == null) return null;
            var channel = line.Params[0].TrimStart('#').ToLowerInvariant();
            var id = line.Tag("id");
            var login = (line.Prefix ?? "").Split('!')[0].ToLowerInvariant();
            if (id.Length == 0 || login.Length == 0) return null;

            var text = line.Trailing;
            if (text.Length > 9 && text[0] == '\u0001' && text.StartsWith("\u0001ACTION ", StringComparison.Ordinal))
                text = text[8..].TrimEnd('\u0001');

            var roomId = line.Tag("room-id");
            var lookups = new List<IReadOnlyDictionary<string, EmoteInfo>>();
            try { lookups.Add(await _emotes.GetMapAsync(roomId.Length > 0 ? roomId : null, null, EmoteProviders.All)); }
            catch (Exception ex) { _logger.LogDebug(ex, "Sin catálogo de emotes para {Channel}", channel); }

            var parts = new List<ChatPart>();
            var runes = text.EnumerateRunes().Select(r => r.ToString()).ToList();
            var cursor = 0;
            foreach (var (emoteId, start, end) in ParseEmoteRanges(line.Tag("emotes"), runes.Count))
            {
                if (start > cursor) ChatOverlayService.Tokenize(parts, string.Concat(runes.Skip(cursor).Take(start - cursor)), lookups, NoHidden);
                parts.Add(new ChatPart("emote", N: string.Concat(runes.Skip(start).Take(end - start + 1)),
                    U: $"https://static-cdn.jtvnw.net/emoticons/v2/{Uri.EscapeDataString(emoteId)}/default/dark/2.0", P: "twitch"));
                cursor = end + 1;
            }
            if (cursor < runes.Count) ChatOverlayService.Tokenize(parts, string.Concat(runes.Skip(cursor)), lookups, NoHidden);
            if (parts.Count == 0) return null;

            var badges = new List<ChatBadgeDto>();
            foreach (var b in line.Tag("badges").Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                var slash = b.IndexOf('/');
                if (slash <= 0) continue;
                var set = b[..slash];
                var version = b[(slash + 1)..];
                try
                {
                    var image = await _badges.ResolveAsync(roomId.Length > 0 ? roomId : null, set, version);
                    if (image != null) badges.Add(new ChatBadgeDto($"{set}/{version}", image.Url, image.Title, null));
                }
                catch (Exception ex) { _logger.LogDebug(ex, "Sin insignia {Set}/{Version}", set, version); }
            }

            ChatReplyDto? reply = null;
            var parent = line.Tag("reply-parent-display-name");
            if (parent.Length > 0) reply = new ChatReplyDto(parent, Truncate(line.Tag("reply-parent-msg-body")));

            var display = line.Tag("display-name");
            var color = line.Tag("color");
            return new ChatOverlayMessage(
                id, "twitch",
                new ChatOriginDto(roomId, channel, channel, false),
                new ChatUserDto(login, display.Length > 0 ? display : login, line.Tag("user-id"), color.Length > 0 ? color : null),
                badges, parts, Highlight: line.Tag("msg-id") == "highlighted-message", reply,
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        }

        /// <summary>Un mensaje de Kick (evento ChatMessageEvent) de la sala <paramref name="slug"/>.</summary>
        public async Task<ChatOverlayMessage?> FromKickAsync(JsonElement data, string slug, long? kickUserId)
        {
            var id = Str(data, "id");
            var content = Str(data, "content") ?? "";
            if (string.IsNullOrEmpty(id) || !data.TryGetProperty("sender", out var sender) || sender.ValueKind != JsonValueKind.Object) return null;

            var username = Str(sender, "username") ?? "";
            if (username.Length == 0) return null;
            var userSlug = (Str(sender, "slug") ?? username).ToLowerInvariant();

            string? color = null;
            var badges = new List<ChatBadgeDto>();
            if (sender.TryGetProperty("identity", out var identity) && identity.ValueKind == JsonValueKind.Object)
            {
                color = Str(identity, "color");
                var withImage = new HashSet<string>();
                if (identity.TryGetProperty("badges_v2", out var v2) && v2.ValueKind == JsonValueKind.Array)
                {
                    foreach (var b in v2.EnumerateArray())
                    {
                        var name = Str(b, "name") ?? "";
                        var url = Str(b, "image_url");
                        // El nivel de Kick es ruido en un chat combinado: solo se muestra el que el usuario eligió.
                        var selected = b.TryGetProperty("selected", out var sel) && sel.ValueKind == JsonValueKind.True;
                        if (name.Length == 0 || string.IsNullOrEmpty(url) || (name == "level" && !selected)) continue;
                        withImage.Add(name.ToLowerInvariant());
                        badges.Add(new ChatBadgeDto(name, url, name, null));
                    }
                }
                if (identity.TryGetProperty("badges", out var list) && list.ValueKind == JsonValueKind.Array)
                {
                    foreach (var b in list.EnumerateArray())
                    {
                        var type = (Str(b, "type") ?? "").ToLowerInvariant();
                        if (type.Length == 0 || withImage.Contains(type)) continue;
                        badges.Add(new ChatBadgeDto(type, null, Str(b, "text") ?? type, type));
                    }
                }
            }

            var lookups = new List<IReadOnlyDictionary<string, EmoteInfo>>();
            try { lookups.Add(await _emotes.GetMapAsync(null, kickUserId?.ToString(CultureInfo.InvariantCulture), EmoteProviders.All)); }
            catch (Exception ex) { _logger.LogDebug(ex, "Sin catálogo de emotes para Kick {Slug}", slug); }

            var parts = new List<ChatPart>();
            var cursor = 0;
            foreach (Match m in KickEmoteTag.Matches(content))
            {
                if (m.Index > cursor) ChatOverlayService.Tokenize(parts, content[cursor..m.Index], lookups, NoHidden);
                parts.Add(new ChatPart("emote", N: m.Groups[2].Value, U: $"https://files.kick.com/emotes/{m.Groups[1].Value}/fullsize", P: "kick"));
                cursor = m.Index + m.Length;
            }
            if (cursor < content.Length) ChatOverlayService.Tokenize(parts, content[cursor..], lookups, NoHidden);
            if (parts.Count == 0) return null;

            ChatReplyDto? reply = null;
            if (data.TryGetProperty("metadata", out var meta) && meta.ValueKind == JsonValueKind.Object
                && meta.TryGetProperty("original_sender", out var os) && os.ValueKind == JsonValueKind.Object
                && meta.TryGetProperty("original_message", out var om) && om.ValueKind == JsonValueKind.Object)
            {
                var who = Str(os, "username");
                if (!string.IsNullOrEmpty(who))
                    reply = new ChatReplyDto(who, Truncate(KickEmoteTag.Replace(Str(om, "content") ?? "", x => x.Groups[2].Value)));
            }

            return new ChatOverlayMessage(
                id, "kick",
                new ChatOriginDto(kickUserId?.ToString(CultureInfo.InvariantCulture) ?? "", slug, slug, false),
                new ChatUserDto(userSlug, username, Str(sender, "id") ?? "", string.IsNullOrWhiteSpace(color) ? null : color),
                badges, parts, Highlight: false, reply, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        }

        private static readonly HashSet<string> NoHidden = new(StringComparer.Ordinal);

        /// <summary>«25:0-4,12-16/1902:6-10» → (id, inicio, fin) ordenado y sin solapes ni rangos fuera del texto.</summary>
        internal static List<(string Id, int Start, int End)> ParseEmoteRanges(string tag, int length)
        {
            var result = new List<(string, int, int)>();
            if (string.IsNullOrEmpty(tag)) return result;
            foreach (var group in tag.Split('/', StringSplitOptions.RemoveEmptyEntries))
            {
                var colon = group.IndexOf(':');
                if (colon <= 0) continue;
                var id = group[..colon];
                foreach (var range in group[(colon + 1)..].Split(','))
                {
                    var dash = range.IndexOf('-');
                    if (dash <= 0 || !int.TryParse(range[..dash], out var s) || !int.TryParse(range[(dash + 1)..], out var e)) continue;
                    if (s < 0 || e < s || e >= length) continue;
                    result.Add((id, s, e));
                }
            }
            result.Sort((a, b) => a.Item2.CompareTo(b.Item2));
            var clean = new List<(string, int, int)>();
            var last = -1;
            foreach (var r in result) { if (r.Item2 > last) { clean.Add(r); last = r.Item3; } }
            return clean;
        }

        private static string Truncate(string s) => s.Length <= ReplyMax ? s : s[..ReplyMax] + "…";

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
    }
}
