using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("decatron_chat_messages")]
    public class DecatronChatMessage
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("conversation_id")]
        [Required]
        public Guid ConversationId { get; set; }

        [Column("user_id")]
        [Required]
        public long UserId { get; set; }

        [Column("role")]
        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = "user"; // "user" o "assistant"

        [Column("content")]
        [Required]
        public string Content { get; set; } = string.Empty;

        [Column("tokens_used")]
        public int TokensUsed { get; set; } = 0;

        [Column("response_time_ms")]
        public int ResponseTimeMs { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
