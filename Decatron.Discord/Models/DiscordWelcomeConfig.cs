using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("discord_welcome_configs")]
public class DiscordWelcomeConfig
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("guild_config_id")]
    public long GuildConfigId { get; set; }

    [Column("guild_id")]
    public string GuildId { get; set; } = string.Empty;

    // Welcome (join)
    [Column("welcome_enabled")]
    public bool WelcomeEnabled { get; set; } = false;

    [Column("welcome_channel_id")]
    public string? WelcomeChannelId { get; set; }

    [Column("welcome_message")]
    public string WelcomeMessage { get; set; } = "Bienvenido {user} a {server}! Eres el miembro #{memberCount}";

    [Column("welcome_embed_color")]
    public string WelcomeEmbedColor { get; set; } = "#22c55e";

    [Column("welcome_image_mode")]
    public string WelcomeImageMode { get; set; } = "avatar";

    [Column("welcome_image_url")]
    public string? WelcomeImageUrl { get; set; }

    [Column("welcome_show_avatar")]
    public bool WelcomeShowAvatar { get; set; } = true;

    [Column("welcome_auto_role_id")]
    public string? WelcomeAutoRoleId { get; set; }

    [Column("welcome_dm_enabled")]
    public bool WelcomeDmEnabled { get; set; } = false;

    [Column("welcome_dm_message")]
    public string? WelcomeDmMessage { get; set; }

    [Column("welcome_mention_user")]
    public bool WelcomeMentionUser { get; set; } = true;

    // Goodbye (leave)
    [Column("goodbye_enabled")]
    public bool GoodbyeEnabled { get; set; } = false;

    [Column("goodbye_channel_id")]
    public string? GoodbyeChannelId { get; set; }

    [Column("goodbye_message")]
    public string GoodbyeMessage { get; set; } = "{user} se fue del servidor. Eramos {memberCount}.";

    [Column("goodbye_embed_color")]
    public string GoodbyeEmbedColor { get; set; } = "#64748b";

    [Column("goodbye_image_mode")]
    public string GoodbyeImageMode { get; set; } = "none";

    [Column("goodbye_image_url")]
    public string? GoodbyeImageUrl { get; set; }

    [Column("goodbye_show_avatar")]
    public bool GoodbyeShowAvatar { get; set; } = true;

    // Editor layout (JSON with element positions)
    [Column("editor_layout")]
    public string? EditorLayout { get; set; }

    // Generated welcome/goodbye images (URL paths)
    [Column("welcome_generated_image")]
    public string? WelcomeGeneratedImage { get; set; }

    [Column("goodbye_generated_image")]
    public string? GoodbyeGeneratedImage { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
