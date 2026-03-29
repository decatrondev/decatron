using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("tier_history")]
    public class TierHistory
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        [Column("previous_tier")]
        [MaxLength(20)]
        public string? PreviousTier { get; set; }

        [Column("new_tier")]
        [MaxLength(20)]
        public string NewTier { get; set; } = string.Empty;

        [Column("change_reason")]
        [MaxLength(100)]
        public string? ChangeReason { get; set; }

        [Column("source")]
        [MaxLength(50)]
        public string? Source { get; set; }

        [Column("source_reference")]
        [MaxLength(255)]
        public string? SourceReference { get; set; }

        [Column("changed_by")]
        public long? ChangedBy { get; set; }

        [Column("changed_at")]
        public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey("UserId")]
        public User? User { get; set; }

        [ForeignKey("ChangedBy")]
        public User? ChangedByUser { get; set; }
    }
}
