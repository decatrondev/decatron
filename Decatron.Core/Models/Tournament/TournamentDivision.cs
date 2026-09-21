using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_divisions")]
public class TournamentDivision
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    [Column("name")]
    public string Name { get; set; } = "General";

    [Column("sort_order")]
    public short SortOrder { get; set; }

    [Column("min_lp_threshold")]
    public int? MinLpThreshold { get; set; }

    [Column("max_lp_threshold")]
    public int? MaxLpThreshold { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
