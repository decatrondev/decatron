using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    /// <summary>Achievement definitions — seeded per channel or global</summary>
    [Table("gacha_achievements")]
    public class GachaAchievement
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        /// <summary>null = global achievement, set = channel-specific</summary>
        [Column("channel_name")]
        [MaxLength(100)]
        public string? ChannelName { get; set; }

        [Required]
        [Column("code")]
        [MaxLength(50)]
        public string Code { get; set; } = "";

        [Required]
        [Column("name")]
        [MaxLength(100)]
        public string Name { get; set; } = "";

        [Column("description")]
        [MaxLength(255)]
        public string Description { get; set; } = "";

        [Column("icon")]
        [MaxLength(10)]
        public string Icon { get; set; } = "";

        /// <summary>Rarity of the badge: common, rare, epic, legendary</summary>
        [Column("badge_rarity")]
        [MaxLength(20)]
        public string BadgeRarity { get; set; } = "common";

        /// <summary>Auto-check condition type: pulls_count, unique_cards, rarity_count, first_pull, donation_total, collection_complete</summary>
        [Column("condition_type")]
        [MaxLength(50)]
        public string ConditionType { get; set; } = "";

        /// <summary>Threshold value for the condition (e.g., 100 for "100 pulls")</summary>
        [Column("condition_value")]
        public int ConditionValue { get; set; } = 0;

        /// <summary>Extra condition param (e.g., "legendary" for "get X legendaries")</summary>
        [Column("condition_param")]
        [MaxLength(50)]
        public string? ConditionParam { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>Achievements unlocked by viewers</summary>
    [Table("gacha_user_achievements")]
    public class GachaUserAchievement
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("participant_id")]
        public int ParticipantId { get; set; }

        [Required]
        [Column("achievement_id")]
        public int AchievementId { get; set; }

        [Column("unlocked_at")]
        public DateTime UnlockedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ParticipantId")]
        public virtual GachaParticipant? Participant { get; set; }

        [ForeignKey("AchievementId")]
        public virtual GachaAchievement? Achievement { get; set; }
    }

    /// <summary>Viewer showcase — featured cards (max 5)</summary>
    [Table("gacha_showcases")]
    public class GachaShowcase
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("participant_id")]
        public int ParticipantId { get; set; }

        [Required]
        [Column("item_id")]
        public int ItemId { get; set; }

        [Column("position")]
        public int Position { get; set; } = 0;

        [Column("added_at")]
        public DateTime AddedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ParticipantId")]
        public virtual GachaParticipant? Participant { get; set; }

        [ForeignKey("ItemId")]
        public virtual GachaItem? Item { get; set; }
    }

    /// <summary>Viewer wishlist — cards they want</summary>
    [Table("gacha_wishlists")]
    public class GachaWishlist
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("participant_id")]
        public int ParticipantId { get; set; }

        [Required]
        [Column("item_id")]
        public int ItemId { get; set; }

        [Column("added_at")]
        public DateTime AddedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("ParticipantId")]
        public virtual GachaParticipant? Participant { get; set; }

        [ForeignKey("ItemId")]
        public virtual GachaItem? Item { get; set; }
    }
}
