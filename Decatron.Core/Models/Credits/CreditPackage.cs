using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Credits;

/// <summary>Paquete de créditos a la venta. Se edita desde el admin, no en código.</summary>
[Table("credit_packages")]
public class CreditPackage
{
    [Column("id")] public long Id { get; set; }
    [Column("name")] public string Name { get; set; } = "";
    [Column("description")] public string? Description { get; set; }
    [Column("credits")] public long Credits { get; set; }
    [Column("bonus_credits")] public long BonusCredits { get; set; }
    [Column("price_usd")] public decimal PriceUsd { get; set; }
    [Column("sort_order")] public int SortOrder { get; set; }
    [Column("enabled")] public bool Enabled { get; set; } = true;
    [Column("highlight")] public bool Highlight { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
