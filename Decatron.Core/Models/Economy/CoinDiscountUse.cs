using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Economy;

[Table("coin_discount_uses")]
public class CoinDiscountUse
{
    [Column("id")]
    public long Id { get; set; }

    [Column("code_id")]
    public long CodeId { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("purchase_id")]
    public long? PurchaseId { get; set; }

    [Column("discount_applied")]
    public decimal DiscountApplied { get; set; }

    [Column("used_at")]
    public DateTime UsedAt { get; set; }
}
