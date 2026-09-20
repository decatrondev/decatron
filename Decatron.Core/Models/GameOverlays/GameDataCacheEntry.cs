using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.GameOverlays;

/// <summary>
/// Cache compartida de respuestas de proveedores, por (provider, external_id,
/// kind). Dos canales que muestran la misma cuenta = una sola consulta. Persistida
/// para sobrevivir reinicios del backend sin re-gastar rate limit.
/// </summary>
[Table("game_data_cache")]
public class GameDataCacheEntry
{
    [Column("id")]
    public long Id { get; set; }

    [Column("provider")]
    public string Provider { get; set; } = "";

    [Column("external_id")]
    public string ExternalId { get; set; } = "";

    // "rank" | "recent_matches" | "live_game" | ...
    [Column("kind")]
    public string Kind { get; set; } = "";

    [Column("payload", TypeName = "jsonb")]
    public string Payload { get; set; } = "{}";

    [Column("fetched_at")]
    public DateTime FetchedAt { get; set; } = DateTime.UtcNow;

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }
}
