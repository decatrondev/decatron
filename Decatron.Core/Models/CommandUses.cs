using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Contador simple que solo incrementa cada vez que se usa
    /// Usado por $(uses)
    /// </summary>
    [Table("command_uses")]
    public class CommandUses
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

        [Column("use_count")]
        public int UseCount { get; set; } = 0;

        [Column("last_used_at")]
        public DateTime LastUsedAt { get; set; } = DateTime.UtcNow;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
