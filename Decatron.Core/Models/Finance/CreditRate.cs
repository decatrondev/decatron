using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Finance;

/// <summary>
/// Lo que cuesta cada motor en créditos, y lo que cuesta de verdad en dólares. La
/// diferencia es el margen. Editable desde el admin: ningún precio vive en el código.
/// </summary>
[Table("credit_rates")]
public class CreditRate
{
    [Key]
    [Column("engine")] public string Engine { get; set; } = "";
    [Column("label")] public string Label { get; set; } = "";
    /// <summary>char | second | usd</summary>
    [Column("unit")] public string Unit { get; set; } = "char";
    [Column("credits_per_unit")] public decimal CreditsPerUnit { get; set; }
    /// <summary>Precio de lista del proveedor por esa unidad, para calcular el margen.</summary>
    [Column("provider_usd_per_unit")] public decimal ProviderUsdPerUnit { get; set; }
    [Column("enabled")] public bool Enabled { get; set; } = true;
    [Column("notes")] public string? Notes { get; set; }
    [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
