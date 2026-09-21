using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_shell_events")]
public class TournamentShellEvent
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_edition_id")]
    public long TournamentEditionId { get; set; }

    // "obtained" | "thrown" | "received" | "fulfilled" | "stolen"
    [Column("type")]
    public string Type { get; set; } = "obtained";

    [Column("source_participant_id")]
    public long SourceParticipantId { get; set; }

    [Column("target_participant_id")]
    public long? TargetParticipantId { get; set; }

    [Column("trigger_id")]
    public long? TriggerId { get; set; }

    [Column("punishment_type_id")]
    public long? PunishmentTypeId { get; set; }

    [Column("was_reverse")]
    public bool WasReverse { get; set; }

    [Column("was_lost_full")]
    public bool WasLostFull { get; set; }

    [Column("fulfilled_at")]
    public DateTime? FulfilledAt { get; set; }

    [Column("fulfilled_by_staff_id")]
    public long? FulfilledByStaffId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
