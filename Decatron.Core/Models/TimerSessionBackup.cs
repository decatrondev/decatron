using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("timer_session_backups")]
    public class TimerSessionBackup
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("channel_name")]
        [Required]
        [MaxLength(100)]
        public string ChannelName { get; set; } = string.Empty;

        [Column("remaining_seconds")]
        public int RemainingSeconds { get; set; }

        [Column("total_elapsed_seconds")]
        public int TotalElapsedSeconds { get; set; }

        [Column("total_duration_at_snapshot")]
        public int TotalDurationAtSnapshot { get; set; }

        [Column("timer_session_id")]
        public int? TimerSessionId { get; set; } // Referencia exacta a la sesión de historial

        [Column("reason")]
        [MaxLength(255)]
        public string? Reason { get; set; } // "manual", "auto_save", "emergency_stop", "manual_stop"

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}