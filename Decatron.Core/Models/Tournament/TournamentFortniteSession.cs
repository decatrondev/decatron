using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

/// <summary>
/// Sesion de Fortnite (un dia de juego) con N partidas. GroupId null = todos los
/// equipos juegan en un solo lobby.
/// </summary>
[Table("tournament_fortnite_sessions")]
public class TournamentFortniteSession
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    [Column("group_id")]
    public long? GroupId { get; set; }

    [Column("name")]
    public string Name { get; set; } = "";

    [Column("scheduled_at")]
    public DateTime? ScheduledAt { get; set; }

    // "scheduled" | "in_progress" | "finished"
    [Column("status")]
    public string Status { get; set; } = "scheduled";

    [Column("sort_order")]
    public short SortOrder { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Una partida personalizada dentro de una sesion. El codigo y el flujo de estados
/// (codigo revelado, en juego, reporte, cerrada) llegan en F3.
/// </summary>
[Table("tournament_fortnite_games")]
public class TournamentFortniteGame
{
    [Column("id")]
    public long Id { get; set; }

    [Column("session_id")]
    public long SessionId { get; set; }

    [Column("game_number")]
    public short GameNumber { get; set; }

    [Column("status")]
    public string Status { get; set; } = "waiting";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
