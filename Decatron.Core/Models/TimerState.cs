using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("timer_states")]
    public class TimerState
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("channel_name")]
        public string ChannelName { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        [Column("status")]
        public string Status { get; set; } = "stopped"; // stopped, running, paused

        [Required]
        [Column("time_remaining")]
        public int CurrentTime { get; set; } // segundos restantes

        [Required]
        [Column("total_time")]
        public int TotalTime { get; set; } // tiempo total configurado

        [Column("started_at")]
        public DateTime? StartedAt { get; set; }

        [Column("paused_at")]
        public DateTime? PausedAt { get; set; }

        [Column("stopped_at")]
        public DateTime? StoppedAt { get; set; }

        [Column("elapsed_paused_time")]
        public int ElapsedPausedTime { get; set; } // tiempo total en pausa (segundos)

        [Required]
        [Column("is_visible")]
        public bool IsVisible { get; set; } = false;

        [Column("used_chances")]
        public int UsedChances { get; set; } = 0;

        [Column("current_session_id")]
        public int? CurrentSessionId { get; set; }

        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
