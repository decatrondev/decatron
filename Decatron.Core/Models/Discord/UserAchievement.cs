using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("user_achievements")]
public class UserAchievement
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

    [Column("achievement_id")]
    public long AchievementId { get; set; }

    [Column("unlocked_at")]
    public DateTime UnlockedAt { get; set; } = DateTime.UtcNow;
}
