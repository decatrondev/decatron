using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("timer_configs")]
    public class TimerConfig
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("channel_name")]
        public string ChannelName { get; set; } = string.Empty;

        // Basic Configuration
        [Required]
        [Column("default_duration")]
        public int DefaultDuration { get; set; } // segundos

        [Required]
        [Column("auto_start")]
        public bool AutoStart { get; set; }

        [Required]
        [Column("max_chances")]
        public int MaxChances { get; set; } = 0;

        [Column("resurrection_message")]
        public string? ResurrectionMessage { get; set; }

        [Column("game_over_message")]
        public string? GameOverMessage { get; set; }

        [MaxLength(100)]
        [Column("time_zone")]
        public string TimeZone { get; set; } = "UTC";

        // Overlay Canvas Resolution
        [Required]
        [Column("canvas_width")]
        public int CanvasWidth { get; set; } = 1000;

        [Required]
        [Column("canvas_height")]
        public int CanvasHeight { get; set; } = 300;

        // Display Configuration (JSON)
        [Required]
        [Column("display_config", TypeName = "jsonb")]
        public string DisplayConfig { get; set; } = "{}";

        // Progress Bar Configuration (JSON)
        [Required]
        [Column("progressbar_config", TypeName = "jsonb")]
        public string ProgressBarConfig { get; set; } = "{}";

        // Style Configuration (JSON)
        [Required]
        [Column("style_config", TypeName = "jsonb")]
        public string StyleConfig { get; set; } = "{}";

        // Animation Configuration (JSON)
        [Required]
        [Column("animation_config", TypeName = "jsonb")]
        public string AnimationConfig { get; set; } = "{}";

        // Theme Configuration (JSON)
        [Required]
        [Column("theme_config", TypeName = "jsonb")]
        public string ThemeConfig { get; set; } = "{}";

        // Events Configuration (JSON)
        [Required]
        [Column("events_config", TypeName = "jsonb")]
        public string EventsConfig { get; set; } = "{}";

        // Commands Configuration (JSON)
        [Required]
        [Column("commands_config", TypeName = "jsonb")]
        public string CommandsConfig { get; set; } = "{}";

        // Alerts Configuration (JSON)
        [Required]
        [Column("alerts_config", TypeName = "jsonb")]
        public string AlertsConfig { get; set; } = "{}";

        // Goal Configuration (JSON)
        [Required]
        [Column("goal_config", TypeName = "jsonb")]
        public string GoalConfig { get; set; } = "{}";

        // Advanced Configuration (JSON)
        [Required]
        [Column("advanced_config", TypeName = "jsonb")]
        public string AdvancedConfig { get; set; } = "{}";

        // History Configuration (JSON)
        [Required]
        [Column("history_config", TypeName = "jsonb")]
        public string HistoryConfig { get; set; } = "{}";

        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}
