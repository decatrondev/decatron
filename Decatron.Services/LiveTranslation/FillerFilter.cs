using System.Text;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// Recorta repeticiones tartamudeadas ("que que que fuimos", "the the game") antes de traducir.
    /// Solo se usa con el pipeline atrasado (modo alcance): ahorra tiempo de voz sin cambiar lo que
    /// se dijo. Deepgram ya omite por defecto los sonidos de duda ("eh", "um"), así que lo que
    /// queda para recortar son las palabras repetidas.
    /// </summary>
    public static class FillerFilter
    {
        /// <summary>Palabras de hasta 3 letras (artículos, preposiciones, pronombres) tartamudean con 2 repeticiones; el resto solo con 3 o más, porque "no no" o "muy muy" suelen ser énfasis.</summary>
        // Intensificadores: repetirlos es énfasis ("muy muy bueno"), no tartamudeo.
        private static readonly HashSet<string> Emphasis = new() { "muy", "tan", "very", "so", "too", "très", "sehr", "molto", "muito", "bem", "mui" };

        public static string CollapseRepeats(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return text ?? "";
            var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var sb = new StringBuilder();
            int i = 0;
            while (i < words.Length)
            {
                var norm = Normalize(words[i]);
                int j = i + 1;
                while (j < words.Length && norm.Length > 0 && Normalize(words[j]) == norm) j++;
                int run = j - i;
                bool collapse = norm.Length > 0 && (run >= 3 || (run == 2 && norm.Length <= 3 && !Emphasis.Contains(norm)));
                // Se conserva la puntuación de la última repetición ("que, que, que." → "que.").
                var keep = collapse ? words[j - 1] : words[i];
                if (collapse) i = j; else i++;
                if (sb.Length > 0) sb.Append(' ');
                sb.Append(keep);
            }
            return sb.ToString();
        }

        private static string Normalize(string w) => new string(w.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
    }
}
