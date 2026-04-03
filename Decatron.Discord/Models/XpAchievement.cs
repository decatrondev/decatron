using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("xp_achievements")]
public class XpAchievement
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("guild_id")]
    [MaxLength(30)]
    public string? GuildId { get; set; }

    [Required]
    [Column("achievement_key")]
    [MaxLength(50)]
    public string AchievementKey { get; set; } = string.Empty;

    [Required]
    [Column("name")]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column("description")]
    [MaxLength(300)]
    public string Description { get; set; } = string.Empty;

    [Column("icon")]
    [MaxLength(10)]
    public string Icon { get; set; } = "🏆";

    [Column("condition_type")]
    [MaxLength(30)]
    public string ConditionType { get; set; } = "messages";

    [Column("condition_value")]
    public int ConditionValue { get; set; } = 1;

    [Column("is_system")]
    public bool IsSystem { get; set; } = false;

    [Column("enabled")]
    public bool Enabled { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
