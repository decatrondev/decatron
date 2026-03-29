namespace Decatron.Services
{
    public interface IMessageSender
    {
        Task SendMessageAsync(string channel, string message);
        void SendMessage(string channel, string message);
    }
}