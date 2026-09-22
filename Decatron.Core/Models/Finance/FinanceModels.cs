using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Finance;

/// <summary>Parámetros del P&L: comisión de la pasarela, IGV y tipo de cambio. Fila única.</summary>
[Table("finance_settings")]
public class FinanceSettings
{
    [Column("id")] public int Id { get; set; } = 1;
    /// <summary>Comisión porcentual por transacción (Culqi Perú: 3.99).</summary>
    [Column("gateway_percent")] public decimal GatewayPercent { get; set; } = 3.99m;
    /// <summary>Parte fija de la comisión, en soles.</summary>
    [Column("gateway_fixed_pen")] public decimal GatewayFixedPen { get; set; } = 0.30m;
    /// <summary>La comisión de la pasarela lleva IGV encima.</summary>
    [Column("gateway_fee_has_igv")] public bool GatewayFeeHasIgv { get; set; } = true;
    [Column("igv_percent")] public decimal IgvPercent { get; set; } = 18m;
    [Column("pen_per_usd")] public decimal PenPerUsd { get; set; } = 3.80m;
    [Column("primary_currency")] public string PrimaryCurrency { get; set; } = "PEN";
    [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Costo fijo del dueño (servidor, dominios, suscripciones). Se carga a mano.</summary>
[Table("fixed_costs")]
public class FixedCost
{
    [Column("id")] public long Id { get; set; }
    [Column("concept")] public string Concept { get; set; } = "";
    [Column("amount")] public decimal Amount { get; set; }
    [Column("currency")] public string Currency { get; set; } = "USD";
    /// <summary>monthly | yearly | one_time</summary>
    [Column("periodicity")] public string Periodicity { get; set; } = "monthly";
    [Column("starts_on")] public DateOnly StartsOn { get; set; }
    [Column("ends_on")] public DateOnly? EndsOn { get; set; }
    [Column("notes")] public string? Notes { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
