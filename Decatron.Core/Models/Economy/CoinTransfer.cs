using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Economy;

[Table("coin_transfers")]
public class CoinTransfer
{
    [Column("id")]
    public long Id { get; set; }

    [Column("from_user_id")]
    public long FromUserId { get; set; }

    [Column("to_user_id")]
    public long ToUserId { get; set; }

    [Column("amount")]
    public int Amount { get; set; }

    [Column("message")]
    public string? Message { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
