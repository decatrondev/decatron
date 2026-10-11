using System.Collections.Generic;
using System.Linq;
using Decatron.Core.Models.WheelOfLuck;

namespace Decatron.Core.Models.ClipCommand
{
    /// <summary>
    /// Los textos que !clip escribe en el chat. Misma forma que <see cref="WheelMessages"/>: base de
    /// Decatron en español e inglés, reemplazable por el streamer (vacío = vuelve la base), guardada en
    /// <c>clip_command_configs.messages</c> bajo la clave <c>chat</c>. Se reutilizan sus funciones de
    /// lectura y de reemplazo de variables para no tener dos formatos distintos.
    /// </summary>
    public static class ClipMessages
    {
        public const string Success = "success";
        public const string Offline = "offline";
        public const string CooldownGlobal = "cooldownGlobal";
        public const string CooldownUser = "cooldownUser";
        public const string NoPermission = "noPermission";
        public const string Blocked = "blocked";
        public const string UserLimit = "userLimit";
        public const string DurationRange = "durationRange";
        public const string DurationNotAllowed = "durationNotAllowed";
        public const string TitleNotAllowed = "titleNotAllowed";
        public const string TitleTooLong = "titleTooLong";
        public const string ClipsDisabled = "clipsDisabled";
        public const string ClipsRestricted = "clipsRestricted";
        public const string NoScope = "noScope";
        public const string AutomodTitle = "automodTitle";
        public const string NotClippable = "notClippable";
        public const string RateLimited = "rateLimited";
        public const string TwitchDown = "twitchDown";
        public const string NotReady = "notReady";
        public const string Failed = "failed";
        public const string UnsupportedPlatform = "unsupportedPlatform";

        /// <summary>Variables que acepta cada mensaje (el panel las muestra al streamer).</summary>
        public static readonly IReadOnlyDictionary<string, string[]> Placeholders = new Dictionary<string, string[]>
        {
            [Success]            = new[] { "user", "url", "duration", "title" },
            [Offline]            = new[] { "user" },
            [CooldownGlobal]     = new[] { "user", "seconds" },
            [CooldownUser]       = new[] { "user", "seconds" },
            [NoPermission]       = new[] { "user", "role" },
            [Blocked]            = new[] { "user" },
            [UserLimit]          = new[] { "user", "limit" },
            [DurationRange]      = new[] { "user", "min", "max" },
            [DurationNotAllowed] = new[] { "user" },
            [TitleNotAllowed]    = new[] { "user" },
            [TitleTooLong]       = new[] { "user", "limit" },
            [ClipsDisabled]      = new[] { "user" },
            [ClipsRestricted]    = new[] { "user" },
            [NoScope]            = new[] { "user" },
            [AutomodTitle]       = new[] { "user" },
            [NotClippable]       = new[] { "user" },
            [RateLimited]        = new[] { "user" },
            [TwitchDown]         = new[] { "user" },
            [NotReady]           = new[] { "user" },
            [Failed]             = new[] { "user" },
            [UnsupportedPlatform] = new[] { "user" },
        };

        public static IEnumerable<string> Keys => Placeholders.Keys;

        private static readonly Dictionary<string, (string Es, string En)> Defaults = new()
        {
            [Success] = (
                "🎬 @{user} creó un clip: {url}",
                "🎬 @{user} created a clip: {url}"),
            [Offline] = (
                "@{user}, el canal no está en vivo: solo se pueden crear clips durante el directo.",
                "@{user}, the channel isn't live: clips can only be created during the stream."),
            [CooldownGlobal] = (
                "@{user}, espera {seconds}s para crear otro clip.",
                "@{user}, wait {seconds}s before creating another clip."),
            [CooldownUser] = (
                "@{user}, puedes crear otro clip en {seconds}s.",
                "@{user}, you can create another clip in {seconds}s."),
            [NoPermission] = (
                "@{user}, este comando es para {role} o superior.",
                "@{user}, this command is for {role} or higher."),
            [Blocked] = (
                "@{user}, no puedes usar este comando en este canal.",
                "@{user}, you can't use this command in this channel."),
            [UserLimit] = (
                "@{user}, ya creaste {limit} clip(s) en este stream.",
                "@{user}, you've already created {limit} clip(s) this stream."),
            [DurationRange] = (
                "@{user}, la duración debe estar entre {min} y {max} segundos.",
                "@{user}, the duration must be between {min} and {max} seconds."),
            [DurationNotAllowed] = (
                "@{user}, aquí no se puede elegir la duración del clip.",
                "@{user}, you can't choose the clip duration here."),
            [TitleNotAllowed] = (
                "@{user}, aquí no se puede poner título al clip.",
                "@{user}, you can't set a clip title here."),
            [TitleTooLong] = (
                "@{user}, el título puede tener hasta {limit} caracteres.",
                "@{user}, the title can be up to {limit} characters."),
            [ClipsDisabled] = (
                "@{user}, este canal no tiene los clips habilitados.",
                "@{user}, this channel doesn't have clips enabled."),
            [ClipsRestricted] = (
                "@{user}, los clips de este canal están limitados a seguidores o suscriptores.",
                "@{user}, clips in this channel are limited to followers or subscribers."),
            [NoScope] = (
                "@{user}, el streamer debe volver a vincular su cuenta de Decatron para permitir clips.",
                "@{user}, the streamer needs to re-link their Decatron account to allow clips."),
            [AutomodTitle] = (
                "@{user}, el título no pasó el filtro de Twitch. Prueba con otro.",
                "@{user}, the title didn't pass Twitch's filter. Try another one."),
            [NotClippable] = (
                "@{user}, la categoría actual no permite clips.",
                "@{user}, the current category doesn't allow clips."),
            [RateLimited] = (
                "@{user}, Twitch está limitando los clips. Intenta en un momento.",
                "@{user}, Twitch is rate limiting clips. Try again in a moment."),
            [TwitchDown] = (
                "@{user}, Twitch no pudo crear el clip ahora. Intenta de nuevo.",
                "@{user}, Twitch couldn't create the clip right now. Try again."),
            [NotReady] = (
                "@{user}, el clip no estuvo listo a tiempo. Intenta de nuevo.",
                "@{user}, the clip wasn't ready in time. Try again."),
            [Failed] = (
                "@{user}, no se pudo crear el clip.",
                "@{user}, the clip couldn't be created."),
            [UnsupportedPlatform] = (
                "@{user}, crear clips con este comando no está disponible en esta plataforma.",
                "@{user}, creating clips with this command isn't available on this platform."),
        };

        public static string Default(string key, string lang)
        {
            if (!Defaults.TryGetValue(key, out var par)) return string.Empty;
            return lang == "en" ? par.En : par.Es;
        }

        /// <summary>Las bases completas, para que el panel pueda mostrarlas y restaurarlas.</summary>
        public static object AllDefaults() =>
            Defaults.ToDictionary(kv => kv.Key, kv => (object)new { es = kv.Value.Es, en = kv.Value.En });

        /// <summary>El texto que toca escribir: el del streamer si lo puso, el de Decatron si no, con las variables reemplazadas.</summary>
        public static string Render(string? messagesJson, string key, string lang, IDictionary<string, object?> values)
        {
            var template = WheelMessages.Custom(messagesJson, key, lang) ?? Default(key, lang);
            return WheelMessages.Fill(template, values);
        }
    }
}
