using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("xp_store_items")]
public class XpStoreItem
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Required]
    [Column("guild_id")]
    [MaxLength(30)]
    public string GuildId { get; set; } = string.Empty;

    [Required]
    [Column("name")]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column("description")]
    [MaxLength(300)]
    public string Description { get; set; } = string.Empty;

    [Column("icon")]
    [MaxLength(10)]
    public string Icon { get; set; } = "🎁";

    [Column("cost")]
    public int Cost { get; set; } = 100;

    [Column("item_type")]
    [MaxLength(30)]
    public string ItemType { get; set; } = "custom";

    [Column("duration_hours")]
    public double? DurationHours { get; set; }

    [Column("max_stock")]
    public int MaxStock { get; set; } = 0;

    [Column("current_stock")]
    public int CurrentStock { get; set; } = 0;

    [Column("role_id")]
    [MaxLength(30)]
    public string? RoleId { get; set; }

    [Column("channel_id")]
    [MaxLength(30)]
    public string? ChannelId { get; set; }

    [Column("announcement_channel_id")]
    [MaxLength(30)]
    public string? AnnouncementChannelId { get; set; }

    /// <summary>
    /// Custom message for shoutout. Variables: {user}, {mention}
    /// </summary>
    [Column("custom_message")]
    [MaxLength(500)]
    public string? CustomMessage { get; set; }

    [Column("enabled")]
    public bool Enabled { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
