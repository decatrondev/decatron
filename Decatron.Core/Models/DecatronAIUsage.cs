using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("decatron_ai_usage")]
    public class DecatronAIUsage
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("channel_name")]
        [Required]
        [MaxLength(100)]
        public string ChannelName { get; set; } = string.Empty;

        [Column("username")]
        [Required]
        [MaxLength(100)]
        public string Username { get; set; } = string.Empty;

        [Column("prompt")]
        [Required]
        public string Prompt { get; set; } = string.Empty;

        [Column("response")]
        public string? Response { get; set; }

        [Column("tokens_used")]
        public int TokensUsed { get; set; } = 0;

        [Column("response_time_ms")]
        public int ResponseTimeMs { get; set; } = 0;

        [Column("success")]
        public bool Success { get; set; } = true;

        [Column("error_message")]
        public string? ErrorMessage { get; set; }

        [Column("used_at")]
        public DateTime UsedAt { get; set; } = DateTime.UtcNow;
    }
}
