using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tts;

/// <summary>
/// Voz de personaje de Fish que un streamer con rango Patrocinador (o superior) agregó a su lista propia.
/// Solo se ofrece y se sintetiza en su canal y mientras conserve el rango.
/// </summary>
[Table("tts_fish_user_voices")]
public class FishUserVoice
{
    [Column("user_id")] public long UserId { get; set; }
    [Column("reference_id")] public string ReferenceId { get; set; } = "";
    [Column("name")] public string Name { get; set; } = "";
    [Column("languages")] public string Languages { get; set; } = "";
    [Column("author")] public string? Author { get; set; }
    [Column("sample_url")] public string? SampleUrl { get; set; }
    [Column("active")] public bool Active { get; set; } = true;
    /// <summary>manual | missing | takedown | admin</summary>
    [Column("inactive_reason")] public string? InactiveReason { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    [Column("last_checked_at")] public DateTimeOffset? LastCheckedAt { get; set; }
}
