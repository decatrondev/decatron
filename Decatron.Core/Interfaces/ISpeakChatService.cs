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
            Dictionary<string, object>? metadata);

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
    }
}
