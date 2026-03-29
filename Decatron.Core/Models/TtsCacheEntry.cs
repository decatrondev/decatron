using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("tts_cache_entries")]
    public class TtsCacheEntry
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        /// <summary>SHA-256 de "voice:engine:language:textNormalizado"</summary>
        [Required]
        [MaxLength(64)]
        [Column("hash")]
        public string Hash { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        [Column("voice_id")]
        public string VoiceId { get; set; } = string.Empty;

        /// <summary>standard | neural</summary>
        [Required]
        [MaxLength(20)]
        [Column("engine")]
        public string Engine { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        [Column("language_code")]
        public string LanguageCode { get; set; } = string.Empty;

        [Required]
        [Column("text_content")]
        public string TextContent { get; set; } = string.Empty;

        /// <summary>Ruta absoluta en disco al archivo .mp3</summary>
        [Required]
        [MaxLength(500)]
        [Column("file_path")]
        public string FilePath { get; set; } = string.Empty;

        [Column("file_size_bytes")]
        public long FileSizeBytes { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("last_used_at")]
        public DateTime LastUsedAt { get; set; } = DateTime.UtcNow;

        [Column("usage_count")]
        public int UsageCount { get; set; } = 1;
    }
}
