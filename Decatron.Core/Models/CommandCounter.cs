using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Contador avanzado con operaciones: +, -, set, reset
    /// Usado por $(count)
    /// </summary>
    [Table("command_counters")]
    public class CommandCounter
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("channel_name")]
        public string ChannelName { get; set; } = "";

        [Required]
        [MaxLength(100)]
        [Column("command_name")]
        public string CommandName { get; set; } = "";

        [Column("counter_value")]
        public int CounterValue { get; set; } = 0;

        [MaxLength(100)]
        [Column("last_modified_by")]
        public string? LastModifiedBy { get; set; }

        [Column("last_modified_at")]
        public DateTime LastModifiedAt { get; set; } = DateTime.UtcNow;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
