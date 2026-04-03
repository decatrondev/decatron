using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("xp_configs")]
public class XpConfig
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Required]
    [Column("guild_id")]
    [MaxLength(30)]
    public string GuildId { get; set; } = string.Empty;

    [Column("enabled")]
    public bool Enabled { get; set; } = true;

    [Column("difficulty_preset")]
    [MaxLength(20)]
    public string DifficultyPreset { get; set; } = "normal";

    [Column("custom_multiplier")]
    public double CustomMultiplier { get; set; } = 1.0;

    [Column("xp_min")]
    public int XpMin { get; set; } = 15;

    [Column("xp_max")]
    public int XpMax { get; set; } = 25;

    [Column("cooldown_seconds")]
    public int CooldownSeconds { get; set; } = 60;

    [Column("max_xp_per_hour")]
    public int MaxXpPerHour { get; set; } = 500;

    [Column("min_message_length")]
    public int MinMessageLength { get; set; } = 5;

    [Column("excluded_channels", TypeName = "jsonb")]
    public string ExcludedChannels { get; set; } = "[]";

    [Column("night_mode_enabled")]
    public bool NightModeEnabled { get; set; } = false;

    [Column("night_mode_multiplier")]
    public double NightModeMultiplier { get; set; } = 1.5;

    [Column("levelup_channel_id")]
    [MaxLength(30)]
    public string? LevelupChannelId { get; set; }

    [Column("achievement_channel_id")]
    [MaxLength(30)]
    public string? AchievementChannelId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
