using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Economy;

[Table("coin_packages")]
public class CoinPackage
{
    [Column("id")]
    public long Id { get; set; }

    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("description")]
    public string? Description { get; set; }

    [Column("coins")]
    public int Coins { get; set; }

    [Column("bonus_coins")]
    public int BonusCoins { get; set; }

    [Column("price_usd")]
    public decimal PriceUsd { get; set; }

    [Column("icon")]
    public string? Icon { get; set; }

    [Column("is_offer")]
    public bool IsOffer { get; set; }

    [Column("offer_starts_at")]
    public DateTime? OfferStartsAt { get; set; }

    [Column("offer_expires_at")]
    public DateTime? OfferExpiresAt { get; set; }

    [Column("first_purchase_only")]
    public bool FirstPurchaseOnly { get; set; }

    [Column("max_per_transaction")]
    public int MaxPerTransaction { get; set; }

    [Column("sort_order")]
    public int SortOrder { get; set; }

    [Column("enabled")]
    public bool Enabled { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
