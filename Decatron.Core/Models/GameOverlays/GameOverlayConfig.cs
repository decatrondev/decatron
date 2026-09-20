using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.GameOverlays;

/// <summary>
/// Una instancia del overlay de juegos, POR CANAL (user_id = fila de Twitch o de
/// Kick, cada una con la suya — config por canal, no compartida, ver
/// UNIFICACION_MULTIPLATAFORMA_PLAN.md §2). URL: /overlay/games?channel=X&slug=Y.
/// La config visual y de cuentas por juego vive en games_json (ver plan §2).
/// </summary>
[Table("game_overlay_configs")]
public class GameOverlayConfig
{
    [Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("slug")]
    public string Slug { get; set; } = "main";

    [Column("name")]
    public string Name { get; set; } = "Principal";

    [Column("is_enabled")]
    public bool IsEnabled { get; set; } = true;

    // "auto" = por categoria del stream, "manual" = forced_game fijo.
    [Column("detection_mode")]
    public string DetectionMode { get; set; } = "auto";

    // Juego fijo (detection_mode=manual) u override temporal via !juego.
    [Column("forced_game")]
    public string? ForcedGame { get; set; }

    // Que hacer sin categoria mapeada: "hide" | "multi_card".
    [Column("idle_behavior")]
    public string IdleBehavior { get; set; } = "hide";

    // JSON { "width": 1920, "height": 1080 }
    [Column("canvas", TypeName = "jsonb")]
    public string CanvasJson { get; set; } = "{\"width\":1920,\"height\":1080}";

    // JSON { "<game>": { enabled, accounts[], rotation, sessionScope, layout, elements, background, accent, animation } }
    [Column("games_json", TypeName = "jsonb")]
    public string GamesJson { get; set; } = "{}";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
