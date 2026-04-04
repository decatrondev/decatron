using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Economy;

[Table("coin_pending_orders")]
public class CoinPendingOrder
{
    [Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("package_id")]
    public long? PackageId { get; set; }

    [Column("custom_coins")]
    public int? CustomCoins { get; set; }

    [Column("paypal_order_id")]
    public string? PaypalOrderId { get; set; }

    [Column("discount_code_id")]
    public long? DiscountCodeId { get; set; }

    [Column("final_price_usd")]
    public decimal FinalPriceUsd { get; set; }

    [Column("status")]
    public string Status { get; set; } = "pending";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
