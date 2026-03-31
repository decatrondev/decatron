using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("discord_live_alerts")]
public class DiscordLiveAlert
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("guild_config_id")]
    public long GuildConfigId { get; set; }

    [Column("guild_id")]
    public string GuildId { get; set; } = string.Empty;

    [Column("channel_name")]
    public string ChannelName { get; set; } = string.Empty;

    [Column("discord_channel_id")]
    public string DiscordChannelId { get; set; } = string.Empty;

    [Column("discord_channel_name")]
    public string DiscordChannelName { get; set; } = string.Empty;

    [Column("custom_message")]
    public string? CustomMessage { get; set; }

    [Column("mention_everyone")]
    public bool MentionEveryone { get; set; } = true;

    [Column("enabled")]
    public bool Enabled { get; set; } = true;

    [Column("is_own_channel")]
    public bool IsOwnChannel { get; set; } = false;

    /// <summary>
    /// Thumbnail mode: "live" (stream preview), "static" (custom URL), "none" (no image)
    /// </summary>
    [Column("thumbnail_mode")]
    public string ThumbnailMode { get; set; } = "live";

    [Column("static_thumbnail_url")]
    public string? StaticThumbnailUrl { get; set; }

    [Column("embed_color")]
    public string EmbedColor { get; set; } = "#ff0000";

    [Column("footer_text")]
    public string? FooterText { get; set; }

    [Column("show_button")]
    public bool ShowButton { get; set; } = true;

    [Column("show_start_time")]
    public bool ShowStartTime { get; set; } = true;

    /// <summary>
    /// Send mode: "instant" (immediate with avatar), "wait" (delay then send with thumbnail), "instant_update" (immediate + update after delay)
    /// </summary>
    [Column("send_mode")]
    public string SendMode { get; set; } = "wait";

    /// <summary>
    /// Minutes to wait before sending (for "wait" mode) or before updating (for "instant_update" mode)
    /// </summary>
    [Column("delay_minutes")]
    public int DelayMinutes { get; set; } = 2;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
