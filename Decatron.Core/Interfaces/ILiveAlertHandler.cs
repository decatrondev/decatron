using System.Threading.Tasks;

namespace Decatron.Core.Interfaces
{
    /// <summary>
    /// Puente hacia las alertas de Discord de stream online/offline. Vive en Core
    /// porque Decatron.Business no puede referenciar Decatron.Discord directamente
    /// (Discord ya depende de Business — sería un ciclo). La implementación real
    /// (Decatron.Discord.Events.LiveAlertHandler) se registra contra esta interfaz.
    /// </summary>
    public interface ILiveAlertHandler
    {
        Task SendLiveAlertAsync(string channelName, string broadcasterUserId);
        Task HandleStreamOfflineAsync(string channelName);
    }
}
