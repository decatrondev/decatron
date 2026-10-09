namespace Decatron.Services.LiveTranslation
{
    /// <summary>Sección "LiveTranslation" de appsettings.</summary>
    public class LiveTranslationOptions
    {
        public const string Section = "LiveTranslation";

        /// <summary>Modelo de Deepgram para STT streaming.</summary>
        public string SttModel { get; set; } = "nova-3";

        /// <summary>
        /// Modelo de Gemini (directo) que se usa SOLO si OpenRouter falla. El modelo principal
        /// de traducción vive en la config global de IA (DecatronAIGlobalConfig.TranslationModel).
        /// </summary>
        public string GeminiFallbackModel { get; set; } = "gemini-3.5-flash-lite";

        /// <summary>
        /// Créditos por segundo de voz transcrita. 1 crédito = 1 carácter de voz estándar
        /// (≈ $4/M). Nova-3 streaming cuesta ≈ $0.0077/min ⇒ ≈ 32 créditos/segundo.
        /// </summary>
        public int SttCreditsPerSecond { get; set; } = 32;

        /// <summary>Un pipeline de idioma se apaga tras este tiempo sin oyentes.</summary>
        public int IdleLanguageStopSeconds { get; set; } = 60;

        /// <summary>Sin audio del streamer durante este tiempo ⇒ se cierra la sesión.</summary>
        public int IngestTimeoutSeconds { get; set; } = 90;

        /// <summary>Máximo de sesiones de ingesta simultáneas en el servidor.</summary>
        public int MaxConcurrentChannels { get; set; } = 20;

        /// <summary>Máximo de idiomas destino por canal.</summary>
        public int MaxLanguagesPerChannel { get; set; } = 4;

        /// <summary>Máximo de frases en cola por idioma antes de descartar las más viejas.</summary>
        public int MaxQueuedUtterances { get; set; } = 6;

        /// <summary>
        /// Corta las frases por significado (final de oración, coma, tope) y no solo por pausa, y pasa
        /// la frase anterior como contexto al traductor. Apagado = comportamiento anterior. Se cambia
        /// en appsettings y se aplica a las sesiones nuevas tras reiniciar el backend.
        /// </summary>
        public bool SmartSegmentation { get; set; } = false;

        /// <summary>
        /// Una frase que ya espera más que esto desde que el STT la cerró no se traduce: llegaría
        /// tan tarde que desorienta más de lo que ayuda (el espectador ya vio esa parte del video).
        /// Es el último recurso del modo alcance; antes se acelera la voz en la extensión.
        /// </summary>
        public int MaxStaleSeconds { get; set; } = 12;

        /// <summary>Con al menos esta cantidad de frases atrasadas se recortan las repeticiones antes de traducir.</summary>
        public int TrimRepeatsAtPending { get; set; } = 2;

        /// <summary>
        /// Valores que la extensión del espectador pide al servidor al abrir un canal: así se afinan sin
        /// publicar una versión nueva en las tiendas (que pasa por revisión). Se recargan solos al editar
        /// appsettings.json, sin reiniciar. Solo datos: la extensión los valida y nunca ejecuta nada que venga de aquí.
        /// </summary>
        public ClientTuning ClientTuning { get; set; } = new();
    }
    /// <summary>Ajustes del modo alcance y de la interfaz de la extensión. Los valores por defecto son los que trae la extensión.</summary>
    public class ClientTuning
    {
        /// <summary>Segundos de audio por delante que marcan cada escalón de aceleración (ascendentes).</summary>
        // Los arrays NO llevan valor por defecto a propósito: el binder de configuración de .NET agrega los
        // elementos del archivo a los del valor por defecto (quedarían 6 y 8 elementos, y la validación los
        // descartaría en silencio). Null = valores de fábrica, que viven en Sanitized().
        public double[]? AheadThresholds { get; set; }
        /// <summary>Velocidad en cada tramo: hasta el primer umbral, hasta el segundo, hasta el tercero y por encima. Entre 1 y 1.5.</summary>
        public double[]? Rates { get; set; }
        /// <summary>Audio máximo en cola antes de omitir las frases más viejas.</summary>
        public double MaxBacklogSec { get; set; } = 8;
        /// <summary>Segundos sin frases, con la traducción en vivo, para mostrar "esperando a que hable".</summary>
        public int SilentAfterSec { get; set; } = 25;
        /// <summary>Caracteres por segundo con que se calcula cuánto dura un subtítulo en el modo sin audio.</summary>
        public double ReadCharsPerSec { get; set; } = 15;
        public double ReadMinSec { get; set; } = 1.2;
        public double ReadMaxSec { get; set; } = 8;
        public int HistoryMax { get; set; } = 30;

        /// <summary>
        /// Copia con todo dentro de límites razonables: un error de tipeo en appsettings.json no debe poder
        /// dejar a los espectadores con la voz a 4x o sin cola. Lo que no cuadre vuelve al valor de fábrica.
        /// </summary>
        public ClientTuning Sanitized()
        {
            var d = new ClientTuning { AheadThresholds = new[] { 1.2, 2.5, 4.5 }, Rates = new[] { 1, 1.1, 1.18, 1.25 } };
            double Clamp(double v, double lo, double hi, double fallback) => double.IsNaN(v) || double.IsInfinity(v) ? fallback : Math.Min(hi, Math.Max(lo, v));
            var th = AheadThresholds is { Length: 3 } && AheadThresholds.All(x => x > 0 && x < 60) && AheadThresholds[0] < AheadThresholds[1] && AheadThresholds[1] < AheadThresholds[2]
                ? AheadThresholds : d.AheadThresholds!;
            var rates = Rates is { Length: 4 } && Rates.All(x => x >= 1 && x <= 1.5) && Rates[0] <= Rates[1] && Rates[1] <= Rates[2] && Rates[2] <= Rates[3]
                ? Rates : d.Rates!;
            var min = Clamp(ReadMinSec, 0.5, 5, d.ReadMinSec);
            return new ClientTuning
            {
                AheadThresholds = th.ToArray(),
                Rates = rates.ToArray(),
                MaxBacklogSec = Clamp(MaxBacklogSec, 3, 30, d.MaxBacklogSec),
                SilentAfterSec = (int)Clamp(SilentAfterSec, 10, 180, d.SilentAfterSec),
                ReadCharsPerSec = Clamp(ReadCharsPerSec, 8, 40, d.ReadCharsPerSec),
                ReadMinSec = min,
                ReadMaxSec = Clamp(ReadMaxSec, min, 20, d.ReadMaxSec),
                HistoryMax = (int)Clamp(HistoryMax, 5, 100, d.HistoryMax),
            };
        }
    }
}
