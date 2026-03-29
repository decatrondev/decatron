using System.Threading.Tasks;

namespace Decatron.Core.Interfaces
{
    public interface ITtsService
    {
        /// <summary>
        /// Generates TTS audio via Amazon Polly and returns the public URL.
        /// Uses local cache: checks DB hash first, then file, then calls Polly if needed.
        /// </summary>
        Task<string?> GenerateAsync(string text, string voiceId, string engine, string languageCode, string? channelName = null);
    }
}
