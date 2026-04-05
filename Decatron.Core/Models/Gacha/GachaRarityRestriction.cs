using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_rarity_restrictions")]
    public class GachaRarityRestriction
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        [Column("item_id")]
        public int? ItemId { get; set; }

        [Column("participant_id")]
        public int? ParticipantId { get; set; }

        [Column("rarity")]
        [MaxLength(50)]
        public string? Rarity { get; set; }

        [Column("pull_interval")]
        public int? PullInterval { get; set; }

        [Column("time_interval")]
        public int? TimeInterval { get; set; }

        [Column("time_unit")]
        [MaxLength(20)]
        public string? TimeUnit { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

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
