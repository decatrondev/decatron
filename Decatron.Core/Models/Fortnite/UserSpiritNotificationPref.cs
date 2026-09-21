using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Fortnite
{
    [Table("user_spirit_notification_prefs")]
    public class UserSpiritNotificationPref
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        [Column("notify_twitch_chat")]
        public bool NotifyTwitchChat { get; set; } = false;

        [Column("notify_discord_dm")]
        public bool NotifyDiscordDm { get; set; } = false;

        [Column("last_notified_twitch_at")]
        public DateTime? LastNotifiedTwitchAt { get; set; }

        [Column("last_notified_discord_at")]
        public DateTime? LastNotifiedDiscordAt { get; set; }

        [Column("last_seen_dashboard_at")]
        public DateTime? LastSeenDashboardAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
