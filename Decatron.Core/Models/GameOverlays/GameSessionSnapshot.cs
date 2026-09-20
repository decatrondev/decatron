using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.GameOverlays;

/// <summary>
/// Sesion de una cuenta de juego durante UN stream de UN canal: rango al inicio,
/// rango actual, W-L y ultimas partidas normalizadas. Se abre con stream.online y
/// se cierra con stream.offline. Es lo que leen el overlay (delta de sesion),
/// !sesion y el historico del panel. Retencion por tier.
/// </summary>
[Table("game_session_snapshots")]
public class GameSessionSnapshot
{
    [Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("linked_account_id")]
    public long LinkedAccountId { get; set; }

    [Column("game")]
    public string Game { get; set; } = "";

    [Column("stream_started_at")]
    public DateTime StreamStartedAt { get; set; }

    [Column("stream_ended_at")]
    public DateTime? StreamEndedAt { get; set; }

    // JSON RankInfo normalizado (ver plan §3).
    [Column("start_rank", TypeName = "jsonb")]
    public string? StartRankJson { get; set; }

    [Column("current_rank", TypeName = "jsonb")]
    public string? CurrentRankJson { get; set; }

    [Column("wins")]
    public int Wins { get; set; }

    [Column("losses")]
    public int Losses { get; set; }

    // JSON MatchSummary[] normalizado, ultimas N partidas.
    [Column("matches_json", TypeName = "jsonb")]
    public string MatchesJson { get; set; } = "[]";

    /// <summary>Muestras de puntos (PointsSample[]) para el grafico de LP de la sesion.</summary>
    [Column("points_history_json", TypeName = "jsonb")]
    public string PointsHistoryJson { get; set; } = "[]";

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
