using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("supporter_payments")]
    public class SupporterPayment
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("user_id")]
        public long? UserId { get; set; }

        [Column("twitch_login")]
        [MaxLength(100)]
        public string? TwitchLogin { get; set; }

        [Column("amount")]
        public decimal Amount { get; set; }

        [Column("currency")]
        [MaxLength(10)]
        public string Currency { get; set; } = "USD";

        [Column("paypal_order_id")]
        [MaxLength(255)]
        public string? PaypalOrderId { get; set; }

        [Column("tier")]
        [MaxLength(50)]
        public string? Tier { get; set; }

        [Column("billing_type")]
        [MaxLength(20)]
        public string? BillingType { get; set; }

        [Column("discount_code_id")]
        public int? DiscountCodeId { get; set; }

        [Column("payment_type")]
        [MaxLength(20)]
        public string PaymentType { get; set; } = "tier";

        [Column("captured_at")]
        public DateTime CapturedAt { get; set; } = DateTime.UtcNow;
    }
}
