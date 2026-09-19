using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.LiveTranslation
{
    /// <summary>
    /// App de escritorio vinculada a un canal. Se vincula con un código de un solo uso
    /// generado desde el dashboard; a cambio recibe un token largo que solo sirve para
    /// abrir el WebSocket de ingesta de audio (no da acceso a la API del dashboard).
    /// Solo se guarda el hash del token.
    /// </summary>
    [Table("live_translation_devices")]
    public class LiveTranslationDevice
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
