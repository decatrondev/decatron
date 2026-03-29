using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("raffles")]
    public class Raffle
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string ChannelName { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        /// <summary>
        /// Cantidad de ganadores a seleccionar
        /// </summary>
        [Required]
        public int WinnersCount { get; set; } = 1;

        /// <summary>
        /// Estado del sorteo: open, closed, completed, cancelled
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "open";

        /// <summary>
        /// Configuración JSON del sorteo (métodos, requisitos, etc.)
        /// </summary>
        [Column(TypeName = "jsonb")]
        public string ConfigJson { get; set; } = "{}";

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
        /// Fecha de cierre (si fue cerrado)
        /// </summary>
        public DateTime? ClosedAt { get; set; }

        /// <summary>
        /// Fecha de sorteo (cuando se seleccionaron ganadores)
        /// </summary>
        public DateTime? DrawnAt { get; set; }

        /// <summary>
        /// ID del usuario que creó el sorteo
        /// </summary>
        [Required]
        public long CreatedBy { get; set; }

        /// <summary>
        /// Total de participantes únicos
        /// </summary>
        [Required]
        public int TotalParticipants { get; set; } = 0;

        /// <summary>
        /// Total de tickets/entradas en el sorteo
        /// </summary>
        [Required]
        public int TotalTickets { get; set; } = 0;

        // Navigation properties
        [ForeignKey("CreatedBy")]
        public User? CreatedByUser { get; set; }

        public ICollection<RaffleParticipant>? Participants { get; set; }
        public ICollection<RaffleWinner>? Winners { get; set; }
    }
}
