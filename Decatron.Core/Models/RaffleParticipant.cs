using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("raffle_participants")]
    public class RaffleParticipant
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int RaffleId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Username { get; set; }

        /// <summary>
        /// ID de Twitch del usuario (si está disponible)
        /// </summary>
        public long? TwitchUserId { get; set; }

        /// <summary>
        /// Cantidad de tickets que tiene este participante
        /// </summary>
        [Required]
        public int Tickets { get; set; } = 1;

        /// <summary>
        /// Método por el cual entró: command, automatic, bits, subscription, channelpoints, watchtime
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string EntryMethod { get; set; } = "command";

        /// <summary>
        /// Metadata adicional (bits donados, tier de sub, etc.)
        /// </summary>
        [Column(TypeName = "jsonb")]
        public string? MetadataJson { get; set; }

        /// <summary>
        /// Fecha en que se unió al sorteo
        /// </summary>
        [Required]
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Si fue descalificado (por no cumplir requisitos posteriores)
        /// </summary>
        [Required]
        public bool IsDisqualified { get; set; } = false;

        /// <summary>
        /// Razón de descalificación
        /// </summary>
        [MaxLength(255)]
        public string? DisqualificationReason { get; set; }

        // Navigation property
        [ForeignKey("RaffleId")]
        public Raffle Raffle { get; set; }
    }
}
