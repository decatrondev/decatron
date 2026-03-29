using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("timers")]
    public class Timer
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string ChannelName { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; }

        [Required]
        [MaxLength(500)]
        public string Message { get; set; }

        /// <summary>
        /// Intervalo en minutos. Mínimo 5 minutos (anti-spam)
        /// </summary>
        [Required]
        public int IntervalMinutes { get; set; } = 5;

        /// <summary>
        /// Intervalo en cantidad de mensajes. Mínimo 5 mensajes (anti-spam)
        /// </summary>
        [Required]
        public int IntervalMessages { get; set; } = 5;

        /// <summary>
        /// Categoría del stream donde se ejecuta el timer (opcional)
        /// Si es null/vacío, se ejecuta en cualquier categoría
        /// </summary>
        [MaxLength(255)]
        public string? CategoryName { get; set; }

        /// <summary>
        /// Cuándo enviar el timer: online, offline, both
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string StreamStatus { get; set; } = "online";

        /// <summary>
        /// Prioridad del timer (menor número = mayor prioridad)
        /// </summary>
        [Required]
        public int Priority { get; set; } = 1;

        /// <summary>
        /// Timer activo o pausado
        /// </summary>
        [Required]
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Fecha de creación
        /// </summary>
        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Última modificación
        /// </summary>
        [Required]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// ID del usuario que creó el timer
        /// </summary>
        [Required]
        public long CreatedBy { get; set; }

        /// <summary>
        /// Última vez que se ejecutó el timer
        /// </summary>
        public DateTime? LastExecutedAt { get; set; }

        /// <summary>
        /// Cantidad de veces que se ha ejecutado
        /// </summary>
        [Required]
        public int ExecutionCount { get; set; } = 0;

        /// <summary>
        /// Contador de mensajes desde la última ejecución de este timer específico
        /// </summary>
        [Required]
        public int MessagesSinceLastExecution { get; set; } = 0;

        // Navigation property
        [ForeignKey("CreatedBy")]
        public User CreatedByUser { get; set; }
    }
}
