using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("giveaway_blacklist")]
    public class GiveawayBlacklist
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("channel_id")]
        [MaxLength(255)]
        public string ChannelId { get; set; } = string.Empty;

        [Required]
        [Column("user_id")]
        [MaxLength(255)]
        public string UserId { get; set; } = string.Empty;

        [Required]
        [Column("username")]
        [MaxLength(255)]
        public string Username { get; set; } = string.Empty;

        // Razón
        [Column("reason")]
        public string? Reason { get; set; }

        // Metadata
        [Column("added_at")]
        public DateTime AddedAt { get; set; } = DateTime.UtcNow;

        [Column("added_by")]
        [MaxLength(255)]
        public string? AddedBy { get; set; }
    }
}
