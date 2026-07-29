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

        // ── Cobro real ────────────────────────────────────────────────────────────
        // `Amount` es el precio de lista en USD, que es lo que miran los reportes.
        // Culqi cobra en PEN convirtiendo con un tipo de cambio fijo, así que no es
        // lo que pasó por la tarjeta — y el comprobante va por lo que pasó.

        [Column("charged_amount")]
        public decimal? ChargedAmount { get; set; }

        [Column("charged_currency")]
        [MaxLength(3)]
        public string? ChargedCurrency { get; set; }

        /// <summary>"culqi" o "paypal".</summary>
        [Column("provider")]
        [MaxLength(20)]
        public string? Provider { get; set; }

        // ── Comprador ─────────────────────────────────────────────────────────────

        [Column("customer_email")]
        [MaxLength(255)]
        public string? CustomerEmail { get; set; }

        [Column("customer_name")]
        [MaxLength(200)]
        public string? CustomerName { get; set; }

        /// <summary>ISO-3166 alpha-2. NULL o "PE" = domiciliado.</summary>
        [Column("customer_country")]
        [MaxLength(2)]
        public string? CustomerCountry { get; set; }

        /// <summary>Nombre del catálogo 06 como lo espera DecatronAPI: DNI, RUC, CE…</summary>
        [Column("customer_doc_type")]
        [MaxLength(30)]
        public string? CustomerDocType { get; set; }

        [Column("customer_doc_number")]
        [MaxLength(20)]
        public string? CustomerDocNumber { get; set; }

        // ── Comprobante ───────────────────────────────────────────────────────────
        // NULL en `InvoiceStatus` significa que no corresponde emitir: las donaciones
        // son liberalidades, no venta de servicio.

        /// <summary>PENDING | ACCEPTED | REJECTED | ERROR</summary>
        [Column("invoice_status")]
        [MaxLength(20)]
        public string? InvoiceStatus { get; set; }

        /// <summary>Id del SunatDocument del lado de DecatronAPI.</summary>
        [Column("invoice_document_id")]
        public int? InvoiceDocumentId { get; set; }

        [Column("invoice_type")]
        [MaxLength(20)]
        public string? InvoiceType { get; set; }

        [Column("invoice_series")]
        [MaxLength(10)]
        public string? InvoiceSeries { get; set; }

        [Column("invoice_number")]
        public int? InvoiceNumber { get; set; }

        [Column("invoice_error")]
        public string? InvoiceError { get; set; }

        [Column("invoice_attempts")]
        public int InvoiceAttempts { get; set; }

        [Column("invoice_last_attempt_at")]
        public DateTime? InvoiceLastAttemptAt { get; set; }
    }
}
