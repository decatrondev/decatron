using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("raffle_winners")]
    public class RaffleWinner
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int RaffleId { get; set; }

        [Required]
        public int ParticipantId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Username { get; set; }

        /// <summary>
        /// Posición del ganador (1 = primer lugar, 2 = segundo, etc.)
        /// </summary>
        [Required]
        public int Position { get; set; }

        /// <summary>
        /// Fecha en que ganó
        /// </summary>
        [Required]
        public DateTime WonAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Si el ganador confirmó/aceptó el premio
        /// </summary>
        [Required]
        public bool HasConfirmed { get; set; } = false;

        /// <summary>
        /// Fecha de confirmación
        /// </summary>
        public DateTime? ConfirmedAt { get; set; }

        /// <summary>
        /// Si se hizo re-roll y este ganador fue reemplazado
        /// </summary>
        [Required]
        public bool WasRerolled { get; set; } = false;

        /// <summary>
        /// Razón del re-roll (no presente, no respondió, etc.)
        /// </summary>
        [MaxLength(255)]
        public string? RerollReason { get; set; }

        // Navigation properties
        [ForeignKey("RaffleId")]
        public Raffle Raffle { get; set; }

        [ForeignKey("ParticipantId")]
        public RaffleParticipant Participant { get; set; }
    }
}
