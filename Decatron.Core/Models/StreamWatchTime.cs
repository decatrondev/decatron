using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Registra el tiempo que un usuario ha estado viendo el stream actual
    /// Se resetea cuando el stream termina o inicia uno nuevo
    /// </summary>
    [Table("stream_watch_times")]
    public class StreamWatchTime
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

        // Tiempo total viendo en minutos
        [Column("total_minutes")]
        public int TotalMinutes { get; set; } = 0;

        // Última vez que se vio al usuario en el chat
        [Column("last_seen_at")]
        public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;

        // Si el usuario está actualmente viendo (en el chat)
        [Column("is_active")]
        public bool IsActive { get; set; } = false;

        // Timestamp de inicio de la sesión actual
        [Column("session_started_at")]
        public DateTime? SessionStartedAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
