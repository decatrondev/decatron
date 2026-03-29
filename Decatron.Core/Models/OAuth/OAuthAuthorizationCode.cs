using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.OAuth
{
    /// <summary>
    /// Código de autorización temporal (10 minutos).
    /// Se intercambia por access_token y refresh_token.
    /// </summary>
    [Table("oauth_authorization_codes")]
    public class OAuthAuthorizationCode
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        /// <summary>
        /// Código de autorización (32 bytes base64url)
        /// </summary>
        [Column("code")]
        [Required]
        [MaxLength(64)]
        public string Code { get; set; } = string.Empty;

        /// <summary>
        /// Aplicación que solicitó el código
        /// </summary>
        [Column("application_id")]
        public Guid ApplicationId { get; set; }

        /// <summary>
        /// Usuario que autorizó el código
        /// </summary>
        [Column("user_id")]
        public long UserId { get; set; }

        /// <summary>
        /// Scopes aprobados por el usuario
        /// </summary>
        [Column("scopes", TypeName = "text[]")]
        public string[] Scopes { get; set; } = Array.Empty<string>();

        /// <summary>
        /// URI de redirección usada en la solicitud
        /// </summary>
        [Column("redirect_uri")]
        [Required]
        [MaxLength(500)]
        public string RedirectUri { get; set; } = string.Empty;

        /// <summary>
        /// PKCE: Code challenge (SHA256 hash del verifier)
        /// </summary>
        [Column("code_challenge")]
        [MaxLength(128)]
        public string? CodeChallenge { get; set; }

        /// <summary>
        /// PKCE: Método de challenge (S256 o plain)
        /// </summary>
        [Column("code_challenge_method")]
        [MaxLength(10)]
        public string? CodeChallengeMethod { get; set; }

        /// <summary>
        /// State parameter para prevenir CSRF
        /// </summary>
        [Column("state")]
        [MaxLength(128)]
        public string? State { get; set; }

        /// <summary>
        /// Fecha de expiración (10 minutos después de creación)
        /// </summary>
        [Column("expires_at")]
        public DateTime ExpiresAt { get; set; }

        /// <summary>
        /// Si el código ya fue usado (solo se puede usar una vez)
        /// </summary>
        [Column("used")]
        public bool Used { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

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
        public bool IsValid => !Used && !IsExpired;
    }
}
