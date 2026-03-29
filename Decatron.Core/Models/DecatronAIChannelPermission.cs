using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("decatron_ai_channel_permissions")]
    public class DecatronAIChannelPermission
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("channel_name")]
        [Required]
        [MaxLength(100)]
        public string ChannelName { get; set; } = string.Empty;

        [Column("enabled")]
        public bool Enabled { get; set; } = true;

        [Column("can_configure")]
        public bool CanConfigure { get; set; } = false;

        [Column("notes")]
        public string? Notes { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
