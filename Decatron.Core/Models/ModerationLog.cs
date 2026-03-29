using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Log de detecciones y acciones de moderación
    /// </summary>
    [Table("moderation_logs")]
    public class ModerationLog
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        /// <summary>
        /// Nombre del canal donde ocurrió la detección
        /// </summary>
        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        /// <summary>
        /// Usuario que envió el mensaje
        /// </summary>
        [Required]
        [Column("username")]
        [MaxLength(100)]
        public string Username { get; set; } = "";

        /// <summary>
        /// Palabra o patrón detectado
        /// </summary>
        [Required]
        [Column("detected_word")]
        [MaxLength(500)]
        public string DetectedWord { get; set; } = "";

        /// <summary>
        /// Severidad de la palabra detectada
        /// </summary>
        [Column("severity")]
        [MaxLength(20)]
        public string Severity { get; set; } = "";

        /// <summary>
        /// Acción tomada: warning, delete, timeout_Xs, ban
        /// </summary>
        [Column("action_taken")]
        [MaxLength(50)]
        public string ActionTaken { get; set; } = "";

        /// <summary>
        /// Nivel de strike del usuario al momento de la infracción
        /// </summary>
        [Column("strike_level")]
        public int StrikeLevel { get; set; } = 0;

        /// <summary>
        /// Mensaje completo (opcional, para análisis)
        /// </summary>
        [Column("full_message")]
        public string? FullMessage { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
