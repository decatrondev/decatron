using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("tier_features")]
    public class TierFeature
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("tier")]
        [MaxLength(20)]
        public string Tier { get; set; } = string.Empty;

        [Column("feature_key")]
        [MaxLength(50)]
        public string FeatureKey { get; set; } = string.Empty;

        [Column("feature_value")]
        [MaxLength(255)]
        public string FeatureValue { get; set; } = string.Empty;

        [Column("description")]
        public string? Description { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
