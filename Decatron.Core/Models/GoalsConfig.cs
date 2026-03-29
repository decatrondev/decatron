using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("goals_configs")]
    public class GoalsConfig
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

        // Canvas Resolution
        [Required]
        [Column("canvas_width")]
        public int CanvasWidth { get; set; } = 1000;

        [Required]
        [Column("canvas_height")]
        public int CanvasHeight { get; set; } = 300;

        // Goals Array (JSON)
        [Required]
        [Column("goals", TypeName = "jsonb")]
        public string Goals { get; set; } = "[]";

        // Active Goal IDs (JSON array)
        [Required]
        [Column("active_goal_ids", TypeName = "jsonb")]
        public string ActiveGoalIds { get; set; } = "[]";

        // Goal Positions for Overlay Editor (JSON)
        [Required]
        [Column("goal_positions", TypeName = "jsonb")]
        public string GoalPositions { get; set; } = "{}";

        // Default Sources Configuration (JSON)
        [Required]
        [Column("default_sources", TypeName = "jsonb")]
        public string DefaultSources { get; set; } = "{}";

        // Design Configuration (JSON)
        [Required]
        [Column("design_config", TypeName = "jsonb")]
        public string DesignConfig { get; set; } = "{}";

        // Notifications Configuration (JSON)
        [Required]
        [Column("notifications_config", TypeName = "jsonb")]
        public string NotificationsConfig { get; set; } = "{}";

        // Timer Integration Configuration (JSON)
        [Required]
        [Column("timer_integration_config", TypeName = "jsonb")]
        public string TimerIntegrationConfig { get; set; } = "{}";

        // Commands Configuration (JSON)
        [Required]
        [Column("commands_config", TypeName = "jsonb")]
        public string CommandsConfig { get; set; } = "{}";

        // History Settings
        [Required]
        [Column("history_enabled")]
        public bool HistoryEnabled { get; set; } = true;

        [Required]
        [Column("history_retention_days")]
        public int HistoryRetentionDays { get; set; } = 30;

        // Session Settings
        [Required]
        [Column("reset_on_stream_end")]
        public bool ResetOnStreamEnd { get; set; } = true;

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

    // Progress history entry for tracking changes
    [Table("goals_progress_logs")]
    public class GoalsProgressLog
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("config_id")]
        public int ConfigId { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("goal_id")]
        public string GoalId { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        [Column("goal_name")]
        public string GoalName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        [Column("action")]
        public string Action { get; set; } = string.Empty; // created, started, progress, milestone, completed, reset, expired

        [Column("previous_value")]
        public int? PreviousValue { get; set; }

        [Column("new_value")]
        public int? NewValue { get; set; }

        [MaxLength(50)]
        [Column("milestone_id")]
        public string? MilestoneId { get; set; }

        [MaxLength(100)]
        [Column("milestone_name")]
        public string? MilestoneName { get; set; }

        [MaxLength(50)]
        [Column("source")]
        public string? Source { get; set; } // subs, bits, follows, raids, combined

        [MaxLength(100)]
        [Column("triggered_by")]
        public string? TriggeredBy { get; set; } // username or 'system'

        [Required]
        [Column("timestamp")]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("ConfigId")]
        public virtual GoalsConfig? Config { get; set; }
    }
}
