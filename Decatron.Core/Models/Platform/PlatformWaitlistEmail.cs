using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Platform;

/// <summary>
/// Un correo de confirmación de la lista de espera enviado por Resend. Solo sirve para contar cuántos salieron en
/// las últimas 24 h y aplicar el tope diario (la cuota de Resend la comparte el resto del bot: comprobantes, etc.).
/// </summary>
[Table("platform_waitlist_emails")]
public class PlatformWaitlistEmail
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("sent_at")]
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
