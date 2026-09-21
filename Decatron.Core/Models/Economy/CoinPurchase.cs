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

    // ── Comprobante electrónico (ver Add_Coin_Purchase_Invoicing.sql) ──────────
    // Datos del comprador congelados al momento de la compra: un comprobante ya
    // emitido no puede cambiar porque después el cliente edite su perfil.

    [Column("customer_name")]
    public string? CustomerName { get; set; }

    [Column("customer_email")]
    public string? CustomerEmail { get; set; }

    [Column("customer_country")]
    public string? CustomerCountry { get; set; }

    [Column("customer_doc_type")]
    public string? CustomerDocType { get; set; }

    [Column("customer_doc_number")]
    public string? CustomerDocNumber { get; set; }

    [Column("prefer_factura")]
    public bool PreferFactura { get; set; }

    /// <summary>Lo realmente cobrado por Culqi (soles), no el precio de lista en dólares.</summary>
    [Column("charged_amount")]
    public decimal? ChargedAmount { get; set; }

    [Column("charged_currency")]
    public string? ChargedCurrency { get; set; }

    /// <summary>
    /// Compra hecha con llaves de test de Culqi: se acreditaron los coins pero no entró
    /// plata. No lleva comprobante y hay que excluirla de cualquier métrica de ingresos.
    /// </summary>
    [Column("is_test")]
    public bool IsTest { get; set; }

    /// <summary>NULL = no corresponde emitir. 'PENDING' es lo que busca el job.</summary>
    [Column("invoice_status")]
    public string? InvoiceStatus { get; set; }

    [Column("invoice_document_id")]
    public int? InvoiceDocumentId { get; set; }

    [Column("invoice_type")]
    public string? InvoiceType { get; set; }

    [Column("invoice_series")]
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
