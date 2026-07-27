using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_participants")]
    public class GachaParticipant
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
        [Column("name")]
        [MaxLength(255)]
        public string Name { get; set; } = "";

        [Column("twitch_user_id")]
        [MaxLength(50)]
        public string? TwitchUserId { get; set; }

        [Column("donation_amount")]
        public decimal DonationAmount { get; set; } = 0;

        [Column("effective_donation")]
        public decimal EffectiveDonation { get; set; } = 0;

        [Column("pulls")]
        public int Pulls { get; set; } = 0;

        [Column("coin_pulls_available")]
        public int CoinPullsAvailable { get; set; } = 0;

        [Column("coins_spent_total")]
        public int CoinsSpentTotal { get; set; } = 0;

        [Column("cumulative_donation_progress")]
        public decimal CumulativeDonationProgress { get; set; } = 0;

        [Column("cumulative_coins_progress")]
        public int CumulativeCoinsProgress { get; set; } = 0;

        [Column("milestone_won_items", TypeName = "jsonb")]
        public string MilestoneWonItems { get; set; } = "[]";

        [Column("display_name")]
        [MaxLength(100)]
        public string? DisplayName { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
