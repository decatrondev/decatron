using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Configuración global de Sound Alerts para un canal
    /// </summary>
    [Table("sound_alert_configs")]
    public class SoundAlertConfig
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [Column("username")]
        [MaxLength(100)]
        public string Username { get; set; } = "";

        /// <summary>
        /// Volumen global para todas las alertas (0-100)
        /// </summary>
        [Column("global_volume")]
        public int GlobalVolume { get; set; } = 70;

        /// <summary>
        /// Habilitar/deshabilitar sistema completo de sound alerts
        /// </summary>
        [Column("global_enabled")]
        public bool GlobalEnabled { get; set; } = true;

        /// <summary>
        /// Duración de la alerta en segundos (3-30)
        /// </summary>
        [Column("duration")]
        public int Duration { get; set; } = 10;

        /// <summary>
        /// Configuración de líneas de texto (JSON)
        /// [{ text, fontSize, fontWeight, enabled }]
        /// </summary>
        [Column("text_lines", TypeName = "jsonb")]
        public string TextLines { get; set; } = "[]";

        /// <summary>
        /// Configuración de estilos (JSON)
        /// { fontFamily, fontSize, textColor, textShadow, backgroundType, etc }
        /// </summary>
        [Column("styles", TypeName = "jsonb")]
        public string Styles { get; set; } = "{}";

        /// <summary>
        /// Configuración de layout (JSON)
        /// { media: {x, y, width, height}, text: {x, y, align} }
        /// </summary>
        [Column("layout", TypeName = "jsonb")]
        public string Layout { get; set; } = "{}";

        /// <summary>
        /// Tipo de animación: none, fade, slide, bounce, zoom
        /// </summary>
        [Column("animation_type")]
        [MaxLength(50)]
        public string AnimationType { get; set; } = "fade";

        /// <summary>
        /// Velocidad de animación: slow, normal, fast
        /// </summary>
        [Column("animation_speed")]
        [MaxLength(50)]
        public string AnimationSpeed { get; set; } = "normal";

        /// <summary>
        /// Habilitar contorno/outline en el texto
        /// </summary>
        [Column("text_outline_enabled")]
        public bool TextOutlineEnabled { get; set; } = false;

        /// <summary>
        /// Color del contorno del texto (hex)
        /// </summary>
        [Column("text_outline_color")]
        [MaxLength(50)]
        public string TextOutlineColor { get; set; } = "#000000";

        /// <summary>
        /// Grosor del contorno del texto en píxeles
        /// </summary>
        [Column("text_outline_width")]
        public int TextOutlineWidth { get; set; } = 2;

        /// <summary>
        /// Cooldown global entre alertas en milisegundos
        /// </summary>
        [Column("cooldown_ms")]
        public int CooldownMs { get; set; } = 500;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Archivo de sonido/video asociado a una recompensa de Channel Points
    /// </summary>
    [Table("sound_alert_files")]
    public class SoundAlertFile
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [Column("username")]
        [MaxLength(100)]
        public string Username { get; set; } = "";

        /// <summary>
        /// ID de la recompensa de Twitch
        /// </summary>
        [Required]
        [Column("reward_id")]
        [MaxLength(100)]
        public string RewardId { get; set; } = "";

        /// <summary>
        /// Título de la recompensa (guardado para referencia)
        /// </summary>
        [Column("reward_title")]
        [MaxLength(200)]
        public string RewardTitle { get; set; } = "";

        /// <summary>
        /// Tipo de archivo: sound, video
        /// </summary>
        [Required]
        [Column("file_type")]
        [MaxLength(20)]
        public string FileType { get; set; } = "sound";

        /// <summary>
        /// Ruta al archivo en el servidor
        /// </summary>
        [Required]
        [Column("file_path")]
        [MaxLength(500)]
        public string FilePath { get; set; } = "";

        /// <summary>
        /// Nombre original del archivo
        /// </summary>
        [Required]
        [Column("file_name")]
        [MaxLength(255)]
        public string FileName { get; set; } = "";

        /// <summary>
        /// Ruta a la imagen asociada (opcional, principalmente para archivos de audio)
        /// </summary>
        [Column("image_path")]
        [MaxLength(500)]
        public string? ImagePath { get; set; }

        /// <summary>
        /// Nombre de la imagen asociada
        /// </summary>
        [Column("image_name")]
        [MaxLength(255)]
        public string? ImageName { get; set; }

        /// <summary>
        /// Tamaño del archivo en bytes
        /// </summary>
        [Column("file_size")]
        public long FileSize { get; set; }

        /// <summary>
        /// Duración del archivo en segundos
        /// </summary>
        [Column("duration_seconds")]
        public decimal DurationSeconds { get; set; }

        /// <summary>
        /// Volumen específico para este archivo (0-100)
        /// Si es null, usa global_volume
        /// </summary>
        [Column("volume")]
        public int? Volume { get; set; }

        /// <summary>
        /// Indica si este es un archivo del sistema (predeterminado) o subido por el usuario
        /// </summary>
        [Column("is_system_file")]
        public bool IsSystemFile { get; set; } = false;

        /// <summary>
        /// Habilitar/deshabilitar esta alerta específica
        /// </summary>
        [Column("enabled")]
        public bool Enabled { get; set; } = true;

        /// <summary>
        /// Contador de veces que se ha reproducido
        /// </summary>
        [Column("play_count")]
        public int PlayCount { get; set; } = 0;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Historial de reproducciones de Sound Alerts
    /// </summary>
    [Table("sound_alert_history")]
    public class SoundAlertHistory
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        [Required]
        [Column("reward_id")]
        [MaxLength(100)]
        public string RewardId { get; set; } = "";

        [Required]
        [Column("reward_title")]
        [MaxLength(200)]
        public string RewardTitle { get; set; } = "";

        [Column("file_path")]
        [MaxLength(500)]
        public string? FilePath { get; set; }

        [Required]
        [Column("redeemed_by")]
        [MaxLength(100)]
        public string RedeemedBy { get; set; } = "";

        [Column("redeemed_by_id")]
        [MaxLength(100)]
        public string? RedeemedById { get; set; }

        [Column("redeemed_at")]
        public DateTime RedeemedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Si la alerta se reprodujo exitosamente
        /// </summary>
        [Column("played_successfully")]
        public bool PlayedSuccessfully { get; set; } = true;

        [Column("error_message")]
        [MaxLength(500)]
        public string? ErrorMessage { get; set; }
    }
}
