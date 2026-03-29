using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Historial de follows procesados (para cooldown)
    /// </summary>
    [Table("follow_alert_history")]
    public class FollowAlertHistory
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        /// <summary>
        /// Nombre del canal donde ocurrió el follow
        /// </summary>
        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        /// <summary>
        /// Usuario que dio follow
        /// </summary>
        [Required]
        [Column("follower_username")]
        [MaxLength(100)]
        public string FollowerUsername { get; set; } = "";

        /// <summary>
        /// Fecha del follow
        /// </summary>
        [Column("followed_at")]
        public DateTime FollowedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Si se envió mensaje o no (por cooldown)
        /// </summary>
        [Column("message_sent")]
        public bool MessageSent { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
