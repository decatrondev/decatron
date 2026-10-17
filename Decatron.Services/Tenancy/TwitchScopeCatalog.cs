namespace Decatron.Services.Tenancy;

/// <summary>
/// Fuente unica de los permisos de Twitch que pide la plataforma: cada uno con su motivo (es/en) y el modulo del plan que lo necesita.
/// Alimenta la pantalla de transparencia del comprador y el aviso del login del subdominio. Una prueba comprueba que todo scope que
/// se pide (appsettings, moderacion, bot) tenga entrada aqui.
/// </summary>
public static class TwitchScopeCatalog
{
    /// <summary>Permiso de la API v5 (retirada en 2022): las apps nuevas de Twitch lo rechazan con «No se han podido cargar los datos de autorización». Solo el #1 lo conserva.</summary>
    public const string DeprecatedScope = "channel_editor";

    public sealed record Entry(string Scope, string? Module, string Es, string En);

    public static readonly IReadOnlyList<Entry> Streamer = new Entry[]
    {
        new("user:read:email", null, "Identificar tu cuenta y tu correo al iniciar sesión.", "Identify your account and email when you sign in."),
        new("chat:read", "module.commands", "Leer el chat para detectar comandos.", "Read chat to detect commands."),
        new("chat:edit", "module.commands", "Escribir en el chat desde tu cuenta.", "Write in chat from your account."),
        new("user:write:chat", "module.commands", "Enviar mensajes al chat (respuestas, timers, avisos).", "Send chat messages (replies, timers, notices)."),
        new("channel:bot", "module.commands", "Permitir que el bot de tu marca hable en tu canal.", "Let your brand's bot speak in your channel."),
        new("clips:edit", "module.clips", "Crear clips con el comando.", "Create clips with the command."),
        new("channel:manage:broadcast", "module.commands", "Cambiar título y categoría del directo (!title, !game).", "Change stream title and category (!title, !game)."),
        new("user:edit:broadcast", "module.commands", "Leer y editar la configuración del directo.", "Read and edit your broadcast settings."),
        new("channel:edit:commercial", "module.timers", "Lanzar anuncios publicitarios (comerciales).", "Run ad breaks (commercials)."),
        new("channel:manage:redemptions", "module.overlays", "Crear y gestionar recompensas de puntos de canal.", "Create and manage channel point rewards."),
        new("channel:read:redemptions", "module.overlays", "Ver cuando alguien canjea una recompensa.", "See when someone redeems a reward."),
        new("channel:manage:moderators", "module.moderation", "Agregar o quitar moderadores desde el panel.", "Add or remove moderators from the panel."),
        new("channel:read:editors", "module.moderation", "Ver quiénes son editores de tu canal.", "See who your channel editors are."),
        new("channel:read:vips", "module.moderation", "Ver la lista de VIP para permisos de comandos.", "See the VIP list for command permissions."),
        new("moderation:read", "module.moderation", "Leer tu configuración de moderación y bloqueos.", "Read your moderation settings and bans."),
        new("user:manage:blocked_users", "module.moderation", "Gestionar usuarios bloqueados.", "Manage blocked users."),
        new("moderator:read:followers", "module.overlays", "Ver seguidores nuevos para alertas y comandos.", "See new followers for alerts and commands."),
        new("channel:read:subscriptions", "module.overlays", "Ver suscripciones para alertas y permisos.", "See subscriptions for alerts and permissions."),
        new("bits:read", "module.overlays", "Ver bits para las alertas.", "See bits for alerts."),
        new("channel:read:hype_train", "module.overlays", "Mostrar el Hype Train en overlays.", "Show the Hype Train in overlays."),
    };

    /// <summary>Se piden solo a quien activa el Multi-view con moderación, y también a la cuenta del bot.</summary>
    public static readonly IReadOnlyList<Entry> Moderation = new Entry[]
    {
        new("moderator:manage:chat_messages", "module.moderation", "Borrar mensajes del chat (filtros, pánico).", "Delete chat messages (filters, panic mode)."),
        new("moderator:manage:banned_users", "module.moderation", "Aplicar timeouts y bans (!ruleta, filtros).", "Apply timeouts and bans (!ruleta, filters)."),
    };

    /// <summary>Cuenta del bot del tenant: lo minimo para hablar y moderar.</summary>
    public static readonly IReadOnlyList<Entry> Bot = new Entry[]
    {
        new("user:read:chat", "module.commands", "Leer el chat como bot.", "Read chat as the bot."),
        new("user:write:chat", "module.commands", "Escribir en el chat como bot.", "Write in chat as the bot."),
        new("user:bot", "module.commands", "Identificar la cuenta como bot de chat.", "Identify the account as a chat bot."),
        new("moderator:manage:chat_messages", "module.moderation", "Borrar mensajes del chat.", "Delete chat messages."),
        new("moderator:manage:banned_users", "module.moderation", "Aplicar timeouts y bans.", "Apply timeouts and bans."),
    };

    public static IEnumerable<string> All() => Streamer.Concat(Moderation).Concat(Bot).Select(e => e.Scope).Distinct();

    /// <summary>Quita el permiso retirado de una lista separada por espacios (para tenants distintos del #1).</summary>
    public static string StripDeprecated(string? scopes)
        => string.Join(' ', (scopes ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(s => s != DeprecatedScope));
}
