using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Historial de acciones de seguimiento (follow, unfollow, block, unblock)
    /// </summary>
    [Table("follower_history")]
    public class FollowerHistory
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        /// <summary>
        /// ID de Twitch del broadcaster
        /// </summary>
        [Required]
        [Column("broadcaster_id")]
        [MaxLength(50)]
        public string BroadcasterId { get; set; } = "";

        /// <summary>
        /// ID de Twitch del seguidor
        /// </summary>
        [Required]
        [Column("user_id")]
        [MaxLength(50)]
        public string UserId { get; set; } = "";

        /// <summary>
        /// Tipo de acción: 0 = Follow, 1 = Unfollow, 2 = Block, 3 = Unblock
        /// </summary>
        [Required]
        [Column("action")]
        public int Action { get; set; }

        /// <summary>
        /// Fecha y hora en que ocurrió la acción
        /// </summary>
        [Required]
        [Column("action_timestamp")]
        public DateTime ActionTimestamp { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Fecha de creación del registro (auditoría)
        /// </summary>
        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
