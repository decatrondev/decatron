using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Mapea "esta recompensa de este canal dispara este archivo" — separado del
    /// archivo en sí (que ahora vive en la galería compartida, <see cref="TimerMediaFile"/>)
    /// para que un mismo archivo pueda ser reutilizable en vez de que cada
    /// recompensa sea dueña exclusiva de su propio archivo, como pasaba antes
    /// con <see cref="SoundAlertFile"/>. Reemplaza a ese modelo — ver
    /// .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md, plan de unificación de
    /// galería de medios (8 ago 2026).
    ///
    /// Exactamente uno de <see cref="MediaFileId"/>/<see cref="SystemFilePath"/>
    /// va lleno por fila: el primero para archivos subidos por el streamer
    /// (están en la galería compartida), el segundo para recompensas asignadas
    /// a un archivo de sistema (que no son filas de BD, son un escaneo del
    /// filesystem — ver SoundAlertsController.GetSystemFiles).
    /// </summary>
    [Table("sound_alert_reward_files")]
    public class SoundAlertRewardFile
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("reward_id")]
        public string RewardId { get; set; } = "";

        [MaxLength(200)]
        [Column("reward_title")]
        public string RewardTitle { get; set; } = "";

        [Column("media_file_id")]
        public int? MediaFileId { get; set; }

        [ForeignKey("MediaFileId")]
        public TimerMediaFile? MediaFile { get; set; }

        [MaxLength(500)]
        [Column("system_file_path")]
        public string? SystemFilePath { get; set; }

        [Column("volume")]
        public int? Volume { get; set; }

        [Column("enabled")]
        public bool Enabled { get; set; } = true;

        [MaxLength(500)]
        [Column("image_path")]
        public string? ImagePath { get; set; }

        [MaxLength(255)]
        [Column("image_name")]
        public string? ImageName { get; set; }

        [Column("show_image")]
        public bool ShowImage { get; set; } = true;

        [MaxLength(1000)]
        [Column("image_url")]
        public string? ImageUrl { get; set; }

        [MaxLength(20)]
        [Column("image_source")]
        public string ImageSource { get; set; } = "upload";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
