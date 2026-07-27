using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_rarity_configs")]
    public class GachaRarityConfig
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
        [Column("rarity")]
        [MaxLength(50)]
        public string Rarity { get; set; } = "";

        [Required]
        [Column("probability")]
        public decimal Probability { get; set; }

        [Column("coin_probability")]
        public decimal? CoinProbability { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
