using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Palabra o frase prohibida en el chat de un canal
    /// </summary>
    [Table("banned_words")]
    public class BannedWord
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        /// <summary>
        /// ID del usuario propietario del canal
        /// </summary>
        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        /// <summary>
        /// Nombre del canal (lowercase)
        /// </summary>
        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        /// <summary>
        /// Palabra o frase prohibida (puede contener wildcards con *)
        /// </summary>
        [Required]
        [Column("word")]
        [MaxLength(500)]
        public string Word { get; set; } = "";

        /// <summary>
        /// Nivel de severidad: leve, medio, severo
        /// </summary>
        [Required]
        [Column("severity")]
        [MaxLength(20)]
        public string Severity { get; set; } = "leve";

        /// <summary>
        /// Número de veces que se ha detectado esta palabra
        /// </summary>
        [Column("detections")]
        public int Detections { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
