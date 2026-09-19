namespace Decatron.Services.LiveTranslation
{
    public record TtsVoice(string Id, string Name, string Language, string Gender);

    /// <summary>
    /// Motor de voz para la traducción en vivo. Es intercambiable a propósito: se arranca
    /// con Deepgram Aura-2 (catálogo, barato, sin costo extra hoy) y Fish Audio entra
    /// después para el clon de voz del streamer. El pipeline no sabe cuál usa.
    /// </summary>
    public interface ITranslationTtsEngine
    {
        /// <summary>deepgram · fish · polly. Coincide con LiveTranslationSettings.VoiceEngine.</summary>
        string Name { get; }

        /// <summary>Nombre del motor para el libro mayor de créditos (multiplicador de costo).</summary>
        string CreditEngine { get; }

        bool IsConfigured { get; }

        IReadOnlyList<TtsVoice> Voices { get; }

        string DefaultVoiceFor(string language);

        /// <summary>
        /// Sintetiza en streaming y va entregando el MP3 por trozos conforme llega, para
        /// que el primer byte salga hacia el espectador sin esperar el audio completo.
        /// </summary>
        IAsyncEnumerable<ReadOnlyMemory<byte>> SynthesizeAsync(string text, string voiceId, CancellationToken ct);
    }
}
