using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_pull_logs")]
    public class GachaPullLog
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

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

        [Required]
        [Column("action")]
        [MaxLength(50)]
        public string Action { get; set; } = "pull";

        [Column("amount")]
        public decimal? Amount { get; set; }

        [Column("occurred_at")]
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("ParticipantId")]
        public virtual GachaParticipant? Participant { get; set; }

        [ForeignKey("ItemId")]
        public virtual GachaItem? Item { get; set; }
    }
}
