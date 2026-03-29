using Decatron.Core.Models;
using System.Threading.Tasks;

namespace Decatron.Core.Interfaces
{
    public interface IEventAlertsService
    {
        Task<EventAlertsConfig?> GetConfig(long userId);
        Task<EventAlertsConfig?> GetConfigByChannel(string channelName);
        Task<EventAlertsConfig> SaveConfig(long userId, string channelName, string configJson);

        /// <summary>
        /// Reads the saved config for a channel, selects the matching alert (considering tiers),
        /// generates TTS if enabled, and sends ShowEventAlert via SignalR.
        /// </summary>
        Task TriggerAlertAsync(
            string channelName,
            string eventType,
            string username,
            string? userMessage = null,
            int amount = 0,
            string? subTier = null,
            int? months = null,
            int? level = null);
    }
}
