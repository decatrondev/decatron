using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tts;

/// <summary>
/// Voz de personaje de Fish Audio aprobada por el admin. Solo las activas se ofrecen en los
/// selectores y se aceptan al sintetizar. La licencia la anota el admin: la de cada voz es la de
/// su autor y Fish no garantiza uso comercial.
/// </summary>
[Table("tts_fish_voices")]
public class FishVoice
{
    [Key]
    [Column("reference_id")] public string ReferenceId { get; set; } = "";
    [Column("name")] public string Name { get; set; } = "";
    /// <summary>Códigos de idioma que declara la voz en Fish, separados por coma.</summary>
    [Column("languages")] public string Languages { get; set; } = "";
    [Column("author")] public string? Author { get; set; }
    [Column("sample_url")] public string? SampleUrl { get; set; }
    /// <summary>commercial | noncommercial | unknown</summary>
    [Column("license")] public string License { get; set; } = "unknown";
    [Column("license_note")] public string? LicenseNote { get; set; }
    [Column("active")] public bool Active { get; set; } = true;
    /// <summary>manual | missing (Fish ya no la devuelve) | takedown</summary>
    [Column("inactive_reason")] public string? InactiveReason { get; set; }
    /// <summary>admin | request</summary>
    [Column("source")] public string Source { get; set; } = "admin";
    [Column("created_by")] public long? CreatedBy { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    [Column("last_checked_at")] public DateTimeOffset? LastCheckedAt { get; set; }
}
