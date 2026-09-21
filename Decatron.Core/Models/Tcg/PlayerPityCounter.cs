using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tcg;

[Table("player_pity_counter")]
public class PlayerPityCounter
{
    [Key]
    [Column("owner_account_id")]
    public long OwnerAccountId { get; set; }

    [Column("cards_since_last_sr_plus")]
    public int CardsSinceLastSrPlus { get; set; }

    [Column("last_reset_at")]
    public DateTime? LastResetAt { get; set; }
}
