using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models;

[Table("tournament_call_page")]
public class TournamentCallPage
{
    [Column("donations_open")] public bool DonationsOpen { get; set; }
    [Key, Column("id")] public int Id { get; set; } = 1;
    [Column("draft", TypeName = "jsonb")] public string Draft { get; set; } = "{}";
    [Column("published", TypeName = "jsonb")] public string? Published { get; set; }
    [Column("applications_open")] public bool ApplicationsOpen { get; set; }
    [Column("revision"), ConcurrencyCheck] public long Revision { get; set; }
    [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
