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

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("ItemId")]
        public virtual GachaItem? Item { get; set; }
    }
}
