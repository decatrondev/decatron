using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.LiveTranslation
{
    /// <summary>
    /// Una sesión de ingesta: desde que la app de escritorio conecta hasta que se corta.
    /// Es el historial que ve el streamer (minutos, idiomas, oyentes, créditos) y lo que
    /// usa el admin para ver costos reales por proveedor.
    /// </summary>
    [Table("live_translation_sessions")]
    public class LiveTranslationSession
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        [Column("device_id")]
        public long? DeviceId { get; set; }

        [Column("started_at")]
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;

        [Column("ended_at")]
        public DateTime? EndedAt { get; set; }

        /// <summary>Segundos de voz detectada (lo que se cobró de STT), no de conexión.</summary>
        [Column("speech_seconds")]
        public double SpeechSeconds { get; set; }

        [Column("segments")]
        public int Segments { get; set; }

        /// <summary>Caracteres generados por idioma: {"en":8420,"pt":7910}.</summary>
        [Column("chars_by_language_json")]
        public string CharsByLanguageJson { get; set; } = "{}";

        [Column("peak_listeners")]
        public int PeakListeners { get; set; }

        [Column("credits_used")]
        public long CreditsUsed { get; set; }

        /// <summary>disconnected · stopped_by_user · no_credits · offline · error · admin</summary>
        [Column("end_reason")]
        [MaxLength(30)]
        public string? EndReason { get; set; }
    }
}
