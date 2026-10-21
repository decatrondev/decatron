using System.Text.RegularExpressions;

namespace Decatron.Services
{
    /// <summary>
    /// Recorte y palabras bloqueadas de Speak Chat, separados del servicio para poder probarlos.
    /// </summary>
    public static class SpeakChatTextFilter
    {
        /// <summary>
        /// Corta a <paramref name="maxChars"/> sin dejar una palabra a medias: retrocede al último
        /// espacio. Si el texto no tiene espacios dentro del límite, corta en el límite.
        /// </summary>
        public static string TruncateAtWord(string text, int maxChars)
        {
            if (maxChars <= 0 || text.Length <= maxChars) return text;
            if (char.IsWhiteSpace(text[maxChars])) return text.Substring(0, maxChars).TrimEnd();

            var cut = text.LastIndexOf(' ', maxChars - 1);
            return cut > 0 ? text.Substring(0, cut).TrimEnd() : text.Substring(0, maxChars);
        }

        /// <summary>
        /// ¿El texto contiene la palabra bloqueada? Con <paramref name="wholeWord"/> solo cuenta
        /// como palabra completa ("ass" no bloquea "class"); sin él, vale cualquier fragmento.
        /// </summary>
        public static bool ContainsBlocked(string text, string word, bool wholeWord)
        {
            if (string.IsNullOrEmpty(word)) return false;
            if (!wholeWord) return text.Contains(word, StringComparison.OrdinalIgnoreCase);

            var pattern = @"(?<![\p{L}\p{N}_])" + Regex.Escape(word) + @"(?![\p{L}\p{N}_])";
            return Regex.IsMatch(text, pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
                TimeSpan.FromMilliseconds(100));
        }
    }
}
