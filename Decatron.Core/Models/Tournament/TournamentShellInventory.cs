using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tournament;

[Table("tournament_shell_inventories")]
public class TournamentShellInventory
{
    [Column("id")]
    public long Id { get; set; }

    [Column("tournament_participant_id")]
    public long TournamentParticipantId { get; set; }

    [Column("count")]
    public short Count { get; set; }

    [Column("total_obtained")]
    public int TotalObtained { get; set; }

    [Column("total_thrown")]
    public int TotalThrown { get; set; }

    [Column("total_received")]
    public int TotalReceived { get; set; }

    [Column("total_stolen")]
    public int TotalStolen { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
