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
}
