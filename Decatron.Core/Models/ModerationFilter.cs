using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Interruptor y configuración de un filtro de moderación en un canal.
    /// Sin fila, el filtro está apagado.
    /// </summary>
    [Table("moderation_filters")]
    public class ModerationFilter
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        /// <summary>
        /// banned_words, links, ...
        /// </summary>
        [Required]
        [Column("filter_key")]
        [MaxLength(30)]
        public string FilterKey { get; set; } = "";

        [Column("enabled")]
        public bool Enabled { get; set; }

        /// <summary>
        /// leve | medio | severo. banned_words no la usa: cada palabra trae la suya.
        /// </summary>
        [Column("severity")]
        [MaxLength(20)]
        public string Severity { get; set; } = "leve";

        /// <summary>
        /// Parámetros propios del filtro (JSON)
        /// </summary>
        [Column("settings", TypeName = "jsonb")]
        public string Settings { get; set; } = "{}";

        /// <summary>
        /// Mensaje del chat al sancionar; null = los mensajes por acción de ModerationConfig
        /// </summary>
        [Column("message")]
        [MaxLength(500)]
        public string? Message { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}
