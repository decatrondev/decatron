using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_blue_shell_rules")]
public class TournamentBlueShellRules
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    // jsonb crudo: [{"minRank":1,"maxRank":1,"cooldownHours":0}, ...] — se
    // (de)serializa en el service layer, no acá (mismo criterio que EmailCampaign.RecipientsFilter)
    [Column("cooldown_by_rank")]
    public string CooldownByRank { get; set; } = "[]";

    [Column("reverse_chance_by_rank")]
    public string ReverseChanceByRank { get; set; } = "[]";

    [Column("max_inventory")]
    public short MaxInventory { get; set; } = 3;

    [Column("throw_block_window_minutes")]
    public short ThrowBlockWindowMinutes { get; set; } = 15;

    [Column("disable_last_n_hours")]
    public short DisableLastNHours { get; set; } = 48;

    [Column("daily_drop_enabled")]
    public bool DailyDropEnabled { get; set; } = false;

    [Column("daily_drop_challenge_template")]
    public string? DailyDropChallengeTemplate { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class RankRange
{
    public int MinRank { get; set; }
    public int MaxRank { get; set; }
    public int? CooldownHours { get; set; }
    public decimal? ReverseChancePercent { get; set; }
}
