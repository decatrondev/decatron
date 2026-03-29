using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("timer_media_files")]
    public class TimerMediaFile
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("channel_name")]
        public string ChannelName { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        [Column("file_type")]
        public string FileType { get; set; } = string.Empty; // sound, image, gif, video

        [Required]
        [MaxLength(500)]
        [Column("file_path")]
        public string FilePath { get; set; } = string.Empty;

        /// <summary>
        /// Nombre original del archivo que subió el usuario (ej: mi_video.mp4)
        /// </summary>
        [Required]
        [MaxLength(255)]
        [Column("original_file_name")]
        public string OriginalFileName { get; set; } = string.Empty;

        /// <summary>
        /// Nombre del archivo almacenado en disco (puede incluir UUID si hay duplicados)
        /// Ej: mi_video.mp4 o mi_video-49993212.mp4
        /// </summary>
        [Required]
        [MaxLength(255)]
        [Column("file_name")]
        public string FileName { get; set; } = string.Empty;

        /// <summary>
        /// Categoría/carpeta donde está el archivo (backgrounds, indicators, alerts/sounds, etc.)
        /// </summary>
        [MaxLength(100)]
        [Column("category")]
        public string? Category { get; set; }

        /// <summary>
        /// Ruta a la miniatura/thumbnail (para videos e imágenes grandes)
        /// </summary>
        [MaxLength(500)]
        [Column("thumbnail_path")]
        public string? ThumbnailPath { get; set; }

        /// <summary>
        /// Contador de cuántas veces se usa este archivo en configuraciones
        /// Para evitar eliminar archivos que están en uso
        /// </summary>
        [Column("usage_count")]
        public int UsageCount { get; set; } = 0;

        [Required]
        [Column("file_size")]
        public long FileSize { get; set; } // bytes

        [Column("duration_seconds")]
        public double? DurationSeconds { get; set; } // para audio/video

        [Required]
        [Column("uploaded_at")]
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }
    }
}
