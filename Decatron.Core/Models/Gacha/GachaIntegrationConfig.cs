using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_integration_configs")]
    public class GachaIntegrationConfig
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        // Tips/PayPal
        [Column("tips_enabled")]
        public bool TipsEnabled { get; set; } = false;

        [Column("pulls_per_dollar")]
        public int PullsPerDollar { get; set; } = 1;

        // Bits
        [Column("bits_enabled")]
        public bool BitsEnabled { get; set; } = false;

        [Column("bits_per_pull")]
        public int BitsPerPull { get; set; } = 100;

        // Subscriptions
        [Column("subs_enabled")]
        public bool SubsEnabled { get; set; } = false;

        [Column("pulls_sub_prime")]
        public int PullsSubPrime { get; set; } = 1;

        [Column("pulls_sub_tier1")]
        public int PullsSubTier1 { get; set; } = 2;

        [Column("pulls_sub_tier2")]
        public int PullsSubTier2 { get; set; } = 3;

        [Column("pulls_sub_tier3")]
        public int PullsSubTier3 { get; set; } = 5;

        // Gift Subs
        [Column("gift_subs_enabled")]
        public bool GiftSubsEnabled { get; set; } = false;

        [Column("pulls_per_gift")]
        public int PullsPerGift { get; set; } = 1;

        // DecaCoins
        [Column("coins_enabled")]
        public bool CoinsEnabled { get; set; } = false;

        [Column("coins_per_pull")]
        public int CoinsPerPull { get; set; } = 500;

        /// <summary>0 = sin limite, X = maximo tiros por dia por viewer</summary>
        [Column("coins_daily_limit")]
        public int CoinsDailyLimit { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
