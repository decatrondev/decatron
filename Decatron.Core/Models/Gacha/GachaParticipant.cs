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

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
