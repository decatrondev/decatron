using System.Threading.Tasks;

namespace Decatron.Core.Interfaces
{
    /// <summary>
    /// Resultado de generar audio. <paramref name="FromCache"/> indica que el audio ya
    /// existía y no se llamó a AWS — esas generaciones no cuestan y no deben cobrar
    /// créditos.
    /// </summary>
    public record TtsGenerationResult(string? Url, bool FromCache)
    {
        public bool Success => !string.IsNullOrEmpty(Url);
        public static TtsGenerationResult Failed() => new(null, false);
    }

    public interface ITtsService
    {
        /// <summary>
        /// Generates TTS audio via Amazon Polly and returns the public URL.
        /// Uses local cache: checks DB hash first, then file, then calls Polly if needed.
        /// </summary>
        Task<string?> GenerateAsync(string text, string voiceId, string engine, string languageCode, string? channelName = null);

        /// <summary>
        /// Igual que <see cref="GenerateAsync"/> pero informa si el audio salió del caché.
        /// Úsalo cuando haya que cobrar créditos: un acierto de caché no cuesta.
        /// </summary>
        Task<TtsGenerationResult> GenerateWithInfoAsync(string text, string voiceId, string engine, string languageCode, string? channelName = null);

        /// <summary>
        /// Indica si ese audio exacto ya está en caché, sin generarlo. Permite saber
        /// antes de cobrar que la generación no va a costar nada.
        /// </summary>
        Task<bool> IsCachedAsync(string text, string voiceId, string engine, string languageCode);
    }
}
