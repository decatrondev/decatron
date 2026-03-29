using System.Collections.Generic;

namespace Decatron.Core.Models
{
    public class CommandContext
    {
        public string Username { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public string Channel { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? MessageId { get; set; }
        public bool IsModerator { get; set; }
        public bool IsVip { get; set; }
        public bool IsSubscriber { get; set; }
        public bool IsBroadcaster { get; set; }
        public Dictionary<string, object> Metadata { get; set; } = new Dictionary<string, object>();

        public CommandContext(string username, string channel, string message, string userId)
        {
            Username = username;
            Channel = channel;
            Message = message;
            UserId = userId;
        }
    }
}
