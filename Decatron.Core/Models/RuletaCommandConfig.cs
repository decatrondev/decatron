using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("ruleta_command_configs")]
    public class RuletaCommandConfig
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        [ForeignKey("UserId")]
        public User? ChannelUser { get; set; }

        [Column("enabled")]
        public bool Enabled { get; set; } = true;

        [Required]
        [Column("command_name")]
        [MaxLength(50)]
        public string CommandName { get; set; } = "!ruleta";

        [Column("chance_percent")]
        public int ChancePercent { get; set; } = 17;

        [Column("min_timeout_seconds")]
        public int MinTimeoutSeconds { get; set; } = 60;

        [Column("max_timeout_seconds")]
        public int MaxTimeoutSeconds { get; set; } = 60;

        [Column("cooldown_global")]
        public int CooldownGlobal { get; set; } = 10;

        [Column("cooldown_user")]
        public int CooldownUser { get; set; } = 30;

        // Nivel mínimo requerido: everyone, subscriber, vip, moderator, lead_moderator, broadcaster
        [Column("permission")]
        [MaxLength(20)]
        public string Permission { get; set; } = "everyone";

        [Column("allow_self_target")]
        public bool AllowSelfTarget { get; set; } = true;

        [Column("allow_target_moderators")]
        public bool AllowTargetModerators { get; set; } = false;

        // Listas de usernames (JSON array), mismo patrón que ShoutoutConfig.Blacklist/Whitelist.
        // Protegidos: nunca pueden ser el objetivo de !ruleta en este canal.
        [Column("protected_users", TypeName = "jsonb")]
        public string ProtectedUsers { get; set; } = "[]";

        // Bloqueados: no pueden ejecutar !ruleta en este canal, sin importar su nivel de Permisos.
        [Column("blocked_users", TypeName = "jsonb")]
        public string BlockedUsers { get; set; } = "[]";

        // Listas de variantes (JSON array de strings) — el bot elige una al azar en cada disparo.
        // Igual patrón que ShoutoutConfig.Blacklist/Whitelist: columna jsonb con un string serializado.
        [Column("hit_messages", TypeName = "jsonb")]
        public string HitMessages { get; set; } = "[\"🔫💥 BANG! @{shooter} le disparó a @{target} — {seconds}s de timeout\"]";

        [Column("miss_messages", TypeName = "jsonb")]
        public string MissMessages { get; set; } = "[\"🔫 *click* @{shooter} apuntó a @{target}... y sobrevivió\"]";

        [Column("use_self_messages")]
        public bool UseSelfMessages { get; set; } = true;

        [Column("self_hit_messages", TypeName = "jsonb")]
        public string SelfHitMessages { get; set; } = "[\"🔫💥 @{shooter} se apuntó a sí mismo... BANG! {seconds}s de timeout\"]";

        [Column("self_miss_messages", TypeName = "jsonb")]
        public string SelfMissMessages { get; set; } = "[\"🔫 @{shooter} se apuntó a sí mismo... *click* sobrevivió de milagro\"]";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
