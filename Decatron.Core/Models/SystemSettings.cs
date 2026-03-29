namespace Decatron.Core.Models
{
    public class SystemSettings
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public bool BotEnabled { get; set; } = true;
        public bool CommandsEnabled { get; set; } = true;
        public int CommandCooldown { get; set; } = 5;
        public bool TimersEnabled { get; set; } = true;
        public int TimerMinMessages { get; set; } = 5;

        /// <summary>
        /// Delay en segundos entre timer y timer (cooldown global por canal)
        /// </summary>
        public int TimerGlobalCooldownSeconds { get; set; } = 30;

        /// <summary>
        /// Contador de mensajes desde el último timer enviado (cualquier timer)
        /// </summary>
        public int MessageCountSinceLastTimer { get; set; } = 0;

        public bool AutoModerationEnabled { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class UserAccess
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public long AuthorizedUserId { get; set; }
        public string PermissionLevel { get; set; } // "commands", "moderation", "admin"
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}