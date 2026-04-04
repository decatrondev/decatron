using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Economy;

[Table("coin_transactions")]
public class CoinTransaction
{
    [Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("amount")]
    public int Amount { get; set; }

    [Column("balance_after")]
    public long BalanceAfter { get; set; }

    [Column("type")]
    public string Type { get; set; } = string.Empty;

    [Column("description")]
    public string? Description { get; set; }

    [Column("related_user_id")]
    public long? RelatedUserId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
