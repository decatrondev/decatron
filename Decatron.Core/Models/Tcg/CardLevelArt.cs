using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tcg;

// Arte compartido entre TODOS los jugadores que lleguen a ese card_id + level — no es
// una imagen por jugador. Generado bajo demanda por el lado de generacion.
[Table("card_level_art")]
public class CardLevelArt
{
    [Column("id")]
    public long Id { get; set; }

    [Column("card_id")]
    public Guid CardId { get; set; }

    [Column("level")]
    public short Level { get; set; }

    [Column("image_path")]
    public string? ImagePath { get; set; }

    [Column("status")]
    public string Status { get; set; } = "pending"; // "pending" | "generating" | "done"

    [Column("requested_at")]
    public DateTime RequestedAt { get; set; }

    [Column("completed_at")]
    public DateTime? CompletedAt { get; set; }
}
