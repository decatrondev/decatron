using System.Collections.Generic;
using System.Threading.Tasks;

namespace Decatron.Core.Interfaces
{
    /// <summary>Qué se le hace a los mensajes de un bot en un canal</summary>
    public sealed record BotEffects(
        string Platform,
        string Username,
        string DisplayName,
        string Category,
        bool IsCustom,
        bool HideOverlay,
        bool SkipCounting,
        bool SkipCommands,
        bool SkipModeration,
        bool SkipSpeech);

    public static class BotCategories
    {
        public static readonly string[] All = { "competencia", "moderacion", "musica", "alertas", "utilidad", "propio" };
        public static readonly string[] Platforms = { "twitch", "kick", "youtube" };

        public static bool IsValidCategory(string? c) => c != null && System.Array.IndexOf(All, c) >= 0;
        public static bool IsValidPlatform(string? p) => p != null && System.Array.IndexOf(Platforms, p) >= 0;

        /// <summary>
        /// Efectos por defecto según la categoría. Competencia, moderación y la cuenta propia
        /// se esconden del todo; música, alertas y utilidad siguen visibles en el overlay pero
        /// no cuentan ni ejecutan comandos. Ningún bot se sanciona ni se lee en voz alta.
        /// </summary>
        public static (bool HideOverlay, bool SkipCounting, bool SkipCommands, bool SkipModeration, bool SkipSpeech) DefaultsFor(string category) =>
            category switch
            {
                "competencia" or "moderacion" or "propio" => (true, true, true, true, true),
                _ => (false, true, true, true, true)
            };
    }

    public interface IBotListService
    {
        /// <summary>Efectos si el usuario es un bot en ese canal; null si es una persona</summary>
        Task<BotEffects?> GetEffectsAsync(string platform, string channel, string username);

        Task<BotEffects?> GetEffectsAsync(string platform, long channelUserId, string username);

        /// <summary>Todos los bots activos del canal, por "plataforma:usuario"</summary>
        Task<IReadOnlyDictionary<string, BotEffects>> GetChannelBotsAsync(long channelUserId);

        void InvalidateChannel(long channelUserId);

        void InvalidateCatalog();
    }
}
