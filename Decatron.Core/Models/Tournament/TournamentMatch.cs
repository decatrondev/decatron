using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_matches")]
public class TournamentMatch
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    [Column("round_number")]
    public short RoundNumber { get; set; }

    [Column("bracket_position")]
    public short BracketPosition { get; set; }

    [Column("team_a_id")]
    public long? TeamAId { get; set; }

    [Column("team_b_id")]
    public long? TeamBId { get; set; }

    [Column("winner_team_id")]
    public long? WinnerTeamId { get; set; }

    // "scheduled" | "in_progress" | "finished" | "walkover"
    [Column("status")]
    public string Status { get; set; } = "scheduled";

    // "winners" | "losers" | "grand_final" | null — solo se usa en double_elimination,
    // null para single_elimination/round_robin/swiss (que no tienen dos arboles).
    [Column("bracket_side")]
    public string? BracketSide { get; set; }

    [Column("scheduled_at")]
    public DateTime? ScheduledAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
