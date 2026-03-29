using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.OAuth
{
    /// <summary>
    /// Token de acceso OAuth2 (1 hora de validez).
    /// Se usa en el header Authorization: Bearer {token}
    /// </summary>
    [Table("oauth_access_tokens")]
    public class OAuthAccessToken
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        /// <summary>
        /// Token de acceso (64 chars crypto random)
        /// </summary>
        [Column("token")]
        [Required]
        [MaxLength(64)]
        public string Token { get; set; } = string.Empty;

        /// <summary>
        /// Aplicación que generó el token
        /// </summary>
        [Column("application_id")]
        public Guid ApplicationId { get; set; }

        /// <summary>
        /// Usuario al que pertenece el token
        /// </summary>
        [Column("user_id")]
        public long UserId { get; set; }

        /// <summary>
        /// Scopes otorgados al token
        /// </summary>
        [Column("scopes", TypeName = "text[]")]
        public string[] Scopes { get; set; } = Array.Empty<string>();

        /// <summary>
        /// Fecha de expiración (1 hora después de creación)
        /// </summary>
        [Column("expires_at")]
        public DateTime ExpiresAt { get; set; }

        /// <summary>
        /// Si el token fue revocado
        /// </summary>
        [Column("revoked")]
        public bool Revoked { get; set; } = false;

        /// <summary>
        /// Razón de revocación (si aplica)
        /// </summary>
        [Column("revoked_reason")]
        [MaxLength(255)]
        public string? RevokedReason { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// IP desde donde se creó el token
        /// </summary>
        [Column("ip_address")]
        [MaxLength(45)]
        public string? IpAddress { get; set; }

        /// <summary>
        /// User-Agent del cliente
        /// </summary>
        [Column("user_agent")]
        [MaxLength(500)]
        public string? UserAgent { get; set; }

        // ═══════════════════════════════════════════════════════════════
        // NAVEGACIÓN
        // ═══════════════════════════════════════════════════════════════

        [ForeignKey("ApplicationId")]
        public virtual OAuthApplication? Application { get; set; }

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }

        // ═══════════════════════════════════════════════════════════════
        // HELPERS
        // ═══════════════════════════════════════════════════════════════

        public bool IsExpired => DateTime.UtcNow > ExpiresAt;
        public bool IsValid => !Revoked && !IsExpired;

        /// <summary>
        /// Verifica si el token tiene un scope específico
        /// </summary>
        public bool HasScope(string scope) => Scopes.Contains(scope);

        /// <summary>
        /// Verifica si el token tiene todos los scopes requeridos
        /// </summary>
        public bool HasScopes(params string[] requiredScopes) => requiredScopes.All(s => Scopes.Contains(s));
    }
}
