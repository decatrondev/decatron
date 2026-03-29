using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("tips_configs")]
    public class TipsConfig
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

        [Column("is_enabled")]
        public bool IsEnabled { get; set; } = false;

        // PayPal Configuration
        [MaxLength(500)]
        [Column("paypal_email")]
        public string? PayPalEmail { get; set; }

        [Column("paypal_connected")]
        public bool PayPalConnected { get; set; } = false;

        [MaxLength(10)]
        [Column("currency")]
        public string Currency { get; set; } = "USD";

        [Column("min_amount")]
        public decimal MinAmount { get; set; } = 1.00m;

        [Column("max_amount")]
        public decimal MaxAmount { get; set; } = 500.00m;

        // Suggested amounts (comma-separated)
        [MaxLength(100)]
        [Column("suggested_amounts")]
        public string SuggestedAmounts { get; set; } = "5,10,25,50,100";

        // Donation Page Customization
        [MaxLength(200)]
        [Column("page_title")]
        public string PageTitle { get; set; } = "Support My Stream!";

        [MaxLength(1000)]
        [Column("page_description")]
        public string? PageDescription { get; set; }

        [MaxLength(50)]
        [Column("page_accent_color")]
        public string PageAccentColor { get; set; } = "#9146FF";

        [MaxLength(500)]
        [Column("page_background_image")]
        public string? PageBackgroundImage { get; set; }

        // Alert Configuration (JSONB)
        [Required]
        [Column("alert_config", TypeName = "jsonb")]
        public string AlertConfig { get; set; } = "{}";

        // Alert Mode: 'timer' = use Timer system, 'basic' = independent alerts
        [MaxLength(20)]
        [Column("alert_mode")]
        public string AlertMode { get; set; } = "timer";

        // Basic Alert Settings (when AlertMode == 'basic')
        [MaxLength(500)]
        [Column("basic_alert_sound")]
        public string? BasicAlertSound { get; set; }

        [Column("basic_alert_volume")]
        public int BasicAlertVolume { get; set; } = 80;

        [Column("basic_alert_duration")]
        public int BasicAlertDuration { get; set; } = 5000;

        [MaxLength(20)]
        [Column("basic_alert_animation")]
        public string BasicAlertAnimation { get; set; } = "fade";

        [MaxLength(500)]
        [Column("basic_alert_message")]
        public string BasicAlertMessage { get; set; } = "¡{donorName} donó {amount}! {message}";

        // TTS for Basic Alerts (JSONB)
        [Column("basic_alert_tts", TypeName = "jsonb")]
        public string? BasicAlertTts { get; set; }

        // Overlay Config for Basic Alerts (JSONB) - includes positions, media, text styles
        [Column("basic_alert_overlay", TypeName = "jsonb")]
        public string? BasicAlertOverlay { get; set; }

        // Full Tips Alert Config (JSONB) - includes base alert, tiers, variants (new system like Event Alerts)
        [Column("tips_alert_config", TypeName = "jsonb")]
        public string? TipsAlertConfig { get; set; }

        // Timer Integration
        [Column("timer_integration_enabled")]
        public bool TimerIntegrationEnabled { get; set; } = false;

        [Column("seconds_per_currency")]
        public int SecondsPerCurrency { get; set; } = 60; // amount per $1 (in the unit below)

        [MaxLength(20)]
        [Column("time_unit")]
        public string TimeUnit { get; set; } = "seconds"; // seconds, minutes, hours, days

        // Security Settings
        [Column("max_message_length")]
        public int MaxMessageLength { get; set; } = 255;

        [Column("cooldown_seconds")]
        public int CooldownSeconds { get; set; } = 0;

        [Column("bad_words_filter")]
        public bool BadWordsFilter { get; set; } = true;

        [Column("require_message")]
        public bool RequireMessage { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }

    [Table("tips_history")]
    public class TipHistory
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("channel_name")]
        public string ChannelName { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        [Column("donor_name")]
        public string DonorName { get; set; } = string.Empty;

        [MaxLength(255)]
        [Column("donor_email")]
        public string? DonorEmail { get; set; }

        [Column("amount")]
        public decimal Amount { get; set; }

        [MaxLength(10)]
        [Column("currency")]
        public string Currency { get; set; } = "USD";

        [MaxLength(500)]
        [Column("message")]
        public string? Message { get; set; }

        [MaxLength(100)]
        [Column("paypal_transaction_id")]
        public string? PayPalTransactionId { get; set; }

        [MaxLength(50)]
        [Column("status")]
        public string Status { get; set; } = "completed"; // pending, completed, refunded

        [Column("time_added")]
        public int TimeAdded { get; set; } = 0; // Seconds added to timer

        [Column("alert_shown")]
        public bool AlertShown { get; set; } = false;

        [Column("donated_at")]
        public DateTime DonatedAt { get; set; } = DateTime.UtcNow;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
