using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_lp_snapshots")]
public class TournamentLpSnapshot
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_participant_id")]
    public long TournamentParticipantId { get; set; }

    [Column("riot_match_id")]
    public string RiotMatchId { get; set; } = "";

    [Column("occurred_at")]
    public DateTime OccurredAt { get; set; }

    [Column("lp_before")]
    public int? LpBefore { get; set; }

    [Column("lp_after")]
    public int? LpAfter { get; set; }

    // "win" | "loss"
    [Column("result")]
    public string Result { get; set; } = "win";

    [Column("champion")]
    public string? Champion { get; set; }

    [Column("kills")]
    public short Kills { get; set; }

    [Column("deaths")]
    public short Deaths { get; set; }

    [Column("assists")]
    public short Assists { get; set; }

    [Column("cs_per_min")]
    public decimal? CsPerMin { get; set; }

    [Column("damage_dealt")]
    public int? DamageDealt { get; set; }

    [Column("vision_score")]
    public short? VisionScore { get; set; }

    [Column("duration_seconds")]
    public int DurationSeconds { get; set; }

    [Column("penta_kills")]
    public short PentaKills { get; set; }

    // Lo calcula el motor de Aegis al insertar el snapshot — no implementado en Milestone 0
    // (ver .dev/torneos/04-motor-blue-shell-aegis.md #4). Queda en false hasta esa fase.
    [Column("aegis_triggered")]
    public bool AegisTriggered { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Marca cuando el motor Blue Shell/Aegis ya evaluo este snapshot — evita
    // re-evaluar (y re-otorgar shells) en cada resync. Null = pendiente.
    [Column("blue_shell_evaluated_at")]
    public DateTime? BlueShellEvaluatedAt { get; set; }
}
