using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

// Fortnite F4 (.dev/torneos/15-fortnite.md): reportes de los jugadores con captura,
// resultado oficial por equipo y el historial de lo que hizo el organizador.

/// <summary>Archivo privado (captura o justificante). Solo se sirve por la API.</summary>
[Table("tournament_fortnite_files")]
public class TournamentFortniteFile
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    [Column("file_name")]
    public string FileName { get; set; } = "";

    [Column("content_type")]
    public string ContentType { get; set; } = "";

    // "screenshot" | "evidence"
    [Column("kind")]
    public string Kind { get; set; } = "screenshot";

    [Column("uploaded_by_user_id")]
    public long UploadedByUserId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Lo que reporta cada jugador: puesto del equipo y SUS eliminaciones.</summary>
[Table("tournament_fortnite_reports")]
public class TournamentFortniteReport
{
    [Column("id")]
    public long Id { get; set; }

    [Column("game_id")]
    public long GameId { get; set; }

    [Column("participant_id")]
    public long ParticipantId { get; set; }

    [Column("team_id")]
    public long? TeamId { get; set; }

    [Column("placement")]
    public short Placement { get; set; }

    [Column("eliminations")]
    public short Eliminations { get; set; }

    [Column("screenshot_file_id")]
    public long? ScreenshotFileId { get; set; }

    [Column("submitted_at")]
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Resultado oficial de un equipo en una partida: lo que suma puntos.</summary>
[Table("tournament_fortnite_results")]
public class TournamentFortniteResult
{
    [Column("id")]
    public long Id { get; set; }

    [Column("game_id")]
    public long GameId { get; set; }

    [Column("team_id")]
    public long TeamId { get; set; }

    [Column("placement")]
    public short? Placement { get; set; }

    [Column("eliminations")]
    public short Eliminations { get; set; }

    // "approved" | "rejected" | "no_report"
    [Column("status")]
    public string Status { get; set; } = "approved";

    // "players" | "staff" | "auto"
    [Column("source")]
    public string Source { get; set; } = "players";

    [Column("reviewed_by_user_id")]
    public long? ReviewedByUserId { get; set; }

    [Column("reviewed_at")]
    public DateTime ReviewedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Historial visible para los participantes de cada accion del organizador.</summary>
[Table("tournament_fortnite_result_audit")]
public class TournamentFortniteResultAudit
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    [Column("game_id")]
    public long GameId { get; set; }

    [Column("team_id")]
    public long TeamId { get; set; }

    // "approve" | "staff_load" | "correct" | "reject" | "no_report"
    [Column("action")]
    public string Action { get; set; } = "";

    [Column("actor_user_id")]
    public long? ActorUserId { get; set; }

    [Column("actor_name")]
    public string ActorName { get; set; } = "";

    [Column("before_json")]
    public string? BeforeJson { get; set; }

    [Column("after_json")]
    public string? AfterJson { get; set; }

    [Column("reason")]
    public string? Reason { get; set; }

    [Column("evidence_file_ids")]
    public long[] EvidenceFileIds { get; set; } = System.Array.Empty<long>();

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
