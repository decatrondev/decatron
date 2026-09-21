using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tcg;

[Table("upgrade_attempt_log")]
public class UpgradeAttemptLog
{
    [Column("id")]
    public long Id { get; set; }

    [Column("instance_id")]
    public long InstanceId { get; set; }

    [Column("owner_account_id")]
    public long OwnerAccountId { get; set; }

    [Column("card_id")]
    public Guid CardId { get; set; }

    [Column("from_level")]
    public short FromLevel { get; set; }

    [Column("to_level")]
    public short ToLevel { get; set; }

    [Column("result")]
    public string Result { get; set; } = string.Empty; // "fail" | "success_paid" | "success_expired_unpaid"

    [Column("success_probability_used")]
    public decimal SuccessProbabilityUsed { get; set; }

    [Column("cost_charged")]
    public int? CostCharged { get; set; }

    [Column("rolled_at")]
    public DateTime RolledAt { get; set; }

    [Column("resolved_at")]
    public DateTime? ResolvedAt { get; set; }
}
