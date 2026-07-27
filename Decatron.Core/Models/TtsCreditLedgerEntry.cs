using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Movimiento de créditos TTS. Append-only: nunca se edita ni se borra.
    /// El saldo es el resultado de estos movimientos, no un número que se toca a mano.
    /// </summary>
    [Table("tts_credit_ledger")]
    public class TtsCreditLedgerEntry
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        /// <summary>consume · grant_monthly · grant_gift · purchase · refund · adjust</summary>
        [Required]
        [MaxLength(20)]
        [Column("type")]
        public string Type { get; set; } = string.Empty;

        /// <summary>Negativo en consumos, positivo en cargas.</summary>
        [Column("credits")]
        public long Credits { get; set; }

        /// <summary>monthly · purchased · none (aciertos de caché)</summary>
        [MaxLength(10)]
        [Column("bucket")]
        public string Bucket { get; set; } = "none";

        /// <summary>speak_chat · event_alerts · tips · timer_alerts · tts_api · admin</summary>
        [MaxLength(30)]
        [Column("feature")]
        public string? Feature { get; set; }

        /// <summary>standard · neural · generative · longform · cache_hit</summary>
        [MaxLength(20)]
        [Column("engine")]
        public string? Engine { get; set; }

        [Column("chars")]
        public int? Chars { get; set; }

        [MaxLength(50)]
        [Column("voice")]
        public string? Voice { get; set; }

        [MaxLength(20)]
        [Column("language")]
        public string? Language { get; set; }

        [MaxLength(20)]
        [Column("gateway")]
        public string? Gateway { get; set; }

        /// <summary>Id de transacción de la pasarela. Único junto a Gateway: evita acreditar dos veces.</summary>
        [MaxLength(120)]
        [Column("external_id")]
        public string? ExternalId { get; set; }

        [Column("granted_by")]
        public long? GrantedBy { get; set; }

        [Column("note")]
        public string? Note { get; set; }
    }
}
