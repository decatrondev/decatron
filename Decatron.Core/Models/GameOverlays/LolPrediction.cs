using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.GameOverlays;

/// <summary>
/// Predicción del chat sobre una partida de LoL del streamer: ¿gana o pierde? Se abre
/// cuando empieza la partida (lo avisa Decatron Desktop), cierra al minuto 5 y se
/// resuelve con el resultado real del cliente. Apuesta parimutuel con PUNTOS DE
/// PREDICCIÓN propios de cada canal (gratis, no son DecaCoins ni valen dinero).
/// Plan: .dev/plans/LOL_COACH_PLAN.md §2.4
/// </summary>
[Table("lol_predictions")]
public class LolPrediction
{
    [Key, Column("id")]
    public long Id { get; set; }

    /// <summary>Canal (users.id).</summary>
    [Column("user_id")]
    public long UserId { get; set; }

    /// <summary>Identifica la partida: puuid + inicio, para no abrir dos veces la misma.</summary>
    [Column("game_key"), MaxLength(120)]
    public string GameKey { get; set; } = "";

    [Column("champion"), MaxLength(40)]
    public string? Champion { get; set; }

    [Column("opened_at")]
    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;

    [Column("closes_at")]
    public DateTime ClosesAt { get; set; }

    [Column("resolved_at")]
    public DateTime? ResolvedAt { get; set; }

    /// <summary>win | loss | refund (sin resultado o un lado vacío)</summary>
    [Column("result"), MaxLength(10)]
    public string? Result { get; set; }

    [Column("pool_win")]
    public long PoolWin { get; set; }

    [Column("pool_loss")]
    public long PoolLoss { get; set; }

    public bool IsOpen => ResolvedAt == null && DateTime.UtcNow < ClosesAt;
    public bool IsPending => ResolvedAt == null;
}

[Table("lol_prediction_bets")]
public class LolPredictionBet
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("prediction_id")]
    public long PredictionId { get; set; }

    /// <summary>Login del viewer en minúsculas (no hace falta cuenta Decatron).</summary>
    [Column("viewer"), MaxLength(100)]
    public string Viewer { get; set; } = "";

    /// <summary>win | loss</summary>
    [Column("side"), MaxLength(5)]
    public string Side { get; set; } = "";

    [Column("amount")]
    public int Amount { get; set; }

    /// <summary>Lo que recibió al resolver (0 si perdió; = amount si reembolso).</summary>
    [Column("payout")]
    public long Payout { get; set; }

    [Column("placed_at")]
    public DateTime PlacedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Puntos de predicción de un viewer en un canal. Arrancan con el saldo inicial del canal.</summary>
[Table("lol_prediction_points")]
public class LolPredictionPoints
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("viewer"), MaxLength(100)]
    public string Viewer { get; set; } = "";

    [Column("points")]
    public long Points { get; set; }

    [Column("correct")]
    public int Correct { get; set; }

    [Column("total")]
    public int Total { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
