using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("discord_guild_configs")]
public class DiscordGuildConfig
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("guild_id")]
    public string GuildId { get; set; } = string.Empty;

    [Column("guild_name")]
    public string GuildName { get; set; } = string.Empty;

    [Column("guild_icon")]
    public string? GuildIcon { get; set; }

    [Column("channel_name")]
    public string ChannelName { get; set; } = string.Empty;

    [Column("twitch_user_id")]
    public string TwitchUserId { get; set; } = string.Empty;

    [Column("live_alert_channel_id")]
    public string? LiveAlertChannelId { get; set; }

    [Column("live_alerts_enabled")]
    public bool LiveAlertsEnabled { get; set; } = false;

    [Column("is_default")]
    public bool IsDefault { get; set; } = false;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
