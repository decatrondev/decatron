using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Happy Hour activado a mano por el streamer desde el panel.
    ///
    /// Vive en base y no en memoria a proposito: antes era un diccionario estatico y
    /// cualquier reinicio del backend lo borraba en silencio, en medio del stream.
    /// Una fila por canal como maximo; al activar de nuevo se pisa la anterior.
    /// </summary>
    [Table("timer_manual_happyhour")]
    public class TimerManualHappyHour
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        /// <summary>Login del canal en minusculas. Es la clave real de busqueda.</summary>
        [Required]
        [MaxLength(100)]
        [Column("channel_name")]
        public string ChannelName { get; set; } = string.Empty;

        [Required]
        [Column("multiplier")]
        public double Multiplier { get; set; } = 2.0;

        /// <summary>
        /// Momento de expiracion, guardado con la convencion del proyecto (hora de Lima,
        /// ver TimerDateTimeHelper.NowForDb). Para compararlo hay que normalizarlo a UTC.
        /// </summary>
        [Required]
        [Column("expires_at")]
        public DateTime ExpiresAt { get; set; }

        /// <summary>A qué eventos se aplica (JSON: ["sub","bits",...]). Null = a todos.</summary>
        [Column("event_types", TypeName = "jsonb")]
        public string? EventTypes { get; set; }

        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}
