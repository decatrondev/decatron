using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("decatron_ai_channel_config")]
    public class DecatronAIChannelConfig
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("channel_name")]
        [Required]
        [MaxLength(100)]
        public string ChannelName { get; set; } = string.Empty;

        // Permisos de usuarios
        [Column("permission_level")]
        [Required]
        [MaxLength(50)]
        public string PermissionLevel { get; set; } = "everyone"; // 'everyone', 'subscriber', 'vip', 'moderator', 'broadcaster'

        [Column("whitelist_enabled")]
        public bool WhitelistEnabled { get; set; } = false;

        [Column("whitelist_users")]
        public string WhitelistUsers { get; set; } = "[]"; // JSON array

        [Column("blacklist_users")]
        public string BlacklistUsers { get; set; } = "[]"; // JSON array

        // Cooldowns
        [Column("channel_cooldown_seconds")]
        public int ChannelCooldownSeconds { get; set; } = 300;

        [Column("user_cooldown_seconds")]
        public int? UserCooldownSeconds { get; set; }

        // Personalización
        [Column("custom_prefix")]
        [MaxLength(100)]
        public string? CustomPrefix { get; set; }

        [Column("custom_system_prompt")]
        public string? CustomSystemPrompt { get; set; }

        // Metadata
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
