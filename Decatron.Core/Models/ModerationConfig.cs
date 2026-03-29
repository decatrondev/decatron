using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Configuración del sistema de moderación de un canal
    /// </summary>
    [Table("moderation_configs")]
    public class ModerationConfig
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        /// <summary>
        /// ID del usuario propietario del canal
        /// </summary>
        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        /// <summary>
        /// Nombre del canal (lowercase)
        /// </summary>
        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        /// <summary>
        /// Inmunidad de VIPs: total o escalamiento
        /// </summary>
        [Column("vip_immunity")]
        [MaxLength(20)]
        public string VipImmunity { get; set; } = "escalamiento";

        /// <summary>
        /// Inmunidad de Suscriptores: total o escalamiento
        /// </summary>
        [Column("sub_immunity")]
        [MaxLength(20)]
        public string SubImmunity { get; set; } = "escalamiento";

        /// <summary>
        /// Lista de usuarios en whitelist manual (JSON array)
        /// </summary>
        [Column("whitelist_users", TypeName = "jsonb")]
        public string WhitelistUsers { get; set; } = "[]";

        /// <summary>
        /// Mensaje de advertencia personalizado (variables: $(user), $(strike), $(word))
        /// </summary>
        [Column("warning_message")]
        [MaxLength(500)]
        public string WarningMessage { get; set; } = "⚠️ $(user), evita usar ese lenguaje. Strike $(strike)/5";

        /// <summary>
        /// Mensaje para acción de borrar mensaje (variables: $(user), $(strike), $(word))
        /// </summary>
        [Column("delete_message")]
        [MaxLength(500)]
        public string DeleteMessage { get; set; } = "🗑️ $(user), mensaje borrado por lenguaje inapropiado. Strike $(strike)/5";

        /// <summary>
        /// Mensaje para acción de timeout (variables: $(user), $(strike), $(word))
        /// </summary>
        [Column("timeout_message")]
        [MaxLength(500)]
        public string TimeoutMessage { get; set; } = "⏱️ $(user), timeout aplicado por lenguaje inapropiado. Strike $(strike)/5";

        /// <summary>
        /// Mensaje para acción de ban (variables: $(user), $(strike), $(word))
        /// </summary>
        [Column("ban_message")]
        [MaxLength(500)]
        public string BanMessage { get; set; } = "🔨 $(user), has sido baneado por lenguaje inapropiado. Strike $(strike)/5";

        /// <summary>
        /// Mensaje personalizado para palabras de severidad SEVERO (ban directo) (variables: $(user), $(word))
        /// </summary>
        [Column("severo_message")]
        [MaxLength(500)]
        public string SeveroMessage { get; set; } = "🔨 $(user), has sido baneado por usar: $(word)";

        /// <summary>
        /// Tiempo de expiración de strikes: 5min, 10min, 15min, 30min, 1hour, never
        /// </summary>
        [Column("strike_expiration")]
        [MaxLength(20)]
        public string StrikeExpiration { get; set; } = "15min";

        /// <summary>
        /// Acción para Strike 1
        /// </summary>
        [Column("strike1_action")]
        [MaxLength(20)]
        public string Strike1Action { get; set; } = "warning";

        /// <summary>
        /// Acción para Strike 2
        /// </summary>
        [Column("strike2_action")]
        [MaxLength(20)]
        public string Strike2Action { get; set; } = "timeout_1m";

        /// <summary>
        /// Acción para Strike 3
        /// </summary>
        [Column("strike3_action")]
        [MaxLength(20)]
        public string Strike3Action { get; set; } = "timeout_5m";

        /// <summary>
        /// Acción para Strike 4
        /// </summary>
        [Column("strike4_action")]
        [MaxLength(20)]
        public string Strike4Action { get; set; } = "timeout_10m";

        /// <summary>
        /// Acción para Strike 5
        /// </summary>
        [Column("strike5_action")]
        [MaxLength(20)]
        public string Strike5Action { get; set; } = "ban";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
