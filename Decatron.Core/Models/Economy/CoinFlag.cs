using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Economy;

[Table("coin_flags")]
public class CoinFlag
{
    [Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("flag_type")]
    public string FlagType { get; set; } = string.Empty;

    [Column("flag_reason")]
    public string FlagReason { get; set; } = string.Empty;

    [Column("flag_details", TypeName = "jsonb")]
    public string? FlagDetails { get; set; }

    [Column("status")]
    public string Status { get; set; } = "pending";

    [Column("resolved_by")]
    public long? ResolvedBy { get; set; }

    [Column("resolved_at")]
    public DateTime? ResolvedAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
