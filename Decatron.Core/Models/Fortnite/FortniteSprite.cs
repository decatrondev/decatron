using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Fortnite
{
    [Table("fortnite_sprites")]
    public class FortniteSprite
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("sprite_key")]
        [MaxLength(100)]
        public string SpriteKey { get; set; } = "";

        [Required]
        [Column("name")]
        [MaxLength(200)]
        public string Name { get; set; } = "";

        [Required]
        [Column("character")]
        [MaxLength(100)]
        public string Character { get; set; } = "";

        [Required]
        [Column("theme")]
        [MaxLength(50)]
        public string Theme { get; set; } = "";

        [Required]
        [Column("rarity")]
        [MaxLength(50)]
        public string Rarity { get; set; } = "";

        [Column("image_url")]
        [MaxLength(500)]
        public string? ImageUrl { get; set; }

        [Column("is_unreleased")]
        public bool IsUnreleased { get; set; } = false;

        [Column("season")]
        [MaxLength(50)]
        public string? Season { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<UserFortniteSprite> UserSprites { get; set; } = new List<UserFortniteSprite>();
    }
}
