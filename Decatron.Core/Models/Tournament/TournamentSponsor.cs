using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_sponsors")]
public class TournamentSponsor
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    [Column("name")]
    public string Name { get; set; } = "";

    [Column("logo_url")]
    public string? LogoUrl { get; set; }

    [Column("cta_text")]
    public string? CtaText { get; set; }

    [Column("cta_url")]
    public string? CtaUrl { get; set; }

    [Column("amount_sponsored")]
    public decimal? AmountSponsored { get; set; }

    // jsonb crudo: ["home-banner", "prizes", "footer"]
    [Column("slots")]
    public string Slots { get; set; } = "[]";

    // "active" | "archived"
    [Column("status")]
    public string Status { get; set; } = "active";

    [Column("sort_order")]
    public short SortOrder { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
