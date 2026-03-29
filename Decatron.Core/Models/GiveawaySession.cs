using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("giveaway_sessions")]
    public class GiveawaySession
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("channel_id")]
        [MaxLength(255)]
        public string ChannelId { get; set; } = string.Empty;

        [Column("config_id")]
        public int? ConfigId { get; set; }

        // Información
        [Required]
        [Column("name")]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [Column("prize_name")]
        [MaxLength(500)]
        public string PrizeName { get; set; } = string.Empty;

        [Column("prize_description")]
        public string? PrizeDescription { get; set; }

        // Snapshot de configuración (JSON)
        [Required]
        [Column("config_snapshot", TypeName = "json")]
        public string ConfigSnapshot { get; set; } = "{}";

        // Estado
        [Required]
        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "idle"; // 'idle' | 'active' | 'selecting' | 'completed' | 'cancelled'

        // Tiempos
        [Column("started_at")]
        public DateTime? StartedAt { get; set; }

        [Column("ends_at")]
        public DateTime? EndsAt { get; set; }

        [Column("ended_at")]
        public DateTime? EndedAt { get; set; }

        // Estadísticas
        [Column("total_participants")]
        public int TotalParticipants { get; set; } = 0;

        [Column("total_weight")]
        public decimal TotalWeight { get; set; } = 0;

        // Cancelación
        [Column("cancel_reason")]
        public string? CancelReason { get; set; }

        // Metadata
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
