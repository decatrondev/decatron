namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// Promedios (últimas frases) del tiempo que pasa en cada etapa de un idioma, en milisegundos.
    /// <c>EndToEnd</c> es lo que importa: desde que el STT cerró la frase hasta que sale el primer
    /// audio hacia el espectador. Las demás dicen dónde se va el tiempo.
    /// </summary>
    public record LanguageLatency(
        string Lang, int Samples, double QueueWaitMs, double TranslateMs, double ReadyWaitMs,
        double TtsFirstMs, double EndToEndMs, double EndToEndMaxMs, int Dropped);

    internal sealed class LatencyTracker
    {
        private const int Window = 20;
        private readonly object _lock = new();
        private readonly (double q, double tr, double rdy, double tts, double e2e)[] _ring = new (double, double, double, double, double)[Window];
        private int _count, _next;

        public void Add(double queueWaitMs, double translateMs, double readyWaitMs, double ttsFirstMs, double endToEndMs)
        {
            lock (_lock)
            {
                _ring[_next] = (queueWaitMs, translateMs, readyWaitMs, ttsFirstMs, endToEndMs);
                _next = (_next + 1) % Window;
                if (_count < Window) _count++;
            }
        }

        public LanguageLatency Snapshot(string lang, int dropped)
        {
            lock (_lock)
            {
                if (_count == 0) return new LanguageLatency(lang, 0, 0, 0, 0, 0, 0, 0, dropped);
                double q = 0, tr = 0, rdy = 0, tts = 0, e2e = 0, max = 0;
                for (int i = 0; i < _count; i++)
                {
                    var s = _ring[i];
                    q += s.q; tr += s.tr; rdy += s.rdy; tts += s.tts; e2e += s.e2e;
                    if (s.e2e > max) max = s.e2e;
                }
                double n = _count;
                return new LanguageLatency(lang, _count, Math.Round(q / n), Math.Round(tr / n), Math.Round(rdy / n), Math.Round(tts / n), Math.Round(e2e / n), Math.Round(max), dropped);
            }
        }
    }
}
