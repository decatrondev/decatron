namespace Decatron.Services.DiscordServer;

/// <summary>Nombres de permisos de Discord a sus bits (https://docs.discord.com/developers/topics/permissions).</summary>
public static class DiscordPermissionBits
{
    private static readonly Dictionary<string, int> Shift = new()
    {
        ["CREATE_INSTANT_INVITE"] = 0, ["KICK_MEMBERS"] = 1, ["BAN_MEMBERS"] = 2, ["ADMINISTRATOR"] = 3, ["MANAGE_CHANNELS"] = 4, ["MANAGE_GUILD"] = 5,
        ["ADD_REACTIONS"] = 6, ["VIEW_AUDIT_LOG"] = 7, ["PRIORITY_SPEAKER"] = 8, ["STREAM"] = 9, ["VIEW_CHANNEL"] = 10, ["SEND_MESSAGES"] = 11,
        ["SEND_TTS_MESSAGES"] = 12, ["MANAGE_MESSAGES"] = 13, ["EMBED_LINKS"] = 14, ["ATTACH_FILES"] = 15, ["READ_MESSAGE_HISTORY"] = 16,
        ["MENTION_EVERYONE"] = 17, ["USE_EXTERNAL_EMOJIS"] = 18, ["VIEW_GUILD_INSIGHTS"] = 19, ["CONNECT"] = 20, ["SPEAK"] = 21, ["MUTE_MEMBERS"] = 22,
        ["DEAFEN_MEMBERS"] = 23, ["MOVE_MEMBERS"] = 24, ["USE_VAD"] = 25, ["CHANGE_NICKNAME"] = 26, ["MANAGE_NICKNAMES"] = 27, ["MANAGE_ROLES"] = 28,
        ["MANAGE_WEBHOOKS"] = 29, ["MANAGE_GUILD_EXPRESSIONS"] = 30, ["USE_APPLICATION_COMMANDS"] = 31, ["REQUEST_TO_SPEAK"] = 32, ["MANAGE_EVENTS"] = 33,
        ["MANAGE_THREADS"] = 34, ["CREATE_PUBLIC_THREADS"] = 35, ["CREATE_PRIVATE_THREADS"] = 36, ["USE_EXTERNAL_STICKERS"] = 37,
        ["SEND_MESSAGES_IN_THREADS"] = 38, ["USE_EMBEDDED_ACTIVITIES"] = 39, ["MODERATE_MEMBERS"] = 40,
    };

    public const ulong Administrator = 1UL << 3;
    public const ulong ManageChannels = 1UL << 4;
    public const ulong ManageGuild = 1UL << 5;
    public const ulong ViewChannel = 1UL << 10;
    public const ulong SendMessages = 1UL << 11;
    public const ulong ManageRoles = 1UL << 28;

    public static bool IsKnown(string name) => name == "MEMBER_BASE" || Shift.ContainsKey(name);

    public static ulong Bit(string name) =>
        Shift.TryGetValue(name, out var s) ? 1UL << s : throw new ArgumentException($"Permiso desconocido: {name}");

    /// <summary>Une una lista de nombres (MEMBER_BASE se expande con memberBase de la plantilla).</summary>
    public static ulong Combine(IEnumerable<string> names, PermissionsDef def)
    {
        ulong v = 0;
        foreach (var n in names)
        {
            if (n == "MEMBER_BASE") { foreach (var b in def.MemberBase) v |= Bit(b); }
            else v |= Bit(n);
        }
        return v;
    }

    public static IEnumerable<string> Names(ulong value) =>
        Shift.Where(kv => (value & (1UL << kv.Value)) != 0).Select(kv => kv.Key);

    /// <summary>El bot puede dar lo que él mismo tiene (o todo, si es Administrador).</summary>
    public static ulong Grantable(ulong requested, ulong botPermissions) =>
        (botPermissions & Administrator) != 0 ? requested : requested & botPermissions;
}
