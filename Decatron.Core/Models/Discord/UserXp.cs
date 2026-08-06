using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("user_xp")]
public class UserXp
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Required]
    [Column("guild_id")]
    [MaxLength(30)]
    public string GuildId { get; set; } = string.Empty;

    [Required]
    [Column("user_id")]
    [MaxLength(30)]
    public string UserId { get; set; } = string.Empty;

    [Column("username")]
    [MaxLength(100)]
    public string Username { get; set; } = string.Empty;

    [Column("avatar_url")]
    [MaxLength(500)]
    public string? AvatarUrl { get; set; }

    [Column("xp")]
    public long Xp { get; set; } = 0;

    [Column("level")]
    public int Level { get; set; } = 0;

    [Column("total_messages")]
    public long TotalMessages { get; set; } = 0;

    [Column("voice_minutes")]
    public long VoiceMinutes { get; set; } = 0;

    [Column("last_xp_at")]
    public DateTime? LastXpAt { get; set; }

    [Column("streak_days")]
    public int StreakDays { get; set; } = 0;

    [Column("last_active_date")]
    public DateOnly? LastActiveDate { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
