using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_sound_configs")]
    public class GachaSoundConfig
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

        [Column("master_volume")]
        public int MasterVolume { get; set; } = 80;

        [Column("enable_sounds")]
        public bool EnableSounds { get; set; } = false;

        [Column("sounds_json", TypeName = "jsonb")]
        public string SoundsJson { get; set; } = "{}";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
