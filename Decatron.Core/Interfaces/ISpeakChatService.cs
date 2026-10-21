using Decatron.Core.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Decatron.Core.Interfaces
{
    public interface ISpeakChatService
    {
        Task<SpeakChatConfig?> GetConfigAsync(long userId);
        Task<SpeakChatConfig?> GetConfigByChannelAsync(string channelName);
        Task<SpeakChatConfig> SaveConfigAsync(long userId, string channelName, string configJson);

        /// <summary>
        /// Punto de entrada principal desde el chat de Twitch.
        /// Verifica reglas de activación, tier, cooldowns, genera TTS y envía via SignalR.
        /// </summary>
        Task ProcessChatMessageAsync(
            string channelName,
            string username,
            string userId,
            string message,
            bool isBroadcaster,
            bool isModerator,
            bool isVip,
            bool isSubscriber,
            int bitsAmount,
            string? channelPointsRewardId,
            Dictionary<string, object>? metadata,
            // Twitch reparte la insignia de lead_moderator EN LUGAR de la de moderator,
            // así que un mod líder llega aquí con isModerator=false. Sin este dato se le
            // niega el TTS aunque tenga más rango que un moderador normal.
            bool isLeadModerator = false,
            // "twitch" o "kick": de dónde llegó el mensaje. Cada regla elige en qué plataformas lee.
            string platform = "twitch",
            // Dónde contestar (aviso de «sin saldo»): login de Twitch o id de Kick. Sin valor, el canal.
            string? replyChannel = null);

        /// <summary>
        /// Punto de entrada desde el evento de canje de puntos de canal.
        /// Cubre las recompensas que no generan mensaje de chat; si el canje ya se
        /// procesó por el flujo de chat, se descarta por deduplicación.
        /// </summary>
        Task ProcessChannelPointRedemptionAsync(
            string channelName,
            string username,
            string userId,
            string rewardId,
            string? userInput,
            bool isBroadcaster);

        /// <summary>
        /// El texto tal como lo leería Speak Chat tras la limpieza que el canal eligió en Filtros
        /// (enlaces, emotes, letras repetidas, emojis). Sirve a la prueba y al estimado de costo.
        /// </summary>
        Task<string> CleanForSpeechAsync(string channelName, string configJson, string text);
    }
}
