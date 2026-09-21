using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.GameOverlays;

/// <summary>
/// Una instancia del overlay "Partida en vivo" (/overlay/live?channel=X&slug=Y), POR
/// CANAL. Muestra lo que Decatron Desktop lee del cliente del juego (lobby, selección,
/// partida, fin, coach, predicción) en una caja fija con una pantalla por fase. Toda la
/// config visual vive en config_json (el frontend es dueño del shape).
/// Plan: .dev/plans/LIVE_MATCH_OVERLAY_PLAN.md §3
/// </summary>
[Table("live_overlay_configs")]
public class LiveOverlayConfig
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

    // JSON { "width": 1920, "height": 1080 }
    [Column("canvas", TypeName = "jsonb")]
    public string CanvasJson { get; set; } = "{\"width\":1920,\"height\":1080}";

    // JSON { layout, size, sizeMode, scale, position, background, accent, chrome, animation, screens, elements }
    [Column("config_json", TypeName = "jsonb")]
    public string ConfigJson { get; set; } = "{}";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
