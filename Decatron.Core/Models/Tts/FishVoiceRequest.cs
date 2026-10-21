using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tts;

/// <summary>
/// Solicitud de un streamer para que el admin agregue una voz de personaje de Fish al catálogo.
/// </summary>
[Table("tts_fish_voice_requests")]
public class FishVoiceRequest
{
    [Key]
    [Column("id")] public long Id { get; set; }
    [Column("user_id")] public long UserId { get; set; }
    [Column("description")] public string Description { get; set; } = "";
    /// <summary>Id de Fish si el streamer pegó un enlace o id válido.</summary>
    [Column("reference_id")] public string? ReferenceId { get; set; }
    /// <summary>Nombre de la voz elegida en Fish (lo toma el servidor de Fish, no el navegador).</summary>
    [Column("title")] public string? Title { get; set; }
    /// <summary>Muestra de audio de la voz elegida, para que el admin la escuche sin buscarla.</summary>
    [Column("sample_url")] public string? SampleUrl { get; set; }
    /// <summary>pending | approved | rejected</summary>
    [Column("status")] public string Status { get; set; } = "pending";
    [Column("admin_note")] public string? AdminNote { get; set; }
    /// <summary>Voz del catálogo con la que se resolvió (si se aprobó).</summary>
    [Column("voice_id")] public string? VoiceId { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    [Column("resolved_at")] public DateTimeOffset? ResolvedAt { get; set; }
}
