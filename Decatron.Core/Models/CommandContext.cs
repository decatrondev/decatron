using System.Collections.Generic;

namespace Decatron.Core.Models
{
    public class CommandContext
    {
        public string Username { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public string Channel { get; set; } = string.Empty;
        public long? ChannelUserId { get; set; }
        public string? ChannelTwitchId { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? MessageId { get; set; }
        /// <summary>
        /// Si el usuario modera el canal, sea moderador normal o mod líder.
        ///
        /// Twitch reparte la insignia de <c>lead_moderator</c> **en lugar** de la de
        /// <c>moderator</c>, no además de ella. Quien lea solo el dato en crudo acaba
        /// negándole el paso al usuario con más rango, que es justo al revés de lo que
        /// pretendía. Ha pasado ya varias veces, así que se resuelve aquí y no en cada
        /// comando: quien pregunte por un moderador obtiene la respuesta correcta.
        ///
        /// Para distinguir los dos niveles está <see cref="IsLeadModerator"/>, y los
        /// comandos que lo hacen lo consultan primero.
        /// </summary>
        public bool IsModerator
        {
            get => _isModerator || IsLeadModerator;
            set => _isModerator = value;
        }
        private bool _isModerator;

        public bool IsLeadModerator { get; set; }
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
