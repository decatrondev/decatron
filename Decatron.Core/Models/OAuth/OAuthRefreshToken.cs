using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.OAuth
{
    /// <summary>
    /// Token de refresh OAuth2 (30 días de validez).
    /// Se usa para obtener nuevos access tokens sin re-autorización.
    /// </summary>
    [Table("oauth_refresh_tokens")]
    public class OAuthRefreshToken
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        /// <summary>
        /// Token de refresh (64 chars crypto random)
        /// </summary>
        [Column("token")]
        [Required]
        [MaxLength(64)]
        public string Token { get; set; } = string.Empty;

        /// <summary>
        /// Access token asociado
        /// </summary>
        [Column("access_token_id")]
        public Guid AccessTokenId { get; set; }

        /// <summary>
        /// Fecha de expiración (30 días después de creación)
        /// </summary>
        [Column("expires_at")]
        public DateTime ExpiresAt { get; set; }

        /// <summary>
        /// Si el token fue revocado
        /// </summary>
        [Column("revoked")]
        public bool Revoked { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Última vez que se usó para refresh
        /// </summary>
        [Column("used_at")]
        public DateTime? UsedAt { get; set; }

        // ═══════════════════════════════════════════════════════════════
        // NAVEGACIÓN
        // ═══════════════════════════════════════════════════════════════

        [ForeignKey("AccessTokenId")]
        public virtual OAuthAccessToken? AccessToken { get; set; }

        // ═══════════════════════════════════════════════════════════════
        // HELPERS
        // ═══════════════════════════════════════════════════════════════

        public bool IsExpired => DateTime.UtcNow > ExpiresAt;
        public bool IsValid => !Revoked && !IsExpired;
    }
}
