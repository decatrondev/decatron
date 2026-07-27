using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_command_aliases")]
    public class GachaCommandAlias
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
        [Column("alias")]
        [MaxLength(50)]
        public string Alias { get; set; } = "";

        [Required]
        [Column("target_command")]
        [MaxLength(50)]
        public string TargetCommand { get; set; } = "";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
