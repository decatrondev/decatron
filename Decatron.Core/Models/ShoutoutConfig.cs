using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Configuración del overlay de shoutout
    /// </summary>
    [Table("shoutout_configs")]
    public class ShoutoutConfig
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [Column("username")]
        [MaxLength(100)]
        public string Username { get; set; } = "";

        /// <summary>
        /// Duración del overlay en segundos (5-30)
        /// </summary>
        [Column("duration")]
        public int Duration { get; set; } = 10;

        /// <summary>
        /// Cooldown entre shoutouts al mismo usuario en segundos (10-300)
        /// </summary>
        [Column("cooldown")]
        public int Cooldown { get; set; } = 30;

        /// <summary>
        /// Mostrar timer de countdown en el overlay (para debugging)
        /// </summary>
        [Column("show_debug_timer")]
        public bool ShowDebugTimer { get; set; } = false;

        /// <summary>
        /// Texto del shoutout (legacy - ahora se usa TextLines)
        /// </summary>
        [Column("shoutout_text")]
        [MaxLength(500)]
        public string? ShoutoutText { get; set; }

        /// <summary>
        /// Configuración de líneas de texto (JSON)
        /// </summary>
        [Column("text_lines", TypeName = "jsonb")]
        public string TextLines { get; set; } = "[]";

        /// <summary>
        /// Configuración de estilos (JSON)
        /// </summary>
        [Column("styles", TypeName = "jsonb")]
        public string Styles { get; set; } = "{}";

        /// <summary>
        /// Configuración de layout (JSON)
        /// </summary>
        [Column("layout", TypeName = "jsonb")]
        public string Layout { get; set; } = "{}";

        /// <summary>
        /// Tipo de animación: none, slide, bounce, fade, zoom, rotate
        /// </summary>
        [Column("animation_type")]
        [MaxLength(50)]
        public string AnimationType { get; set; } = "none";

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
        /// Habilitar borde alrededor del contenedor del overlay
        /// </summary>
        [Column("container_border_enabled")]
        public bool ContainerBorderEnabled { get; set; } = false;

        /// <summary>
        /// Color del borde del contenedor (hex)
        /// </summary>
        [Column("container_border_color")]
        [MaxLength(50)]
        public string ContainerBorderColor { get; set; } = "#ffffff";

        /// <summary>
        /// Grosor del borde del contenedor en píxeles
        /// </summary>
        [Column("container_border_width")]
        public int ContainerBorderWidth { get; set; } = 3;

        /// <summary>
        /// Lista de usuarios que NO pueden recibir shoutouts (JSON array)
        /// </summary>
        [Column("blacklist", TypeName = "jsonb")]
        public string Blacklist { get; set; } = "[]";

        /// <summary>
        /// Lista de usuarios que PUEDEN ejecutar el comando !so (JSON array)
        /// Si está vacío, todos los moderadores pueden usar el comando
        /// </summary>
        [Column("whitelist", TypeName = "jsonb")]
        public string Whitelist { get; set; } = "[]";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Historial de shoutouts ejecutados
    /// </summary>
    [Table("shoutout_history")]
    public class ShoutoutHistory
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        [Required]
        [Column("target_user")]
        [MaxLength(100)]
        public string TargetUser { get; set; } = "";

        [Column("executed_by")]
        [MaxLength(100)]
        public string ExecutedBy { get; set; } = "";

        [Column("clip_url")]
        [MaxLength(500)]
        public string? ClipUrl { get; set; }

        [Column("clip_id")]
        [MaxLength(100)]
        public string? ClipId { get; set; }

        [Column("clip_local_path")]
        [MaxLength(500)]
        public string? ClipLocalPath { get; set; }

        [Column("profile_image_url")]
        [MaxLength(500)]
        public string? ProfileImageUrl { get; set; }

        [Column("game_name")]
        [MaxLength(200)]
        public string? GameName { get; set; }

        [Column("executed_at")]
        public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;
    }
}
