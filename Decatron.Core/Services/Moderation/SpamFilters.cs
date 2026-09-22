using System;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Core.Models;

namespace Decatron.Core.Services.Moderation
{
    /// <summary>
    /// Base de los filtros de spam: cada uno lee su configuración de moderation_filters.settings
    /// (con valores por defecto) y, si el mensaje la viola, devuelve el detalle para el log.
    /// </summary>
    public abstract class SpamFilter<TSettings> : IModerationFilter where TSettings : new()
    {
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

        public abstract string Key { get; }
        protected abstract string Reason { get; }
        protected abstract string DefaultMessage { get; }
        protected virtual string MinimumAction => "warning";

        /// <summary>Qué se detectó (va al log y a $(word)), o null si el mensaje pasa</summary>
        protected abstract string? Detect(ModerationMessage message, TSettings settings);

        public Task<FilterHit?> CheckAsync(ModerationMessage message, ModerationFilter config)
        {
            var detail = Detect(message, ParseSettings(config.Settings));
            return Task.FromResult(detail == null ? null : new FilterHit
            {
                FilterKey = Key,
                Severity = config.Severity,
                Detail = detail,
                Reason = Reason,
                MinimumAction = MinimumAction,
                DefaultMessage = DefaultMessage
            });
        }

        public static TSettings ParseSettings(string? json)
        {
            try { return JsonSerializer.Deserialize<TSettings>(string.IsNullOrWhiteSpace(json) ? "{}" : json, JsonOptions) ?? new(); }
            catch (JsonException) { return new(); }
        }

        /// <summary>Para comparar mensajes repetidos: minúsculas y espacios colapsados</summary>
        protected static string Normalize(string text) =>
            Regex.Replace(text.Trim().ToLowerInvariant(), @"\s+", " ");
    }

    // ───────────────────────── Mayúsculas ─────────────────────────

    public class CapsSettings
    {
        /// <summary>Mínimo de letras para evaluar: un "XD" o "GG" no cuenta</summary>
        public int MinLetters { get; set; } = 15;
        public int MaxPercent { get; set; } = 70;
    }

    public class CapsFilter : SpamFilter<CapsSettings>
    {
        public const string FilterKey = "caps";
        public override string Key => FilterKey;
        protected override string Reason => "Exceso de mayúsculas";
        protected override string DefaultMessage => "🔠 $(user), baja las mayúsculas, por favor. Strike $(strike)/5";

        protected override string? Detect(ModerationMessage message, CapsSettings s)
        {
            var text = message.TextWithoutEmotes ?? message.Text;
            var letters = text.Count(char.IsLetter);
            if (letters < Math.Max(1, s.MinLetters))
                return null;

            var percent = text.Count(char.IsUpper) * 100 / letters;
            return percent > s.MaxPercent ? $"{percent}% mayúsculas" : null;
        }
    }

    // ───────────────────────── Símbolos ─────────────────────────

    public class SymbolsSettings
    {
        public int MinLength { get; set; } = 10;
        public int MaxPercent { get; set; } = 50;
    }

    public class SymbolsFilter : SpamFilter<SymbolsSettings>
    {
        public const string FilterKey = "symbols";
        public override string Key => FilterKey;
        protected override string Reason => "Exceso de símbolos";
        protected override string DefaultMessage => "🔣 $(user), demasiados símbolos en tu mensaje. Strike $(strike)/5";

        protected override string? Detect(ModerationMessage message, SymbolsSettings s)
        {
            var text = message.TextWithoutEmotes ?? message.Text;
            var visible = text.EnumerateRunes().Where(r => !Rune.IsWhiteSpace(r)).ToList();
            if (visible.Count < Math.Max(1, s.MinLength))
                return null;

            var symbols = visible.Count(IsSymbol);
            var percent = symbols * 100 / visible.Count;
            return percent > s.MaxPercent ? $"{percent}% símbolos" : null;
        }

