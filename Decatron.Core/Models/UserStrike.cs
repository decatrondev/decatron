using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Registro de strikes de moderación por usuario
    /// </summary>
    [Table("user_strikes")]
    public class UserStrike
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        /// <summary>
        /// Nombre del canal donde se aplicó el strike
        /// </summary>
        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        /// <summary>
        /// Nombre del usuario que recibió el strike
        /// </summary>
        [Required]
        [Column("username")]
        [MaxLength(100)]
        public string Username { get; set; } = "";

        /// <summary>
        /// Nivel de strike actual (1-5)
        /// </summary>
        [Column("strike_level")]
        public int StrikeLevel { get; set; } = 1;

        /// <summary>
        /// Timestamp de la última infracción
        /// </summary>
        [Column("last_infraction_at")]
        public DateTime LastInfractionAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Timestamp cuando el strike expirará y bajará 1 nivel
        /// </summary>
        [Column("expires_at")]
        public DateTime? ExpiresAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
