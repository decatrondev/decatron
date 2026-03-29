using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("timer_event_logs")]
    public class TimerEventLog
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("channel_name")]
        public string ChannelName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        [Column("event_type")]
        public string EventType { get; set; } = string.Empty; // bits, follow, sub, gift, raid, hypetrain, command

        [Required]
        [MaxLength(100)]
        [Column("username")]
        public string Username { get; set; } = string.Empty;

        [MaxLength(50)]
        [Column("user_id")]
        public string? UserId { get; set; }

        [Required]
        [Column("time_added")]
        public int TimeAdded { get; set; } // segundos (puede ser negativo)

        [MaxLength(500)]
        [Column("details")]
        public string? Details { get; set; }

        [Column("event_data", TypeName = "jsonb")]
        public string? EventData { get; set; } // datos adicionales en JSON

        [Column("timer_session_id")]
        public int? TimerSessionId { get; set; }

        [Required]
        [Column("occurred_at")]
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;

        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("TimerSessionId")]
        public virtual TimerSession? TimerSession { get; set; }
    }
}
