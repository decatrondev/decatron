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

        [Column("user_id")]
        public long UserId { get; set; }

        [ForeignKey("UserId")]
        public User? ChannelUser { get; set; }

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

        /// <summary>
        /// Filtro que disparó la acción (banned_words, links, ...)
        /// </summary>
        [Column("filter_key")]
        public string FilterKey { get; set; } = "banned_words";

        /// <summary>
        /// Quién ejecutó la acción; null = el bot automáticamente
        /// </summary>
        [Column("executed_by")]
        public string? ExecutedBy { get; set; }

        /// <summary>
        /// Cuándo y quién la deshizo desde el historial (null = sigue vigente)
        /// </summary>
        [Column("undone_at")]
        public DateTime? UndoneAt { get; set; }

        [Column("undone_by")]
        public string? UndoneBy { get; set; }

        /// <summary>
        /// Id de plataforma de quien fue sancionado (Kick sanciona y quita sanciones por id)
        /// </summary>
        [Column("target_user_id")]
        public string? TargetUserId { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
