using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Platform;

/// <summary>
/// Solicitud de registro de un comprador (.dev/plans/plataforma/FASE_A_BC_DISENO.md, pieza B). No es un tenant:
/// el tenant nace solo cuando el correo se confirma con el enlace. Global, sin tenant_id ni RLS.
/// </summary>
[Table("platform_signups")]
public class PlatformSignup
{
    [Key, Column("id")]
    public long Id { get; set; }

    /// <summary>Siempre en minúsculas.</summary>
    [Column("email"), MaxLength(254)]
    public string Email { get; set; } = "";

    [Column("slug"), MaxLength(30)]
    public string Slug { get; set; } = "";

    [Column("project_name"), MaxLength(80)]
    public string ProjectName { get; set; } = "";

    [Column("locale"), MaxLength(5)]
    public string Locale { get; set; } = "es";

    /// <summary>SHA-256 (hex) del token del enlace; el token en claro solo viaja por correo.</summary>
    [Column("token_hash"), MaxLength(64)]
    public string TokenHash { get; set; } = "";

    [Column("ip_hash"), MaxLength(64)]
    public string IpHash { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("used_at")]
    public DateTime? UsedAt { get; set; }

    [Column("tenant_id")]
    public long? TenantId { get; set; }

    /// <summary>signup (alta de un tenant nuevo) | login (enlace de entrada de un comprador existente).</summary>
    [Column("purpose"), MaxLength(10)]
    public string Purpose { get; set; } = "signup";

    /// <summary>Solo en purpose=login: el comprador (users.id) al que pertenece el enlace.</summary>
    [Column("user_id")]
    public long? UserId { get; set; }
}
