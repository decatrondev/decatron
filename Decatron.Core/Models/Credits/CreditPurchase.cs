using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Credits;

/// <summary>
/// Compra de un paquete de créditos con Culqi. Mismo esquema de facturación que
/// CoinPurchase (customer_*, charged_*, invoice_*): CoinInvoiceService emite el
/// comprobante de las dos tablas con la misma lógica.
/// </summary>
[Table("credit_purchases")]
public class CreditPurchase
{
    [Column("id")] public long Id { get; set; }
    [Column("user_id")] public long UserId { get; set; }
    [Column("package_id")] public long? PackageId { get; set; }
    [Column("credits_received")] public int CreditsReceived { get; set; }
    [Column("amount_paid_usd")] public decimal AmountPaidUsd { get; set; }
    [Column("charge_id")] public string? ChargeId { get; set; }
    [Column("charge_status")] public string? ChargeStatus { get; set; }
    [Column("charged_amount")] public decimal? ChargedAmount { get; set; }
    [Column("charged_currency")] public string? ChargedCurrency { get; set; }
    [Column("customer_name")] public string? CustomerName { get; set; }
    [Column("customer_email")] public string? CustomerEmail { get; set; }
    [Column("customer_country")] public string? CustomerCountry { get; set; }
    [Column("customer_doc_type")] public string? CustomerDocType { get; set; }
    [Column("customer_doc_number")] public string? CustomerDocNumber { get; set; }
    [Column("prefer_factura")] public bool PreferFactura { get; set; }
    [Column("is_test")] public bool IsTest { get; set; }
    [Column("invoice_status")] public string? InvoiceStatus { get; set; }
    [Column("invoice_document_id")] public int? InvoiceDocumentId { get; set; }
    [Column("invoice_type")] public string? InvoiceType { get; set; }
    [Column("invoice_series")] public string? InvoiceSeries { get; set; }
    [Column("invoice_number")] public int? InvoiceNumber { get; set; }
    [Column("invoice_error")] public string? InvoiceError { get; set; }
    [Column("invoice_attempts")] public int InvoiceAttempts { get; set; }
    [Column("invoice_last_attempt_at")] public DateTime? InvoiceLastAttemptAt { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
