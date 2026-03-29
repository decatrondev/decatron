using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Representa un seguidor de un canal de Twitch con tracking completo
    /// </summary>
    [Table("channel_followers")]
    public class ChannelFollower
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        /// <summary>
        /// ID de Twitch del broadcaster/streamer
        /// </summary>
        [Required]
        [Column("broadcaster_id")]
        [MaxLength(50)]
        public string BroadcasterId { get; set; } = "";

        /// <summary>
        /// Nombre del broadcaster
        /// </summary>
        [Required]
        [Column("broadcaster_name")]
        [MaxLength(100)]
        public string BroadcasterName { get; set; } = "";

        /// <summary>
        /// ID de Twitch del seguidor
        /// </summary>
        [Required]
        [Column("user_id")]
        [MaxLength(50)]
        public string UserId { get; set; } = "";

        /// <summary>
        /// Nombre display del seguidor
        /// </summary>
        [Required]
        [Column("user_name")]
        [MaxLength(150)]
        public string UserName { get; set; } = "";

        /// <summary>
        /// Login (username lowercase) del seguidor
        /// </summary>
        [Required]
        [Column("user_login")]
        [MaxLength(100)]
        public string UserLogin { get; set; } = "";

        /// <summary>
        /// Fecha en que el usuario comenzó a seguir el canal por primera vez
        /// </summary>
        [Required]
        [Column("followed_at")]
        public DateTime FollowedAt { get; set; }

        /// <summary>
        /// Fecha de creación de la cuenta de Twitch del seguidor
        /// </summary>
        [Column("account_created_at")]
        public DateTime? AccountCreatedAt { get; set; }

        /// <summary>
        /// Estado del follow: 0 = actualmente siguiendo, 1 = unfollowed
        /// </summary>
        [Required]
        [Column("is_following")]
        public int IsFollowing { get; set; } = 0;

        /// <summary>
        /// Fecha del último unfollow (si aplicable)
        /// </summary>
        [Column("unfollowed_at")]
        public DateTime? UnfollowedAt { get; set; }

        /// <summary>
        /// Si el usuario está actualmente bloqueado: 0 = no, 1 = sí
        /// </summary>
        [Required]
        [Column("is_blocked")]
        public int IsBlocked { get; set; } = 0;

        /// <summary>
        /// Si el usuario alguna vez fue bloqueado: 0 = nunca, 1 = al menos una vez
        /// </summary>
        [Required]
        [Column("was_blocked")]
        public int WasBlocked { get; set; } = 0;

        /// <summary>
        /// Fecha de creación del registro (auditoría)
        /// </summary>
        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Fecha de última actualización del registro (auditoría)
        /// </summary>
        [Required]
        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
