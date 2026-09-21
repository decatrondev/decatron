using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_shell_triggers")]
public class TournamentShellTrigger
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    [Column("name")]
    public string Name { get; set; } = "";

    // "stat_threshold" | "streak_wins" | "perfect_kda" | "match_duration_min" | "champion_variety" | "win_with_active_punishment"
    [Column("condition_type")]
    public string ConditionType { get; set; } = "stat_threshold";

    // solo aplica a "stat_threshold": "kills" | "assists" | "deaths"
    [Column("stat_field")]
    public string? StatField { get; set; }

    [Column("threshold_value")]
    public decimal ThresholdValue { get; set; }

    [Column("shells_granted")]
    public short ShellsGranted { get; set; } = 1;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
