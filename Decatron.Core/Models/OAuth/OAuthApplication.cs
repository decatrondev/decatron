using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.OAuth
{
    /// <summary>
    /// Representa una aplicación OAuth2 registrada por un desarrollador.
    /// Los desarrolladores usan client_id y client_secret para autenticar sus apps.
    /// </summary>
    [Table("oauth_applications")]
    public class OAuthApplication
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        /// <summary>
        /// Usuario dueño de la aplicación (FK a User.Id)
        /// </summary>
        [Column("owner_id")]
        public long OwnerId { get; set; }

        /// <summary>
        /// Nombre de la aplicación (ej: "Mi Bot de Discord")
        /// </summary>
        [Column("name")]
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Descripción de la aplicación
        /// </summary>
        [Column("description")]
        public string? Description { get; set; }

        /// <summary>
        /// Client ID público (ej: "deca_abc123xyz")
        /// </summary>
        [Column("client_id")]
        [Required]
        [MaxLength(50)]
        public string ClientId { get; set; } = string.Empty;

        /// <summary>
        /// Hash BCrypt del client secret
        /// </summary>
        [Column("client_secret_hash")]
        [Required]
        [MaxLength(255)]
        public string ClientSecretHash { get; set; } = string.Empty;

        /// <summary>
        /// URIs de redirección permitidas
        /// </summary>
        [Column("redirect_uris", TypeName = "text[]")]
        public string[] RedirectUris { get; set; } = Array.Empty<string>();

        /// <summary>
        /// Scopes que la aplicación puede solicitar
        /// </summary>
        [Column("scopes", TypeName = "text[]")]
        public string[] Scopes { get; set; } = Array.Empty<string>();

        /// <summary>
        /// URL del icono de la aplicación
        /// </summary>
        [Column("icon_url")]
        [MaxLength(500)]
        public string? IconUrl { get; set; }

        /// <summary>
        /// URL del sitio web de la aplicación
        /// </summary>
        [Column("website_url")]
        [MaxLength(500)]
        public string? WebsiteUrl { get; set; }

        /// <summary>
        /// Si la aplicación está activa
        /// </summary>
        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Si la aplicación ha sido verificada por Decatron
        /// </summary>
        [Column("is_verified")]
        public bool IsVerified { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        // ═══════════════════════════════════════════════════════════════
        // NAVEGACIÓN
        // ═══════════════════════════════════════════════════════════════

        [ForeignKey("OwnerId")]
        public virtual User? Owner { get; set; }

        public virtual ICollection<OAuthAuthorizationCode> AuthorizationCodes { get; set; } = new List<OAuthAuthorizationCode>();
        public virtual ICollection<OAuthAccessToken> AccessTokens { get; set; } = new List<OAuthAccessToken>();
    }
}
