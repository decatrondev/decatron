using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Economy;

[Table("coin_discount_codes")]
public class CoinDiscountCode
{
    [Column("id")]
    public long Id { get; set; }

    [Column("code")]
    public string Code { get; set; } = string.Empty;

    [Column("discount_type")]
    public string DiscountType { get; set; } = string.Empty;

    [Column("discount_value")]
    public decimal DiscountValue { get; set; }

    [Column("assigned_user_id")]
    public long? AssignedUserId { get; set; }

    [Column("max_uses")]
    public int? MaxUses { get; set; }

    [Column("current_uses")]
    public int CurrentUses { get; set; }

    [Column("max_uses_per_user")]
    public int MaxUsesPerUser { get; set; }

    [Column("min_purchase_usd")]
    public decimal MinPurchaseUsd { get; set; }

    [Column("applicable_package_id")]
    public long? ApplicablePackageId { get; set; }

    [Column("combinable_with_first_purchase")]
    public bool CombinableWithFirstPurchase { get; set; }

    [Column("starts_at")]
    public DateTime? StartsAt { get; set; }

    [Column("expires_at")]
    public DateTime? ExpiresAt { get; set; }

    [Column("enabled")]
    public bool Enabled { get; set; }

    [Column("created_by")]
    public long? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
