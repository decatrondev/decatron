using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.LiveTranslation
{
    /// <summary>
    /// Configuración de traducción en vivo de un canal. Una fila por streamer.
    ///
    /// El espectador elige idioma desde la extensión; aquí solo se define qué idiomas
    /// ofrece el canal y con qué voz suena cada uno. La voz va por idioma porque los
    /// catálogos de TTS son por idioma (una voz en inglés no habla portugués).
    /// </summary>
    [Table("live_translation_settings")]
    public class LiveTranslationSettings
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        /// <summary>Dueño del canal (users.id).</summary>
        [Column("user_id")]
        public long UserId { get; set; }

        [Column("enabled")]
        public bool Enabled { get; set; }

        /// <summary>Idioma en que habla el streamer (código Deepgram: es, en, pt…).</summary>
        [Column("source_language")]
        [MaxLength(10)]
        public string SourceLanguage { get; set; } = "es";

        /// <summary>Idiomas destino ofrecidos, separados por coma ("en,pt").</summary>
        [Column("target_languages")]
        [MaxLength(200)]
        public string TargetLanguages { get; set; } = "en";

        /// <summary>Motor de voz: deepgram (Aura-2), fish, polly.</summary>
        [Column("voice_engine")]
        [MaxLength(20)]
        public string VoiceEngine { get; set; } = "deepgram";

        /// <summary>
        /// Voz por idioma en JSON: {"en":"aura-2-thalia-en","pt":"…"}. Vacío = voz por
        /// defecto del motor para ese idioma.
        /// </summary>
        [Column("voices_json")]
        public string VoicesJson { get; set; } = "{}";

        /// <summary>Anunciar en el chat cuando arranca la traducción.</summary>
        [Column("announce_in_chat")]
        public bool AnnounceInChat { get; set; } = true;

        [Column("announce_message")]
        [MaxLength(400)]
        public string? AnnounceMessage { get; set; }

        /// <summary>
        /// Volumen sugerido del audio original mientras suena la traducción (0-100). La
        /// extensión lo usa como valor inicial; el espectador puede cambiarlo.
        /// </summary>
        [Column("background_volume")]
        public int BackgroundVolume { get; set; } = 15;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [NotMapped]
        public IReadOnlyList<string> TargetLanguageList =>
            TargetLanguages.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(l => l.ToLowerInvariant()).Distinct().ToList();
    }
}
