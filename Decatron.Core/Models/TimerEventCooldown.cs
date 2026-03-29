using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("timer_event_cooldowns")]
    public class TimerEventCooldown
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [Column("channel_name")]
        [MaxLength(255)]
        public string ChannelName { get; set; }

        [Required]
        [Column("event_type")]
        [MaxLength(50)]
        public string EventType { get; set; } // 'follow', 'bits', 'sub', etc.

        [Required]
        [Column("user_id")]
        [MaxLength(255)]
        public string UserId { get; set; } // Twitch User ID

        [Column("user_name")]
        [MaxLength(255)]
        public string UserName { get; set; } // Para logs/debugging

        [Required]
        [Column("last_triggered_at")]
        public DateTime LastTriggeredAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }
    }
}
