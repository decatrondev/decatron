using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_games")]
public class TournamentGame
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_match_id")]
    public long TournamentMatchId { get; set; }

    [Column("game_number")]
    public short GameNumber { get; set; }

    [Column("winner_team_id")]
    public long? WinnerTeamId { get; set; }

    // Enriquecimiento opcional si se pudo trackear via Riot — no es la fuente de
    // verdad, el resultado se carga manual (fase 2 seccion 6).
    [Column("riot_match_id")]
    public string? RiotMatchId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
