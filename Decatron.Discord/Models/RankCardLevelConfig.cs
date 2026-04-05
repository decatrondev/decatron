using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("rank_card_level_configs")]
public class RankCardLevelConfig
{
    [Column("id")]
    public long Id { get; set; }

    [Column("guild_id")]
    public string GuildId { get; set; } = string.Empty;

    [Column("level_min")]
    public int LevelMin { get; set; }

    [Column("level_max")]
    public int? LevelMax { get; set; }

    [Column("role_id")]
    public long? RoleId { get; set; }

    [Column("config_json", TypeName = "jsonb")]
    public string ConfigJson { get; set; } = "{}";

    [Column("background_url")]
    public string? BackgroundUrl { get; set; }

    [Column("template_id")]
    public string TemplateId { get; set; } = "default";

    [Column("enabled")]
    public bool Enabled { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
