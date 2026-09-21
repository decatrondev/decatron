using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_prize_tiers")]
public class TournamentPrizeTier
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    [Column("tournament_division_id")]
    public long? TournamentDivisionId { get; set; }

    [Column("name")]
    public string Name { get; set; } = "";

    // Descripcion libre del premio en si — no todo premio es plata (merch, skins,
    // suscripciones, trofeo fisico, etc.). "Amount" queda opcional para cuando SI
    // hay un valor en dinero (o parte del premio es plata + algo mas). Agregado
    // 24-08-2026, pedido del usuario: "la tab de premios debe ser mas flexible no
    // solo dinero".
    [Column("description")]
    public string? Description { get; set; }

    [Column("amount")]
    public decimal? Amount { get; set; }

    [Column("amount_hidden")]
    public bool AmountHidden { get; set; }

    // "by_rank" | "by_role" | "by_metric"
    [Column("scope")]
    public string Scope { get; set; } = "by_rank";

    [Column("rank")]
    public short? Rank { get; set; }

    [Column("role")]
    public string? Role { get; set; }

    // "most_kills" | "most_assists" | "most_wins" | "best_kda" | "longest_win_streak"
    [Column("metric_key")]
    public string? MetricKey { get; set; }

    [Column("sort_order")]
    public short SortOrder { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
