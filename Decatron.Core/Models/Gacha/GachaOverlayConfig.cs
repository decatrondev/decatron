using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_overlay_configs")]
    public class GachaOverlayConfig
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        [Column("overlay_size")]
        [MaxLength(20)]
        public string OverlaySize { get; set; } = "standard";

        [Column("custom_width")]
        public int? CustomWidth { get; set; }

        [Column("custom_height")]
        public int? CustomHeight { get; set; }

        [Column("animation_speed")]
        public int AnimationSpeed { get; set; } = 10;

        [Column("enable_debug")]
        public bool EnableDebug { get; set; } = false;

        [Column("enable_sounds")]
        public bool EnableSounds { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
