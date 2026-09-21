using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tcg;

// Ultima vez que una cuenta reclamo el sobre gratis de cada tier — ver
// Add_TCG_Free_Packs.sql. Una fila por (cuenta, tier), se pisa en cada reclamo.
//
// Existe como tabla propia porque el sobre se consume al abrirlo: a diferencia del
// claim de carta diaria, donde el cooldown se deduce de la carta que quedo en la
// coleccion, aca no queda nada de donde inferir la fecha.
[Table("tcg_free_pack_claims")]
public class TcgFreePackClaim
{
    [Column("owner_account_id")]
    public long OwnerAccountId { get; set; }

    [Column("sobre_tier_id")]
    public int SobreTierId { get; set; }

    [Column("claimed_at")]
    public DateTime ClaimedAt { get; set; }
}
