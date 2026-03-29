using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("giveaway_participants")]
    public class GiveawayParticipant
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("session_id")]
        public int SessionId { get; set; }

        // Usuario
        [Required]
        [Column("user_id")]
        [MaxLength(255)]
        public string UserId { get; set; } = string.Empty;

        [Required]
        [Column("username")]
        [MaxLength(255)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [Column("display_name")]
        [MaxLength(255)]
        public string DisplayName { get; set; } = string.Empty;

        // Metadata del usuario
        [Column("is_follower")]
        public bool IsFollower { get; set; } = false;

        [Column("is_subscriber")]
        public bool IsSubscriber { get; set; } = false;

        [Column("subscription_tier")]
        public byte? SubscriptionTier { get; set; }

        [Column("is_vip")]
        public bool IsVip { get; set; } = false;

        [Column("is_moderator")]
        public bool IsModerator { get; set; } = false;

        // Tiempos
        [Column("account_created_at")]
        public DateTime? AccountCreatedAt { get; set; }

        [Column("followed_at")]
        public DateTime? FollowedAt { get; set; }

        [Column("watch_time_minutes")]
        public int WatchTimeMinutes { get; set; } = 0;

        // Actividad
        [Column("chat_messages_count")]
        public int ChatMessagesCount { get; set; } = 0;

        [Column("bits_total")]
        public int BitsTotal { get; set; } = 0;

        [Column("sub_streak")]
        public int SubStreak { get; set; } = 0;

        // Entrada
        [Column("entered_at")]
        public DateTime EnteredAt { get; set; } = DateTime.UtcNow;

        [Column("entry_count")]
        public int EntryCount { get; set; } = 1;

        // Peso calculado
        [Column("calculated_weight")]
        public decimal CalculatedWeight { get; set; } = 1.0m;

        // IP hash
        [Column("ip_hash")]
        [MaxLength(64)]
        public string? IpHash { get; set; }
    }
}
