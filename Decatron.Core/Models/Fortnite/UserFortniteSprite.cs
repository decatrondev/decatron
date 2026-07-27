using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Fortnite
{
    [Table("user_fortnite_sprites")]
    public class UserFortniteSprite
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }

        [Required]
        [Column("sprite_id")]
        public int SpriteId { get; set; }

        [ForeignKey("SpriteId")]
        public FortniteSprite? Sprite { get; set; }

        [Column("obtained_at")]
        public DateTime ObtainedAt { get; set; } = DateTime.UtcNow;

        [Column("platform")]
        [MaxLength(20)]
        public string Platform { get; set; } = "web";
    }
}
