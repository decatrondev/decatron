using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("xp_roles")]
public class XpRole
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Required]
    [Column("guild_id")]
    [MaxLength(30)]
    public string GuildId { get; set; } = string.Empty;

    [Column("level_required")]
    public int LevelRequired { get; set; } = 1;

    [Required]
    [Column("role_name")]
    [MaxLength(100)]
    public string RoleName { get; set; } = string.Empty;

    [Column("role_color")]
    [MaxLength(10)]
    public string RoleColor { get; set; } = "#95a5a6";

    [Column("discord_role_id")]
    [MaxLength(30)]
    public string? DiscordRoleId { get; set; }

    [Column("position")]
    public int Position { get; set; } = 0;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
