using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_command_configs")]
    public class GachaCommandConfig
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
        [Column("command")]
        [MaxLength(50)]
        public string Command { get; set; } = "";

        [Column("enabled")]
        public bool Enabled { get; set; } = true;

        [Column("permission")]
        [MaxLength(20)]
        public string Permission { get; set; } = "everyone";

        [Column("cooldown_global")]
        public int CooldownGlobal { get; set; } = 0;

        [Column("cooldown_user")]
        public int CooldownUser { get; set; } = 3;

        [Column("custom_response")]
        public string? CustomResponse { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
