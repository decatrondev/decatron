using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("giveaway_winners")]
    public class GiveawayWinner
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("session_id")]
        public int SessionId { get; set; }

        [Required]
        [Column("participant_id")]
        public int ParticipantId { get; set; }

        // Posición
        [Column("position")]
        public int Position { get; set; }

        [Column("is_backup")]
        public bool IsBackup { get; set; } = false;

        // Selección
        [Column("selected_at")]
        public DateTime SelectedAt { get; set; } = DateTime.UtcNow;

        // Respuesta
        [Column("has_responded")]
        public bool HasResponded { get; set; } = false;

        [Column("responded_at")]
        public DateTime? RespondedAt { get; set; }

        [Column("response_message")]
        [MaxLength(500)]
        public string? ResponseMessage { get; set; }

        // Timeout
        [Column("timeout_processed")]
        public bool TimeoutProcessed { get; set; } = false;

        // Promoción (para backup winners)
        [Column("promoted_at")]
        public DateTime? PromotedAt { get; set; }

        // Descalificación
        [Column("was_disqualified")]
        public bool WasDisqualified { get; set; } = false;

        [Column("disqualification_reason")]
        public string? DisqualificationReason { get; set; }

        [Column("disqualified_at")]
        public DateTime? DisqualifiedAt { get; set; }
    }
}
