using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.GameOverlays;

/// <summary>
/// Catalogo global (editable desde admin) que traduce la categoria de la
/// plataforma (Twitch game_id / Kick category id) al juego interno del modulo.
/// </summary>
[Table("game_category_mappings")]
public class GameCategoryMapping
{
    [Column("id")]
    public long Id { get; set; }

    // "twitch" | "kick"
    [Column("platform")]
    public string Platform { get; set; } = "";

    [Column("category_id")]
    public string CategoryId { get; set; } = "";

    [Column("category_name")]
    public string CategoryName { get; set; } = "";

    [Column("game")]
    public string Game { get; set; } = "";
}
