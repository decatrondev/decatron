using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("timer_sessions")]
    public class TimerSession
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("channel_name")]
        public string ChannelName { get; set; } = string.Empty;

        [Required]
        [Column("started_at")]
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;

        [Column("ended_at")]
        public DateTime? EndedAt { get; set; }

        [Required]
        [Column("initial_duration")]
        public int InitialDuration { get; set; }

        [Required]
        [Column("total_added_time")]
        public int TotalAddedTime { get; set; } = 0; // Cumulative time added during session

        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation property for logs
        public virtual ICollection<TimerEventLog> Logs { get; set; } = new List<TimerEventLog>();
    }
}