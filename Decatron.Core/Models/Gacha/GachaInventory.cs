using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_inventory")]
    public class GachaInventory
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        [Required]
        [Column("participant_id")]
        public int ParticipantId { get; set; }

        [Required]
        [Column("item_id")]
        public int ItemId { get; set; }

        [Column("quantity")]
        public int Quantity { get; set; } = 1;

        [Column("is_redeemed")]
        public bool IsRedeemed { get; set; } = false;

        [Column("last_won_at")]
        public DateTime LastWonAt { get; set; } = DateTime.UtcNow;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("ParticipantId")]
        public virtual GachaParticipant? Participant { get; set; }

        [ForeignKey("ItemId")]
        public virtual GachaItem? Item { get; set; }
    }
}
