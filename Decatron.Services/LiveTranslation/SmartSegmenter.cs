namespace Decatron.Services.LiveTranslation
{
    /// <summary>Una palabra confirmada por el STT, con su tiempo exacto en el reloj del audio.</summary>
    public record SegWord(string Text, double Start, double End, DateTime ArrivedUtc);

    /// <summary>
    /// Decide cuándo cerrar una frase para traducirla. Sin esto, un streamer que no hace pausas
    /// produce una "frase" de 20-30 s (el STT solo cierra con silencio) que llega tarde y deja
    /// la cola sin espacio. Aquí se corta por significado:
    ///   1. final de oración (. ? ! …) si ya hay el mínimo de palabras;
    ///   2. coma o conjunción si ya hay el "soft";
    ///   3. tope duro por palabras o por segundos.
    /// Lo que queda después del corte espera al siguiente resultado. Una pausa del streamer
    /// (<see cref="Flush"/>) siempre cierra todo. Sin I/O: se prueba con texto sintético.
    /// </summary>
    public sealed class SmartSegmenter
    {
        /// <summary>Umbrales en "unidades": palabras, o caracteres×0.4 en idiomas sin espacios (ja/ko).</summary>
        public sealed record Policy(double Min, double Soft, double Max, double MaxSeconds, bool CharBased);

        private static readonly Policy Fast = new(6, 12, 24, 9, false);          // es en pt fr it y el resto
        private static readonly Policy Slow = new(10, 16, 30, 11, false);        // de ru: el verbo/sentido llega al final
        private static readonly Policy CharLang = new(8, 14, 28, 10, true);      // ja ko

        public static Policy PolicyFor(string lang) => (lang ?? "").ToLowerInvariant() switch
        {
            "de" or "ru" => Slow,
            "ja" or "ko" => CharLang,
            _ => Fast,
        };

        private static readonly Dictionary<string, HashSet<string>> Conjunctions = new()
        {
            ["en"] = new(StringComparer.OrdinalIgnoreCase) { "and", "but", "so", "because", "then", "which", "when", "while", "if", "or" },
            ["es"] = new(StringComparer.OrdinalIgnoreCase) { "y", "pero", "porque", "entonces", "cuando", "mientras", "aunque", "o", "pues" },
            ["pt"] = new(StringComparer.OrdinalIgnoreCase) { "e", "mas", "porque", "então", "quando", "enquanto", "embora", "ou" },
            ["fr"] = new(StringComparer.OrdinalIgnoreCase) { "et", "mais", "parce", "donc", "quand", "alors", "ou" },
            ["it"] = new(StringComparer.OrdinalIgnoreCase) { "e", "ma", "perché", "quindi", "quando", "mentre", "o" },
            ["de"] = new(StringComparer.OrdinalIgnoreCase) { "und", "aber", "weil", "dann", "wenn", "während", "oder", "denn" },
            ["ru"] = new(StringComparer.OrdinalIgnoreCase) { "и", "но", "потому", "тогда", "когда", "если", "или" },
        };

        private readonly string _lang;
        private readonly Policy _policy;
        private readonly Func<int>? _pressure;
        private readonly List<SegWord> _buf = new();

        /// <param name="pressure">Frases esperando en la cola del idioma más atrasado; a más cola, cortes más cortos.</param>
        public SmartSegmenter(string sourceLanguage, Func<int>? pressure = null)
        {
            _lang = (sourceLanguage ?? "").ToLowerInvariant();
            _policy = PolicyFor(_lang);
            _pressure = pressure;
        }

        public int BufferedWords => _buf.Count;

        /// <summary>Agrega palabras confirmadas y devuelve las frases que ya se pueden cerrar.</summary>
        public List<Utterance> Push(IEnumerable<SegWord> words)
        {
            _buf.AddRange(words);
            var outList = new List<Utterance>();
            var (min, soft, max, maxSec) = Effective();

            while (_buf.Count > 0)
            {
                int cut = FindCut(min, soft, max, maxSec);
                if (cut < 0) break;
                outList.Add(Take(cut));
            }
            return outList;
        }

        /// <summary>Pausa del streamer o cierre: lo acumulado sale completo.</summary>
        public Utterance? Flush()
        {
            if (_buf.Count == 0) return null;
            return Take(_buf.Count - 1);
        }

        // ───────────── umbrales según la presión
        private (double min, double soft, double max, double maxSec) Effective()
        {
            int p = 0;
            try { p = _pressure?.Invoke() ?? 0; } catch { /* sin dato de presión: umbrales normales */ }
            double f = p <= 1 ? 1.0 : p <= 3 ? 0.75 : 0.55;
            double min = Math.Max(3, Math.Round(_policy.Min * f));
            double soft = Math.Max(min + 2, Math.Round(_policy.Soft * f));
            double max = Math.Max(soft + 3, Math.Round(_policy.Max * f));
            return (min, soft, max, _policy.MaxSeconds * f);
        }

        // ───────────── búsqueda del corte (devuelve el índice de la última palabra del trozo, o -1)
        private int FindCut(double min, double soft, double max, double maxSec)
        {
            double units = 0;
            int firstSentence = -1, firstClause = -1;
            for (int i = 0; i < _buf.Count; i++)
            {
                units += Units(_buf[i]);
                if (units < min) continue;
                // El primer punto de corte que llega al mínimo: corta más corto y lo que sobra se evalúa en el siguiente giro.
                if (firstSentence < 0 && EndsSentence(_buf[i].Text)) firstSentence = i;
                else if (firstClause < 0 && (EndsClause(_buf[i].Text) || (i + 1 < _buf.Count && IsConjunction(_buf[i + 1].Text)))) firstClause = i;
            }
            // Un cierre de oración vale desde el mínimo: la calidad manda cuando no hay apuro.
            if (firstSentence >= 0) return firstSentence;

            double total = units;
            double seconds = _buf[^1].End - _buf[0].Start;
            if (total >= soft || seconds >= maxSec * 0.6)
                if (firstClause >= 0) return firstClause;

            if (total >= max || seconds >= maxSec) return _buf.Count - 1;   // tope duro
            return -1;
        }

        private Utterance Take(int lastIndex)
        {
            var seg = _buf.GetRange(0, lastIndex + 1);
            _buf.RemoveRange(0, lastIndex + 1);
            var sep = _policy.CharBased ? "" : " ";
            return new Utterance(
                string.Join(sep, seg.Select(w => w.Text)).Trim(),
                seg[0].Start, seg[^1].End, seg.Max(w => w.ArrivedUtc));
        }

        private double Units(SegWord w) => _policy.CharBased ? Math.Max(1, w.Text.Length) * 0.4 : 1;

        private static readonly char[] Closers = { '"', '\'', ')', ']', '»', '”', '’', '」', '』' };

        private static bool EndsSentence(string w)
        {
            var t = w.TrimEnd(Closers);
            return t.Length > 0 && (t[^1] is '.' or '?' or '!' or '…' or '。' or '？' or '！');
        }

        private static bool EndsClause(string w)
        {
            var t = w.TrimEnd(Closers);
            return t.Length > 0 && (t[^1] is ',' or ';' or ':' or '，' or '、' or '；' or '：');
        }

        private bool IsConjunction(string w)
        {
            if (!Conjunctions.TryGetValue(_lang, out var set)) return false;
            return set.Contains(w.Trim().Trim(Closers));
        }
    }
}
