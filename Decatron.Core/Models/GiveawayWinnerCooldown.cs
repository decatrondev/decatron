using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("giveaway_winner_cooldowns")]
    public class GiveawayWinnerCooldown
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("channel_id")]
        [MaxLength(255)]
        public string ChannelId { get; set; } = string.Empty;

        [Required]
        [Column("user_id")]
        [MaxLength(255)]
        public string UserId { get; set; } = string.Empty;

        [Required]
        [Column("username")]
        [MaxLength(255)]
        public string Username { get; set; } = string.Empty;

        // Cooldown
        [Column("won_at")]
        public DateTime WonAt { get; set; } = DateTime.UtcNow;

        [Required]
        [Column("cooldown_until")]
        public DateTime CooldownUntil { get; set; }

        // Referencia
        [Column("session_id")]
        public int? SessionId { get; set; }

        [Column("prize_name")]
        [MaxLength(500)]
        public string? PrizeName { get; set; }
    }
}
