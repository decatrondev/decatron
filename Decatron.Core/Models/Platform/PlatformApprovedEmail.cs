using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Platform;

/// <summary>
/// Correo aprobado por el dueño para registrarse como comprador mientras <c>Platform:SignupMode</c> es «approval» (el valor por defecto).
/// Global, sin tenant_id ni RLS: aún no existe el tenant.
/// </summary>
[Table("platform_approved_emails")]
public class PlatformApprovedEmail
{
    /// <summary>Siempre en minúsculas.</summary>
    [Key, Column("email"), MaxLength(254)]
    public string Email { get; set; } = "";

    [Column("approved_at")]
    public DateTime ApprovedAt { get; set; } = DateTime.UtcNow;

    [Column("approved_by"), MaxLength(100)]
    public string ApprovedBy { get; set; } = "";

    [Column("note"), MaxLength(200)]
    public string? Note { get; set; }
}
