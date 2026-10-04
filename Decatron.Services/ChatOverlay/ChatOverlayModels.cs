using System.Text.Json;
using System.Text.Json.Serialization;

namespace Decatron.Services.ChatOverlay
{
    /// <summary>
    /// Un trozo de mensaje ya resuelto para dibujar. Claves cortas porque salen una por cada
    /// palabra de cada mensaje: t = tipo (text | emote | cheer), v = texto, n = nombre del emote,
    /// u = imagen, a = animado, z = se dibuja encima del anterior, p = proveedor, b = bits.
    /// </summary>
    public sealed record ChatPart(
        string T,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? V = null,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? N = null,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? U = null,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? A = null,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Z = null,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? P = null,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? B = null);

    /// <summary>Insignia: con imagen (Twitch) o solo el tipo y el texto (Kick no da imágenes)</summary>
    public sealed record ChatBadgeDto(
        string Id,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Url,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Title,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Kick);

    public sealed record ChatUserDto(string Login, string Name, string Id,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Color);

    public sealed record ChatOriginDto(string Id, string Login, string Name, bool Shared);

    public sealed record ChatReplyDto(string User, string Text);

    /// <summary>El mensaje que recibe el overlay (evento SignalR "ChatMessage")</summary>
    public sealed record ChatOverlayMessage(
        string Id,
        string Platform,
        ChatOriginDto Channel,
        ChatUserDto User,
        List<ChatBadgeDto> Badges,
        List<ChatPart> Parts,
        bool Highlight,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ChatReplyDto? Reply,
        long Ts);

    /// <summary>
    /// Lo que el servidor usa de la configuración del overlay para filtrar y resolver emotes.
    /// El resto (tema, texto, animaciones...) lo lee el overlay; se guarda tal cual.
    /// </summary>
    public sealed class ChatOverlayServerConfig
    {
        public bool Twitch { get; init; } = true;
        public bool Kick { get; init; } = true;
        public bool SharedAll { get; init; } = true;
        public HashSet<string> HiddenChannels { get; init; } = new();
        public bool HideCommands { get; init; } = true;
        public bool HideBots { get; init; } = true;
        public HashSet<string> BlockedUsers { get; init; } = new();
        public List<string> BlockedWords { get; init; } = new();
        public string MinRole { get; init; } = "all";
        public EmoteProviders Providers { get; init; } = EmoteProviders.All;
        public bool SharedChannelEmotes { get; init; } = true;
        public HashSet<string> HiddenEmotes { get; init; } = new(StringComparer.Ordinal);

        public static readonly ChatOverlayServerConfig Default = new();

        /// <summary>Lee lo que necesita el servidor; lo que falta o viene mal usa el valor por defecto</summary>
        public static ChatOverlayServerConfig Parse(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return Default;
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                if (root.ValueKind != JsonValueKind.Object) return Default;

                var sources = Obj(root, "sources");
                var shared = Obj(root, "sharedChat");
                var filters = Obj(root, "filters");
                var emotes = Obj(root, "emotes");

                var minRole = Str(filters, "minRole") ?? "all";
                if (minRole is not ("all" or "sub" or "vip" or "mod")) minRole = "all";

                return new ChatOverlayServerConfig
                {
                    Twitch = Bool(sources, "twitch", true),
                    Kick = Bool(sources, "kick", true),
                    SharedAll = (Str(shared, "mode") ?? "all") != "mine",
                    HiddenChannels = Strings(shared, "hiddenChannels").Select(s => s.ToLowerInvariant()).ToHashSet(),
                    HideCommands = Bool(filters, "hideCommands", true),
                    HideBots = Bool(filters, "hideBots", true),
                    BlockedUsers = Strings(filters, "blockedUsers").Select(s => s.TrimStart('@').ToLowerInvariant()).ToHashSet(),
                    BlockedWords = Strings(filters, "blockedWords").Where(w => w.Length > 0).Select(w => w.ToLowerInvariant()).ToList(),
                    MinRole = minRole,
                    Providers = new EmoteProviders(
                        Bool(emotes, "sevenTv", true), Bool(emotes, "bttv", true), Bool(emotes, "ffz", true), Bool(emotes, "globals", true), Bool(emotes, "decatron", true)),
                    SharedChannelEmotes = Bool(emotes, "sharedChannels", true),
                    HiddenEmotes = Strings(emotes, "hidden").ToHashSet(StringComparer.Ordinal)
                };
            }
            catch (JsonException)
            {
                return Default;
            }
        }

        private static JsonElement? Obj(JsonElement? parent, string name) =>
            parent is { ValueKind: JsonValueKind.Object } p && p.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Object ? v : null;

        private static bool Bool(JsonElement? parent, string name, bool fallback) =>
            parent is { ValueKind: JsonValueKind.Object } p && p.TryGetProperty(name, out var v)
                ? v.ValueKind switch { JsonValueKind.True => true, JsonValueKind.False => false, _ => fallback }
                : fallback;

        private static string? Str(JsonElement? parent, string name) =>
            parent is { ValueKind: JsonValueKind.Object } p && p.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

        private static IEnumerable<string> Strings(JsonElement? parent, string name)
        {
            if (parent is { ValueKind: JsonValueKind.Object } p && p.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Array)
                foreach (var item in v.EnumerateArray())
                    if (item.ValueKind == JsonValueKind.String && item.GetString() is { Length: > 0 } s)
                        yield return s.Trim();
        }
    }
}
