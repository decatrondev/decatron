using Decatron.Core.Models;

namespace Decatron.Core.Interfaces
{
    public interface IBotService
    {
        Task<bool> ConnectToChanelAsync(string channelLogin);
        Task<bool> DisconnectFromChannelAsync(string channelLogin);
        bool IsConnected(string channelLogin);
        Task<IEnumerable<string>> GetConnectedChannelsAsync();
    }
}