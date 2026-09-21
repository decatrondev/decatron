using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tcg;

[Table("player_card_instances")]
public class PlayerCardInstance
{
    [Column("id")]
    public long Id { get; set; }

    [Column("card_id")]
    public Guid CardId { get; set; }

    [Column("owner_account_id")]
    public long OwnerAccountId { get; set; }

    [Column("level")]
    public short Level { get; set; }

    [Column("origin")]
    public string Origin { get; set; } = "pulled"; // "claimed" | "pulled"

    [Column("catalog_value")]
    public int CatalogValue { get; set; }

    [Column("status")]
    public string Status { get; set; } = "active"; // "active" | "grading_in_progress" | "frozen_pending_payment" | "destroyed"

    // Una carta tiene UN SOLO intento de upgrade en toda su vida — una vez usado,
    // nunca mas se le puede volver a intentar, gane o pierda esa unica tirada.
    [Column("upgrade_used")]
    public bool UpgradeUsed { get; set; }

    // Cuando empezo a "gradearse" — el resultado no sale al toque, hay 24h de espera
    // antes de saber si salio nivel 1-10 o se destruyo.
    [Column("attempt_started_at")]
    public DateTime? AttemptStartedAt { get; set; }

    [Column("pending_target_level")]
    public short? PendingTargetLevel { get; set; }

    [Column("payment_amount_due")]
    public int? PaymentAmountDue { get; set; }

    [Column("payment_deadline_at")]
    public DateTime? PaymentDeadlineAt { get; set; }

    [Column("source_pull_id")]
    public long? SourcePullId { get; set; }

    [Column("acquired_at")]
    public DateTime AcquiredAt { get; set; }

    [Column("destroyed_at")]
    public DateTime? DestroyedAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
