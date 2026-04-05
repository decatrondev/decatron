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

        /// <summary>Tips → Gacha: auto-convert donations to pulls</summary>
        [Column("tips_enabled")]
        public bool TipsEnabled { get; set; } = false;

        /// <summary>Pulls per dollar donated (default 1)</summary>
        [Column("pulls_per_dollar")]
        public int PullsPerDollar { get; set; } = 1;

        /// <summary>DecaCoins → Gacha: allow purchasing pulls with coins</summary>
        [Column("coins_enabled")]
        public bool CoinsEnabled { get; set; } = false;

        /// <summary>Coins required per pull</summary>
        [Column("coins_per_pull")]
        public int CoinsPerPull { get; set; } = 100;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
