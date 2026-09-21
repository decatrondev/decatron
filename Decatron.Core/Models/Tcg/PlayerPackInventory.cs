using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tcg;

// Un sobre comprado y todavia sin abrir. Comprar inserta una fila, abrir la borra
// y entrega las cartas — ver Add_TCG_Pack_Inventory.sql.
[Table("player_pack_inventory")]
public class PlayerPackInventory
{
    [Column("id")]
    public long Id { get; set; }

    [Column("owner_account_id")]
    public long OwnerAccountId { get; set; }

    [Column("sobre_tier_id")]
    public int SobreTierId { get; set; }

    [Column("purchased_at")]
    public DateTime PurchasedAt { get; set; }

    [Column("price_paid")]
    public int PricePaid { get; set; }

    /// <summary>
    /// Sobre reclamado gratis, no comprado. Sus cartas nacen con origen "free_pack" y
    /// valor de catalogo 1, no tienen piso de rareza garantizado y no mueven el pity.
    /// El dato viaja en el sobre porque al abrirlo la fila se borra: si no estuviera
    /// aca, no habria forma de saber como entregar las cartas.
    /// </summary>
    [Column("is_free")]
    public bool IsFree { get; set; }
}
