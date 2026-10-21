using System.Text.Json;
using System.Text.RegularExpressions;

namespace Decatron.Services
{
    /// <summary>
    /// Limpieza del texto antes de sintetizarlo: enlaces, emotes, letras repetidas y emojis.
    /// Se hace antes de recortar y de cobrar, así lo que se quita no se lee ni se paga.
    /// </summary>
    public static class SpeakChatTextCleaner
    {
        public enum LinkMode { Keep, Remove, Replace }

        public sealed record Options(LinkMode Links, bool Emotes, bool Repeats, bool Emojis)
        {
            /// <summary>Una configuración guardada sin esta sección no cambia: así los canales actuales siguen igual.</summary>
            public static readonly Options Off = new(LinkMode.Keep, false, false, false);

            /// <summary>Valores de una configuración nueva (los mismos que usa el panel).</summary>
            public static readonly Options Recommended = new(LinkMode.Remove, true, true, false);

            public bool Any => Links != LinkMode.Keep || Emotes || Repeats || Emojis;
        }

        // Etiqueta de emote de Kick: [emote:37226:KEKW]
        private static readonly Regex KickEmote =
            new(@"\[emote:\d+:([^\]]*)\]", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        // Direcciones con esquema o con www., y dominios sueltos con una terminación conocida
        // («ok.gracias» no es un enlace). El tiempo máximo evita que un texto malicioso la sature.
        private static readonly Regex Link = new(
            @"(?<![\p{L}\p{N}@])(?:(?:https?://|www\.)\S+|[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.(?:com|net|org|tv|gg|io|me|co|ly|app|dev|xyz|info|live|be|gl|fm|pe|es|ar|mx|cl|us)\b(?:/\S*)?)",
            RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        private static readonly Regex Emoji = new(@"[\p{So}\p{Cs}‍️]", RegexOptions.Compiled);
        private static readonly Regex RepeatedLetter = new(@"(\p{L})\1{2,}", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex RepeatedPunct = new(@"([!?.,;:¡¿*~_\-])\1{1,}", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex Spaces = new(@"\s{2,}", RegexOptions.Compiled);

        /// <summary>Lee <c>filters.cleanup</c> de la configuración. Sin la sección no se limpia nada.</summary>
        public static Options Read(JsonElement filters)
        {
            if (filters.ValueKind != JsonValueKind.Object ||
                !filters.TryGetProperty("cleanup", out var c) || c.ValueKind != JsonValueKind.Object)
                return Options.Off;

            var links = c.TryGetProperty("links", out var l) && l.ValueKind == JsonValueKind.String ? l.GetString() : "keep";
            return new Options(
                links switch { "remove" => LinkMode.Remove, "replace" => LinkMode.Replace, _ => LinkMode.Keep },
                Flag(c, "emotes"), Flag(c, "repeats"), Flag(c, "emojis"));
        }

        private static bool Flag(JsonElement el, string name) =>
            el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.True;

        /// <summary>
        /// Limpia <paramref name="text"/>. <paramref name="emoteNames"/> son los nombres de emotes que no viajan
        /// marcados en el mensaje (los de Twitch que Twitch ya separó, y los de 7TV, BTTV y FFZ). La etiqueta de
        /// Kick se arregla siempre: leer «[emote:37226:KEKW]» en voz alta no le sirve a nadie.
        /// </summary>
        public static string Clean(string text, Options options, IReadOnlySet<string>? emoteNames, string linkWord)
        {
            if (string.IsNullOrEmpty(text)) return text;

            text = KickEmote.Replace(text, options.Emotes ? " " : "$1");
            if (!options.Any && emoteNames is null) return text.Trim();

            if (options.Emotes && emoteNames is { Count: > 0 })
            {
                var kept = text.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                    .Where(w => !emoteNames.Contains(w));
                text = string.Join(' ', kept);
            }

            if (options.Links != LinkMode.Keep)
            {
                try { text = Link.Replace(text, options.Links == LinkMode.Replace ? linkWord : " "); }
                catch (RegexMatchTimeoutException) { /* texto raro: se deja sin tocar */ }
            }

            if (options.Emojis) text = Emoji.Replace(text, " ");

            if (options.Repeats)
            {
                text = RepeatedLetter.Replace(text, "$1$1");
                text = RepeatedPunct.Replace(text, "$1");
            }

            return Spaces.Replace(text, " ").Trim();
        }
    }
}
