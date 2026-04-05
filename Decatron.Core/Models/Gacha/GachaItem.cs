using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_items")]
    public class GachaItem
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

        [Required]
        [Column("rarity")]
        [MaxLength(50)]
        public string Rarity { get; set; } = "common";

        [Column("image")]
        [MaxLength(500)]
        public string? Image { get; set; }

        [Column("available")]
        public bool Available { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
