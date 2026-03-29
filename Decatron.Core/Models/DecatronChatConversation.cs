using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("decatron_chat_conversations")]
    public class DecatronChatConversation
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("user_id")]
        [Required]
        public long UserId { get; set; }

        [Column("channel_owner_id")]
        [Required]
        public long ChannelOwnerId { get; set; }

        [Column("title")]
        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = "Nueva conversación";

        [Column("message_count")]
        public int MessageCount { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
