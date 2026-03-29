using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("timer_templates")]
    public class TimerTemplate
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        // Metadata
        [Required]
        [MaxLength(100)]
        [Column("name")]
        public string Name { get; set; } = string.Empty;

        [MaxLength(255)]
        [Column("description")]
        public string? Description { get; set; }

        [MaxLength(10)]
        [Column("icon")]
        public string Icon { get; set; } = "📋";

        // Template Configuration (full snapshot)
        [Required]
        [Column("default_duration")]
        public int DefaultDuration { get; set; }

        [Required]
        [Column("auto_start")]
        public bool AutoStart { get; set; }

        [Required]
        [Column("canvas_width")]
        public int CanvasWidth { get; set; } = 1000;

        [Required]
        [Column("canvas_height")]
        public int CanvasHeight { get; set; } = 300;

        [Required]
        [Column("display_config", TypeName = "jsonb")]
        public string DisplayConfig { get; set; } = "{}";

        [Required]
        [Column("progressbar_config", TypeName = "jsonb")]
        public string ProgressBarConfig { get; set; } = "{}";

        [Required]
        [Column("style_config", TypeName = "jsonb")]
        public string StyleConfig { get; set; } = "{}";

        [Required]
        [Column("animation_config", TypeName = "jsonb")]
        public string AnimationConfig { get; set; } = "{}";

        [Required]
        [Column("theme_config", TypeName = "jsonb")]
        public string ThemeConfig { get; set; } = "{}";

        [Required]
        [Column("events_config", TypeName = "jsonb")]
        public string EventsConfig { get; set; } = "{}";

        [Required]
        [Column("alerts_config", TypeName = "jsonb")]
        public string AlertsConfig { get; set; } = "{}";

        [Required]
        [Column("goal_config", TypeName = "jsonb")]
        public string GoalConfig { get; set; } = "{}";

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
