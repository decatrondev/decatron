namespace Decatron.Core.Interfaces
{
    public interface IMessageSender
    {
        Task SendMessageAsync(string channel, string message);
        void SendMessage(string channel, string message);
    }
}