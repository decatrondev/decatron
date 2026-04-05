using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    /// <summary>
    /// Settings del viewer para el gacha — privacidad, preferencias, vinculación con User
    /// </summary>
    [Table("gacha_viewer_settings")]
    public class GachaViewerSettings
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        /// <summary>User ID de Decatron (vinculado via Twitch login)</summary>
        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        /// <summary>Nombre del viewer en el chat (twitch username)</summary>
        [Required]
        [Column("twitch_username")]
        [MaxLength(100)]
        public string TwitchUsername { get; set; } = "";

        /// <summary>Si el viewer acepto los terminos del gacha</summary>
        [Column("terms_accepted")]
        public bool TermsAccepted { get; set; } = false;

        [Column("terms_accepted_at")]
        public DateTime? TermsAcceptedAt { get; set; }

        /// <summary>Colecciones publicas por defecto (true) o privadas (false)</summary>
        [Column("collections_public")]
        public bool CollectionsPublic { get; set; } = true;

        /// <summary>Canales donde la coleccion es privada (JSON array de channel names)</summary>
        [Column("private_channels", TypeName = "jsonb")]
        public string PrivateChannelsJson { get; set; } = "[]";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}
