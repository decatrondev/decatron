using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tcg;

[Table("card_sobre_tiers")]
public class CardSobreTier
{
    [Column("id")]
    public int Id { get; set; }

    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("card_count")]
    public short CardCount { get; set; }

    [Column("price_coins")]
    public int PriceCoins { get; set; }

    [Column("guaranteed_floor_rarity")]
    public string GuaranteedFloorRarity { get; set; } = "N";

    [Column("active")]
    public bool Active { get; set; }

    /// <summary>
    /// Cada cuantas horas se puede reclamar gratis este sobre. NULL = no tiene version
    /// gratis. Vive en la tabla y no en el codigo para poder apagarlo o retunearlo sin
    /// recompilar.
    /// </summary>
    [Column("free_cooldown_hours")]
    public int? FreeCooldownHours { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
