using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("speak_chat_configs")]
    public class SpeakChatConfig
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("channel_name")]
        public string ChannelName { get; set; } = string.Empty;

        [Column("is_enabled")]
        public bool IsEnabled { get; set; } = false;

        [Required]
        [Column("config_json", TypeName = "jsonb")]
        public string ConfigJson { get; set; } = "{}";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}
