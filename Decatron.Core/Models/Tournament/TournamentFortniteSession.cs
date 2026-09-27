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

    // "scheduled" | "check_in" | "in_progress" | "finished"
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

    // "waiting" | "revealed" | "playing" | "reporting" | "closed"
    [Column("status")]
    public string Status { get; set; } = "waiting";

    // Codigo de la partida personalizada. Solo lo ven el organizador y los
    // jugadores con check-in en la sesion (F3).
    [Column("custom_code")]
    public string? CustomCode { get; set; }

    [Column("revealed_at")]
    public DateTime? RevealedAt { get; set; }

    [Column("started_at")]
    public DateTime? StartedAt { get; set; }

    [Column("ended_at")]
    public DateTime? EndedAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Check-in de un jugador en una sesion de Fortnite (F3).</summary>
[Table("tournament_fortnite_session_checkins")]
public class TournamentFortniteSessionCheckin
{
    [Column("id")]
    public long Id { get; set; }

    [Column("session_id")]
    public long SessionId { get; set; }

    [Column("participant_id")]
    public long ParticipantId { get; set; }

    // "self" | "staff"
    [Column("checked_in_by")]
    public string CheckedInBy { get; set; } = "self";

    [Column("checked_in_at")]
    public DateTime CheckedInAt { get; set; } = DateTime.UtcNow;
}
