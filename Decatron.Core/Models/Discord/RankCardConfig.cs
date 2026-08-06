using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("rank_card_configs")]
public class RankCardConfig
{
    [Column("id")]
    public long Id { get; set; }

    [Column("guild_id")]
    public string GuildId { get; set; } = string.Empty;

    [Column("config_json", TypeName = "jsonb")]
    public string ConfigJson { get; set; } = "{}";

    [Column("background_url")]
    public string? BackgroundUrl { get; set; }

    [Column("template_id")]
    public string TemplateId { get; set; } = "default";

    [Column("width")]
    public int Width { get; set; } = 1400;

    [Column("height")]
    public int Height { get; set; } = 400;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
