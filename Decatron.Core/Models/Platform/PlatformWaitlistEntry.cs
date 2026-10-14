using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Platform;

/// <summary>
/// Persona anotada en la lista de espera de la plataforma (decatron.top, .dev/plans/PLATAFORMA_PLAN.md, Fase L).
/// Doble confirmación: no cuenta hasta que abre el enlace del correo. No es un tenant ni tiene cuenta.
/// </summary>
[Table("platform_waitlist")]
public class PlatformWaitlistEntry
{
    [Key, Column("id")]
    public long Id { get; set; }

    /// <summary>Siempre en minúsculas; único.</summary>
    [Column("email"), MaxLength(254)]
    public string Email { get; set; } = "";

    /// <summary>own_channel | several_channels | community | other</summary>
    [Column("use_case"), MaxLength(24)]
    public string UseCase { get; set; } = "other";

    /// <summary>twitch | kick | other | "" (opcional)</summary>
    [Column("platform"), MaxLength(12)]
    public string Platform { get; set; } = "";

    [Column("locale"), MaxLength(5)]
    public string Locale { get; set; } = "es";

    /// <summary>SHA-256 (hex) del token del enlace de confirmación; el token en claro solo viaja por correo.</summary>
    [Column("confirm_token_hash"), MaxLength(64)]
    public string ConfirmTokenHash { get; set; } = "";

    [Column("confirmed_at")]
    public DateTime? ConfirmedAt { get; set; }

    /// <summary>Último envío del correo de confirmación (limita los reenvíos).</summary>
    [Column("last_email_at")]
    public DateTime? LastEmailAt { get; set; }

    /// <summary>SHA-256 (hex) de la IP, solo para limitar altas por IP; no se guarda la IP.</summary>
    [Column("ip_hash"), MaxLength(64)]
    public string IpHash { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
