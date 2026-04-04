using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Economy;

[Table("coin_purchases")]
public class CoinPurchase
{
    [Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("package_id")]
    public long? PackageId { get; set; }

    [Column("custom_coins")]
    public int? CustomCoins { get; set; }

    [Column("coins_received")]
    public int CoinsReceived { get; set; }

    [Column("amount_paid_usd")]
    public decimal AmountPaidUsd { get; set; }

    [Column("paypal_order_id")]
    public string? PaypalOrderId { get; set; }

    [Column("paypal_status")]
    public string? PaypalStatus { get; set; }

    [Column("discount_code_id")]
    public long? DiscountCodeId { get; set; }

    [Column("discount_amount")]
    public decimal DiscountAmount { get; set; }

    [Column("bonus_coins_from_coupon")]
    public int BonusCoinsFromCoupon { get; set; }

    [Column("bonus_coupon_scheduled_at")]
    public DateTime? BonusCouponScheduledAt { get; set; }

    [Column("bonus_coupon_credited_at")]
    public DateTime? BonusCouponCreditedAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