        /// <summary>
        /// Puntuación y símbolos, incluidos los de arte ASCII (▀█▄). Los emojis no: esos los cuenta el filtro de emotes.
        /// </summary>
        private static bool IsSymbol(Rune r)
        {
            var category = Rune.GetUnicodeCategory(r);
            if (category == UnicodeCategory.OtherSymbol)
                return r.IsBmp;
            return category is UnicodeCategory.MathSymbol or UnicodeCategory.CurrencySymbol or UnicodeCategory.ModifierSymbol
                || Rune.IsPunctuation(r);
        }
    }

    // ───────────────────────── Emotes ─────────────────────────

    public class EmotesSettings
    {
        public int MaxEmotes { get; set; } = 10;
        /// <summary>Contar también los emojis (😂🔥) como emotes</summary>
        public bool CountEmoji { get; set; } = true;
    }

    public class EmotesFilter : SpamFilter<EmotesSettings>
    {
        public const string FilterKey = "emotes";
        public override string Key => FilterKey;
        protected override string Reason => "Exceso de emotes";
        protected override string DefaultMessage => "😶 $(user), demasiados emotes en un mensaje. Strike $(strike)/5";

        protected override string? Detect(ModerationMessage message, EmotesSettings s)
        {
            var count = message.EmoteCount;
            if (s.CountEmoji)
                count += message.Text.EnumerateRunes().Count(r => !r.IsBmp && Rune.GetUnicodeCategory(r) == UnicodeCategory.OtherSymbol);
            return count > s.MaxEmotes ? $"{count} emotes" : null;
        }
    }

    // ───────────────────────── Largo ─────────────────────────

    public class LengthSettings
    {
        public int MaxLength { get; set; } = 300;
    }

    public class LengthFilter : SpamFilter<LengthSettings>
    {
        public const string FilterKey = "length";
        public override string Key => FilterKey;
        protected override string Reason => "Mensaje demasiado largo";
        protected override string DefaultMessage => "📏 $(user), tu mensaje es demasiado largo. Strike $(strike)/5";

        protected override string? Detect(ModerationMessage message, LengthSettings s)
        {
            var length = message.Text.EnumerateRunes().Count();
            return length > s.MaxLength ? $"{length} caracteres" : null;
        }
    }

    // ───────────────────────── Repetidos (mismo usuario) ─────────────────────────

    public class RepetitionSettings
    {
        /// <summary>A partir de la cuántas veces el mismo mensaje se sanciona</summary>
        public int MaxRepeats { get; set; } = 3;
        public int WindowSeconds { get; set; } = 30;
    }

    public class RepetitionFilter : SpamFilter<RepetitionSettings>
    {
        public const string FilterKey = "repetition";
        public override string Key => FilterKey;
        protected override string Reason => "Mensaje repetido";
        protected override string DefaultMessage => "🔁 $(user), no repitas el mismo mensaje. Strike $(strike)/5";

        protected override string? Detect(ModerationMessage message, RepetitionSettings s)
        {
            if (string.IsNullOrEmpty(message.Username))
                return null;

            // El búfer ya incluye este mensaje (se agrega antes de moderar)
            var text = Normalize(message.Text);
            var window = TimeSpan.FromSeconds(Math.Clamp(s.WindowSeconds, 5, ModerationCommandsConfig.NukeMaxWindowSeconds));
            var user = message.Username.ToLower();
            var times = RecentChatBuffer.Since(message.Channel, window)
                .Count(e => e.Username == user && Normalize(e.Text) == text);

            return times >= Math.Max(2, s.MaxRepeats) ? $"{times} veces el mismo mensaje" : null;
        }
    }

    // ───────────────────────── Copypasta (muchos usuarios) ─────────────────────────

    public class CopypastaSettings
    {
        /// <summary>Cuántos usuarios distintos con el mismo texto lo convierten en copypasta</summary>
        public int MinUsers { get; set; } = 5;
        public int WindowSeconds { get; set; } = 60;
        /// <summary>Textos más cortos no cuentan: "GG" o un emote repetido por todo el chat es normal</summary>
        public int MinLength { get; set; } = 20;
    }

