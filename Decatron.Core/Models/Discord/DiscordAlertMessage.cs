using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("discord_alert_messages")]
public class DiscordAlertMessage
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("alert_id")]
    public long AlertId { get; set; }

    [Column("guild_id")]
    public string GuildId { get; set; } = string.Empty;

    [Column("channel_id")]
    public string ChannelId { get; set; } = string.Empty;

    [Column("message_id")]
    public string MessageId { get; set; } = string.Empty;

    [Column("channel_name")]
    public string ChannelName { get; set; } = string.Empty;

    [Column("broadcaster_user_id")]
    public string BroadcasterUserId { get; set; } = string.Empty;

    [Column("peak_viewers")]
    public int PeakViewers { get; set; }

    [Column("total_viewer_samples")]
    public int TotalViewerSamples { get; set; }

    [Column("total_viewers_sum")]
    public long TotalViewersSum { get; set; }

    [Column("last_game")]
    public string? LastGame { get; set; }

    [Column("stream_started_at")]
    public DateTime? StreamStartedAt { get; set; }

    [Column("sent_at")]
    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    [Column("last_updated_at")]
    public DateTime? LastUpdatedAt { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;
}
