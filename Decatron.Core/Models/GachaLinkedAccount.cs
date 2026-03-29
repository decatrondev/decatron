using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Representa la vinculación entre una cuenta de GachaVerse y una cuenta de Twitch
    /// </summary>
    [Table("gacha_linked_accounts")]
    public class GachaLinkedAccount
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        /// <summary>
        /// ID del usuario en la base de datos MySQL de GachaVerse
        /// </summary>
        [Required]
        [Column("gacha_user_id")]
        public int GachaUserId { get; set; }

        /// <summary>
        /// Username del usuario en GachaVerse (para referencia)
        /// </summary>
        [Required]
        [Column("gacha_username")]
        [MaxLength(100)]
        public string GachaUsername { get; set; } = "";

        /// <summary>
        /// ID del usuario en la base de datos PostgreSQL de Decatron (Twitch)
        /// </summary>
        [Required]
        [Column("twitch_user_id")]
        public long TwitchUserId { get; set; }

        /// <summary>
        /// Username de Twitch (para referencia)
        /// </summary>
        [Required]
        [Column("twitch_username")]
        [MaxLength(100)]
        public string TwitchUsername { get; set; } = "";

        /// <summary>
        /// Fecha y hora de vinculación
        /// </summary>
        [Column("linked_at")]
        public DateTime LinkedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Indica si la vinculación está activa (permite desvinculación)
        /// </summary>
        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Última vez que el usuario usó la integración
        /// </summary>
        [Column("last_used_at")]
        public DateTime? LastUsedAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
