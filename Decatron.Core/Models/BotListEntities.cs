using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Bot conocido de una plataforma (Nightbot, StreamElements...). Lo mantiene el owner y
    /// aplica a todos los canales salvo que el streamer lo apague o cambie sus efectos.
    /// </summary>
    [Table("bot_catalog")]
    public class BotCatalogEntry
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [Column("platform")]
        [MaxLength(10)]
        public string Platform { get; set; } = "twitch";

        /// <summary>Usuario en minúsculas (en Kick, con "_" en lugar de "-")</summary>
        [Required]
        [Column("username")]
        [MaxLength(100)]
        public string Username { get; set; } = "";

        [Required]
        [Column("display_name")]
        [MaxLength(100)]
        public string DisplayName { get; set; } = "";

        /// <summary>competencia | moderacion | musica | alertas | utilidad | propio</summary>
        [Required]
        [Column("category")]
        [MaxLength(20)]
        public string Category { get; set; } = "utilidad";

        [Column("notes")]
        [MaxLength(300)]
        public string? Notes { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }

    /// <summary>
    /// Lo que un canal cambia sobre el catálogo (apagar un bot, ajustar efectos) o un bot que
    /// agregó por su cuenta. Un efecto en null usa el valor por defecto de la categoría.
    /// </summary>
    [Table("channel_bot_entries")]
    public class ChannelBotEntry
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        [Required]
        [Column("platform")]
        [MaxLength(10)]
        public string Platform { get; set; } = "twitch";

        [Required]
        [Column("username")]
        [MaxLength(100)]
        public string Username { get; set; } = "";

        /// <summary>Solo los bots propios del canal traen nombre y categoría; los del catálogo los toman de allá</summary>
        [Column("display_name")]
        [MaxLength(100)]
        public string? DisplayName { get; set; }

        [Column("category")]
        [MaxLength(20)]
        public string? Category { get; set; }

        [Column("is_custom")]
        public bool IsCustom { get; set; }

        [Column("enabled")]
        public bool Enabled { get; set; } = true;

        [Column("hide_overlay")]
        public bool? HideOverlay { get; set; }

        [Column("skip_counting")]
        public bool? SkipCounting { get; set; }

        [Column("skip_commands")]
        public bool? SkipCommands { get; set; }

        [Column("skip_moderation")]
        public bool? SkipModeration { get; set; }

        [Column("skip_speech")]
        public bool? SkipSpeech { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}
