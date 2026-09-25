using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Brand;

/// <summary>
/// Una pieza de la marca subida desde /admin/brand (mascota, wordmark, lockup, favicon…).
/// El archivo vive fuera del repo en Brand:AssetsPath y se sirve en /uploads/brand.
/// Plan: .dev/plans/BRAND_LOGOS_PLAN.md
/// </summary>
[Table("brand_assets")]
public class BrandAsset
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("name"), MaxLength(120)]
    public string Name { get; set; } = "";

    [Column("file_name"), MaxLength(200)]
    public string FileName { get; set; } = "";

    [Column("url"), MaxLength(500)]
    public string Url { get; set; } = "";

    [Column("width")]
    public int Width { get; set; }

    [Column("height")]
    public int Height { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Cómo se ve la marca en un lugar concreto (header público, sidebar, favicon…).
/// El JSON lo arma y lo interpreta el front (ClientApp/src/brand); el backend solo lo guarda.
/// Sin fila = el lugar se ve como está en el código.
/// </summary>
[Table("brand_slots")]
public class BrandSlot
{
    [Key, Column("slot_key"), MaxLength(60)]
    public string SlotKey { get; set; } = "";

    [Column("config", TypeName = "jsonb")]
    public string Config { get; set; } = "{}";

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
