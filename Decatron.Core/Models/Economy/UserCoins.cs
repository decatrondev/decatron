using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Economy;

[Table("user_coins")]
public class UserCoins
{
    [Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("balance")]
    public long Balance { get; set; }

    [Column("total_earned")]
    public long TotalEarned { get; set; }

    [Column("total_spent")]
    public long TotalSpent { get; set; }

    [Column("total_transferred_in")]
    public long TotalTransferredIn { get; set; }

    [Column("total_transferred_out")]
    public long TotalTransferredOut { get; set; }

    [Column("first_purchase_at")]
    public DateTime? FirstPurchaseAt { get; set; }

    [Column("economy_status")]
    public string EconomyStatus { get; set; } = "normal";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
