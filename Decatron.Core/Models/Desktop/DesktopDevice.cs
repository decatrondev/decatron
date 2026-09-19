using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Desktop
{
    /// <summary>
    /// Una instalación de Decatron Desktop vinculada a un canal. Se vincula una sola vez
    /// con un código corto generado desde el dashboard; a cambio recibe un token largo que
    /// solo sirve para abrir el WebSocket de escritorio (no da acceso a la API del
    /// dashboard). Todos los módulos de la app (traducción en vivo, asistente de LoL…)
    /// comparten esta vinculación. Solo se guarda el hash del token.
    /// </summary>
    [Table("desktop_devices")]
    public class DesktopDevice
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        /// <summary>Nombre que puso la app al vincularse ("PC gamer", hostname…).</summary>
        [Column("name")]
        [MaxLength(80)]
        public string Name { get; set; } = "";

        /// <summary>SHA-256 hex del token.</summary>
        [Column("token_hash")]
        [MaxLength(64)]
        public string TokenHash { get; set; } = "";

        /// <summary>Versión de la app en la última conexión, para soporte.</summary>
        [Column("app_version")]
        [MaxLength(30)]
        public string? AppVersion { get; set; }

        /// <summary>windows · macos · linux</summary>
        [Column("platform")]
        [MaxLength(20)]
        public string? Platform { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("last_seen_at")]
        public DateTime? LastSeenAt { get; set; }

        [Column("revoked_at")]
        public DateTime? RevokedAt { get; set; }

        [NotMapped]
        public bool IsRevoked => RevokedAt.HasValue;
    }
}
