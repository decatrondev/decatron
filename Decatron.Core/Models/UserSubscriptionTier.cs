using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("user_subscription_tiers")]
    public class UserSubscriptionTier
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        [Column("tier")]
        [MaxLength(20)]
        public string Tier { get; set; } = "free";

        [Column("tier_started_at")]
        public DateTimeOffset TierStartedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("tier_expires_at")]
        public DateTimeOffset? TierExpiresAt { get; set; }

        [Column("source")]
        [MaxLength(50)]
        public string? Source { get; set; }

        [Column("source_reference")]
        [MaxLength(255)]
        public string? SourceReference { get; set; }

        [Column("amount_paid")]
        public decimal? AmountPaid { get; set; }

        [Column("currency")]
        [MaxLength(10)]
        public string? Currency { get; set; }

        [Column("notes")]
        public string? Notes { get; set; }

        [Column("granted_by")]
        public long? GrantedBy { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey("UserId")]
        public User? User { get; set; }

        [ForeignKey("GrantedBy")]
        public User? GrantedByUser { get; set; }
    }
}
