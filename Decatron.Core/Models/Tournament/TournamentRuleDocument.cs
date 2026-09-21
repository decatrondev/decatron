using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_rule_documents")]
public class TournamentRuleDocument
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    // "general" | "punishments"
    [Column("type")]
    public string Type { get; set; } = "general";

    [Column("content_markdown")]
    public string ContentMarkdown { get; set; } = "";

    [Column("version")]
    public int Version { get; set; } = 1;

    [Column("updated_by_user_id")]
    public long? UpdatedByUserId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
