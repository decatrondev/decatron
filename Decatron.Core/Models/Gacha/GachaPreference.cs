using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_preferences")]
    public class GachaPreference
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

        /// <summary>
        /// Null = global preference, set = participant-specific preference
        /// </summary>
        [Column("participant_id")]
        public int? ParticipantId { get; set; }

        [Required]
        [Column("probability_percentage")]
        public decimal ProbabilityPercentage { get; set; } = 0;

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("coin_probability_override")]
        public decimal? CoinProbabilityOverride { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("ItemId")]
        public virtual GachaItem? Item { get; set; }

        [ForeignKey("ParticipantId")]
        public virtual GachaParticipant? Participant { get; set; }
    }
}
