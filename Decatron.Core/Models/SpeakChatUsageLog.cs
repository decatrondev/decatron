using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>Un mensaje que activó una regla de Speak Chat: se leyó o se descartó, y por qué. No guarda el texto.</summary>
    [Table("speak_chat_usage_log")]
    public class SpeakChatUsageLog
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        [Required, MaxLength(100)]
        [Column("channel_name")]
        public string ChannelName { get; set; } = string.Empty;

        [MaxLength(10)]
        [Column("platform")]
        public string Platform { get; set; } = "twitch";

        [MaxLength(100)]
        [Column("username")]
        public string Username { get; set; } = string.Empty;

        [MaxLength(20)]
        [Column("rule_type")]
        public string RuleType { get; set; } = string.Empty;

        [MaxLength(100)]
        [Column("command")]
        public string Command { get; set; } = string.Empty;

        [Required, MaxLength(30)]
        [Column("outcome")]
        public string Outcome { get; set; } = string.Empty;

        [MaxLength(10)]
        [Column("engine")]
        public string Engine { get; set; } = string.Empty;

        [MaxLength(100)]
        [Column("voice")]
        public string Voice { get; set; } = string.Empty;

        [Column("chars")]
        public int Chars { get; set; }

        [Column("credits")]
        public long? Credits { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
