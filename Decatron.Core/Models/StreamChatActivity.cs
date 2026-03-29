using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Registra la actividad en chat de un usuario durante el stream actual
    /// Se resetea cuando el stream termina o inicia uno nuevo
    /// </summary>
    [Table("stream_chat_activities")]
    public class StreamChatActivity
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("channel_id")]
        [MaxLength(255)]
        public string ChannelId { get; set; } = string.Empty;

        [Required]
        [Column("user_id")]
        [MaxLength(255)]
        public string UserId { get; set; } = string.Empty;

        [Required]
        [Column("username")]
        [MaxLength(100)]
        public string Username { get; set; } = string.Empty;

        // Identificador del stream actual (para poder resetear entre streams)
        [Column("stream_id")]
        [MaxLength(255)]
        public string? StreamId { get; set; }

        // Número de mensajes enviados en este stream
        [Column("message_count")]
        public int MessageCount { get; set; } = 0;

        // Último mensaje enviado
        [Column("last_message_at")]
        public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
