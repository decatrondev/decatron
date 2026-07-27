using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_item_restrictions")]
    public class GachaItemRestriction
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        [Column("user_id")]
        public long UserId { get; set; }

        [ForeignKey("UserId")]
        public Decatron.Core.Models.User? ChannelUser { get; set; }

        [Required]
        [Column("item_id")]
        public int ItemId { get; set; }

        [Column("min_donation_required")]
        public decimal MinDonationRequired { get; set; } = 0;

        [Column("total_quantity")]
        public int? TotalQuantity { get; set; }

        [Column("is_unique")]
        public bool IsUnique { get; set; } = false;

        [Column("cooldown_period")]
        [MaxLength(50)]
        public string CooldownPeriod { get; set; } = "none";

        [Column("cooldown_value")]
        public int CooldownValue { get; set; } = 0;

        [Column("allowed_pull_types")]
        [MaxLength(20)]
        public string AllowedPullTypes { get; set; } = "all";

        [Column("coin_min_spent")]
        public int? CoinMinSpent { get; set; }

        [Column("cumulative_donation_threshold")]
        public decimal? CumulativeDonationThreshold { get; set; }

        [Column("cumulative_coins_threshold")]
        public int? CumulativeCoinsThreshold { get; set; }

        [Column("cumulative_guarantee")]
        public bool CumulativeGuarantee { get; set; } = true;

        [Column("cumulative_probability")]
        public decimal? CumulativeProbability { get; set; }

        [Column("milestone_priority")]
        public int MilestonePriority { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("ItemId")]
        public virtual GachaItem? Item { get; set; }
    }
}