    public class CopypastaFilter : SpamFilter<CopypastaSettings>
    {
        public const string FilterKey = "copypasta";
        public override string Key => FilterKey;
        protected override string Reason => "Copypasta";
        protected override string DefaultMessage => "📋 $(user), nada de copypasta en este chat. Strike $(strike)/5";

        protected override string? Detect(ModerationMessage message, CopypastaSettings s)
        {
            var text = Normalize(message.Text);
            if (string.IsNullOrEmpty(message.Username) || text.Length < s.MinLength)
                return null;

            var window = TimeSpan.FromSeconds(Math.Clamp(s.WindowSeconds, 5, ModerationCommandsConfig.NukeMaxWindowSeconds));
            var users = RecentChatBuffer.Since(message.Channel, window)
                .Where(e => Normalize(e.Text) == text)
                .Select(e => e.Username)
                .Distinct()
                .Count();

            return users >= Math.Max(2, s.MinUsers) ? $"copypasta de {users} usuarios" : null;
        }
    }

    // ───────────────────────── Zalgo y texto raro ─────────────────────────

    public class ZalgoSettings
    {
        /// <summary>Marcas combinadas seguidas que se aceptan (el vietnamita o el hindi usan 1-2)</summary>
        public int MaxCombiningMarks { get; set; } = 2;
        /// <summary>Bloquear también letras "de fantasía": 𝓱𝓸𝓵𝓪, ｈｏｌａ, ⓗⓞⓛⓐ</summary>
        public bool BlockFancyText { get; set; }
    }

    public class ZalgoFilter : SpamFilter<ZalgoSettings>
    {
        public const string FilterKey = "zalgo";
        public override string Key => FilterKey;
        protected override string Reason => "Texto zalgo o caracteres raros";
        protected override string DefaultMessage => "👾 $(user), ese tipo de texto no está permitido. Strike $(strike)/5";
        // El zalgo tapa las líneas de arriba y abajo: no puede quedar en el chat
        protected override string MinimumAction => "delete";

        protected override string? Detect(ModerationMessage message, ZalgoSettings s)
        {
            var run = 0;
            foreach (var r in message.Text.EnumerateRunes())
            {
                var category = Rune.GetUnicodeCategory(r);
                if (category is UnicodeCategory.NonSpacingMark or UnicodeCategory.EnclosingMark)
                {
                    if (++run > s.MaxCombiningMarks)
                        return "texto zalgo";
                }
                else run = 0;
            }

            if (s.BlockFancyText && message.Text.EnumerateRunes().Count(IsFancy) >= 3)
                return "letras de fantasía";

            return null;
        }

        private static bool IsFancy(Rune r) => r.Value is
            (>= 0x1D400 and <= 0x1D7FF)     // 𝐀𝓐𝔄𝕬 (alfanuméricos matemáticos)
            or (>= 0xFF21 and <= 0xFF5A)    // ＡＢＣ ａｂｃ (ancho completo)
            or (>= 0x24B6 and <= 0x24E9)    // Ⓐⓐ
            or (>= 0x1F130 and <= 0x1F189); // 🄰🅐 (sin tocar las banderas 🇵🇪)
    }

    // ───────────────────────── Menciones ─────────────────────────

    public class MentionsSettings
    {
        public int MaxMentions { get; set; } = 5;
    }

    public class MentionsFilter : SpamFilter<MentionsSettings>
    {
        public const string FilterKey = "mentions";
        public override string Key => FilterKey;
        protected override string Reason => "Exceso de menciones";
        protected override string DefaultMessage => "📣 $(user), demasiadas menciones en un mensaje. Strike $(strike)/5";

        private static readonly Regex Mention = new(@"(?<![\w@])@(\w{2,25})", RegexOptions.Compiled);

        protected override string? Detect(ModerationMessage message, MentionsSettings s)
        {
            var count = Mention.Matches(message.Text).Select(m => m.Groups[1].Value.ToLower()).Distinct().Count();
            return count > s.MaxMentions ? $"{count} menciones" : null;
        }
    }
}
