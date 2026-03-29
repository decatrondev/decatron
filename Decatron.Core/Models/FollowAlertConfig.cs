using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Configuración de alertas de follows para un canal
    /// </summary>
    [Table("follow_alert_configs")]
    public class FollowAlertConfig
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
        /// Si las alertas de follow están habilitadas
        /// </summary>
        [Column("enabled")]
        public bool Enabled { get; set; } = true;

        /// <summary>
        /// Mensaje personalizado para agradecer el follow
        /// Variables: {username}
        /// </summary>
        [Column("message")]
        [MaxLength(500)]
        public string Message { get; set; } = "¡Gracias @{username} por el follow! ❤️";

        /// <summary>
        /// Cooldown en minutos para evitar spam del mismo usuario
        /// </summary>
        [Column("cooldown_minutes")]
        public int CooldownMinutes { get; set; } = 60;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
