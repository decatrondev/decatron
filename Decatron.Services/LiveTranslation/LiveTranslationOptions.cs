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
    }
}
