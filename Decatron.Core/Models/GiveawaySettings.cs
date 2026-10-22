using System.Collections.Generic;
using System.Text.Json;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Opciones configurables de un giveaway que no tienen columna propia (giveaway_configs.settings, JSON).
    /// Todo tiene valor por defecto: un JSON vacío ({}) es la configuración original. Se lee SIEMPRE con Parse,
    /// que tolera JSON viejo, incompleto o dañado.
    /// Variables de los mensajes: {user} {winner} {prize} {count} {command} {timeout} {reason} {responded} {total}.
    /// </summary>
    public class GiveawaySettings
    {
        public GiveawayMessages Messages { get; set; } = new();
        public GiveawayRejections Rejections { get; set; } = new();
        public GiveawayWeightLimits WeightLimits { get; set; } = new();
        public GiveawayReminderRules Reminders { get; set; } = new();
        public GiveawayMultiAccountRules MultiAccount { get; set; } = new();
        public GiveawayRoleRules Roles { get; set; } = new();
        public GiveawayPlatformRules Platforms { get; set; } = new();
        public GiveawayOverlayRules Overlay { get; set; } = new();

        private static readonly JsonSerializerOptions Options = new() { PropertyNameCaseInsensitive = true };

        public static GiveawaySettings Parse(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new GiveawaySettings();
            try { return JsonSerializer.Deserialize<GiveawaySettings>(json, Options) ?? new GiveawaySettings(); }
            catch { return new GiveawaySettings(); }
        }
    }

    /// <summary>Mensajes del bot. Vacío = texto por defecto.</summary>
    public class GiveawayMessages
    {
        public string Joined { get; set; } = "";
        public string Cancelled { get; set; } = "";
        public string NoParticipants { get; set; } = "";
        public string Completed { get; set; } = "";
        public string WinnerResponded { get; set; } = "";
        public string Promoted { get; set; } = "";

        public const string DefaultJoined = "✅ {user} se ha unido al giveaway! Total de participantes: {count}";
        public const string DefaultCancelled = "❌ El giveaway ha sido cancelado: {reason}";
        public const string DefaultNoParticipants = "❌ El giveaway ha sido cancelado: {reason}";
        public const string DefaultCompleted = "🎉 Giveaway completado. {responded} de {total} ganadores respondieron.";
        public const string DefaultWinnerResponded = "✅ ¡Perfecto @{winner}! Tu respuesta ha sido registrada. ¡Felicidades por tu premio!";
        public const string DefaultPromoted = "🎉 ¡Felicidades @{winner}! Has sido promovido de respaldo a ganador principal. Tienes {timeout} segundos para responder.";
    }

    /// <summary>Qué hace el bot cuando alguien no puede entrar.</summary>
    public class GiveawayRejections
    {
        /// <summary>Si es true, el bot responde en el chat al viewer rechazado (por defecto no, para no llenar el chat).</summary>
        public bool AnnounceInChat { get; set; } = false;
        /// <summary>Texto por motivo (código → mensaje). Vacío = texto por defecto del motivo.</summary>
        public Dictionary<string, string> Messages { get; set; } = new();

        public static readonly Dictionary<string, string> DefaultMessages = new()
        {
            ["not_follower"] = "@{user}, para entrar al giveaway tienes que seguir el canal.",
            ["not_subscriber"] = "@{user}, este giveaway es solo para suscriptores.",
            ["watch_time"] = "@{user}, aún no tienes el tiempo mínimo viendo el canal para entrar.",
            ["account_age"] = "@{user}, tu cuenta es demasiado nueva para este giveaway.",
            ["account_age_unknown"] = "@{user}, no pude verificar la edad de tu cuenta; inténtalo de nuevo en un momento.",
            ["follow_age"] = "@{user}, llevas muy poco tiempo siguiendo el canal para entrar.",
            ["follow_age_unknown"] = "@{user}, no pude verificar desde cuándo sigues el canal; inténtalo de nuevo en un momento.",
            ["chat_messages"] = "@{user}, aún no tienes los mensajes mínimos en el chat para entrar.",
            ["cooldown"] = "@{user}, ganaste hace poco y todavía no puedes participar de nuevo.",
            ["blacklisted"] = "@{user}, no puedes participar en este giveaway.",
            ["not_in_whitelist"] = "@{user}, este giveaway es solo para personas invitadas.",
            ["vip_not_allowed"] = "@{user}, los VIP no pueden participar en este giveaway.",
            ["mod_not_allowed"] = "@{user}, los moderadores no pueden participar en este giveaway.",
            ["streamer_not_allowed"] = "@{user}, el streamer no participa en su propio giveaway.",
            ["full"] = "@{user}, el giveaway ya alcanzó el máximo de participantes.",
            ["multi_account"] = "@{user}, tu cuenta no pasó la verificación contra cuentas duplicadas.",
            ["platform_disabled"] = "@{user}, este giveaway no está abierto en tu plataforma.",
            ["unverifiable_follower"] = "@{user}, este giveaway exige seguir el canal y en tu plataforma no se puede comprobar.",
            ["unverifiable_follow_age"] = "@{user}, este giveaway exige una antigüedad de seguidor que en tu plataforma no se puede comprobar.",
            ["unverifiable_account_age"] = "@{user}, este giveaway exige una antigüedad de cuenta que en tu plataforma no se puede comprobar.",
            ["unverifiable_watch_time"] = "@{user}, este giveaway exige un tiempo mínimo viendo el canal que en tu plataforma no se puede comprobar.",
            ["unverifiable_chat_messages"] = "@{user}, este giveaway exige un mínimo de mensajes que en tu plataforma no se puede comprobar.",
            ["duplicate_ip"] = "@{user}, tu cuenta no pasó la verificación contra cuentas duplicadas.",
        };

        public string TextFor(string reason) =>
            Messages.TryGetValue(reason, out var custom) && !string.IsNullOrWhiteSpace(custom) ? custom
            : DefaultMessages.TryGetValue(reason, out var def) ? def : "";
    }

    /// <summary>Topes del peso de cada participante (los multiplicadores son exponenciales: sin tope se desbordan).</summary>
    public class GiveawayWeightLimits
    {
        /// <summary>Tope de cada multiplicador por separado.</summary>
        public double MaxPerFactor { get; set; } = 1000;
        /// <summary>Tope del peso total de un participante.</summary>
        public double MaxTotal { get; set; } = 10000;
        /// <summary>Peso mínimo (1 = nadie queda por debajo del peso base; menos de 1 permite penalizar).</summary>
        public double Min { get; set; } = 1;
    }

    public class GiveawayReminderRules
    {
        /// <summary>No recordar si al giveaway le quedan menos de N segundos.</summary>
        public int StopBeforeEndSeconds { get; set; } = 30;
        /// <summary>Un giveaway activo hace más de N horas se considera olvidado y deja de recordarse (0 = nunca).</summary>
        public int MaxAgeHours { get; set; } = 24;
    }

    /// <summary>Umbrales de la heurística de cuentas duplicadas (Twitch no entrega IP ni dispositivo).</summary>
    public class GiveawayMultiAccountRules
    {
        /// <summary>Dos cuentas creadas con menos de N días de diferencia son sospechosas.</summary>
        public double SameCreationDays { get; set; } = 1;
        /// <summary>Dos follows con menos de N días de diferencia, si además la cuenta es nueva, son sospechosos.</summary>
        public double SameFollowDays { get; set; } = 1;
        /// <summary>Una cuenta con menos de N días cuenta como «nueva» para la regla anterior.</summary>
        public double NewAccountDays { get; set; } = 30;
    }

    public class GiveawayRoleRules
    {
        /// <summary>El streamer puede participar en su propio giveaway.</summary>
        public bool StreamerCanJoin { get; set; } = true;
        /// <summary>El Lead Moderator cuenta como moderador al aplicar «permitir moderadores».</summary>
        public bool LeadModCountsAsMod { get; set; } = true;
    }

    /// <summary>Tiempos del overlay de OBS. El estado lo calcula el servidor; el navegador solo dibuja.</summary>
    public class GiveawayOverlayRules
    {
        /// <summary>Duración del revelado del ganador (la ruleta de nombres) antes de mostrar al ganador.</summary>
        public int RevealSeconds { get; set; } = 8;
        /// <summary>Cuánto se queda el resultado final en pantalla antes de ocultarse.</summary>
        public int ResultSeconds { get; set; } = 15;
    }

    /// <summary>
    /// Dónde se puede participar y qué hacer con lo que una plataforma no permite comprobar.
    /// Twitch es la base y por defecto es lo único activo (el comportamiento de siempre); Kick se activa a propósito.
    /// </summary>
    public class GiveawayPlatformRules
    {
        public bool Twitch { get; set; } = true;
        public bool Kick { get; set; } = false;
        /// <summary>
        /// Qué pasa con un requisito que la plataforma del viewer no permite comprobar (p. ej. «debe seguir» en Kick):
        /// "allow" = se omite y puede entrar; "reject" = se rechaza con el motivo «no verificable».
        /// </summary>
        public string Unverifiable { get; set; } = "allow";

        public bool IsEnabled(string platform) => platform switch
        {
            "twitch" => Twitch,
            "kick" => Kick,
            _ => false,
        };
    }

    /// <summary>
    /// Qué puede comprobar el bot en cada plataforma (la API pública de Kick no entrega seguidores, meses de sub ni edad
    /// de cuenta; los roles sí llegan en el mensaje de chat). Una sola fuente: el servidor la usa para validar y el panel
    /// la muestra. Para sumar una plataforma se agrega una entrada.
    /// </summary>
    public static class GiveawayCapabilities
    {
        public const string Roles = "roles";
        public const string Follower = "follower";
        public const string FollowAge = "followAge";
        public const string SubTier = "subTier";
        public const string SubMonths = "subMonths";
        public const string AccountAge = "accountAge";
        public const string WatchTime = "watchTime";
        public const string ChatMessages = "chatMessages";

        public static readonly string[] All = { Roles, Follower, FollowAge, SubTier, SubMonths, AccountAge, WatchTime, ChatMessages };

        private static readonly Dictionary<string, HashSet<string>> Supported = new()
        {
            ["twitch"] = new HashSet<string>(All),
            ["kick"] = new HashSet<string> { Roles },
        };

        public static bool CanVerify(string platform, string capability) =>
            Supported.TryGetValue(platform, out var set) && set.Contains(capability);

        public static IReadOnlyDictionary<string, string[]> Matrix() =>
            Supported.ToDictionary(kv => kv.Key, kv => kv.Value.ToArray());
    }
}
