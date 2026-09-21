using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.WheelOfLuck
{
    /// <summary>
    /// Reglas del modo Sorteo.
    ///
    /// <para>Tabla aparte y no dentro de <c>wheels.visual_config</c>: son reglas,
    /// no aspecto, y una rueda de modo Premios no tiene ninguna de estas columnas.</para>
    /// </summary>
    [Table("wheel_raffle_configs")]
    public class WheelRaffleConfig
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("wheel_id")]
        public int WheelId { get; set; }

        [ForeignKey("WheelId")]
        public Wheel? Wheel { get; set; }

        /// <summary>Configurable, y validado contra la lista de comandos reservados.</summary>
        [Required]
        [Column("entry_command")]
        [MaxLength(30)]
        public string EntryCommand { get; set; } = "!djoin";

        /// <summary>Array de "command", "channel_points", "auto_active_chatters", "manual".</summary>
        [Required]
        [Column("entry_methods", TypeName = "jsonb")]
        public string EntryMethods { get; set; } = "[\"command\"]";

        /// <summary>"manual", "timed" o "always_open".</summary>
        [Required]
        [Column("window_mode")]
        [MaxLength(20)]
        public string WindowMode { get; set; } = "manual";

        [Column("window_seconds")]
        public int? WindowSeconds { get; set; }

        /// <summary>0 = inscribirse es gratis.</summary>
        [Column("entry_cost_credits")]
        public int EntryCostCredits { get; set; }

        [Column("max_entries_per_viewer")]
        public int MaxEntriesPerViewer { get; set; } = 1;

        /// <summary>Multiplicadores: watchtime, sub, tier, coins gastados, manual por usuario.</summary>
        [Required]
        [Column("weight_sources", TypeName = "jsonb")]
        public string WeightSources { get; set; } = "{}";

        /// <summary>subs_only, followers_only, min_watchtime_minutes.</summary>
        [Required]
        [Column("requirements", TypeName = "jsonb")]
        public string Requirements { get; set; } = "{}";

        [Column("winners_count")]
        public int WinnersCount { get; set; } = 1;

        /// <summary>"single", "multi" o "remove_and_continue".</summary>
        [Required]
        [Column("draw_mode")]
        [MaxLength(20)]
        public string DrawMode { get; set; } = "single";

        [Column("remove_winner_from_pool")]
        public bool RemoveWinnerFromPool { get; set; } = true;

        [Column("clear_on_stream_end")]
        public bool ClearOnStreamEnd { get; set; }

        // ----------------------------------------------------------------
        // Estado vivo de la ventana (no es configuración)
        // ----------------------------------------------------------------

        /// <summary>Lo que decide el modo <c>manual</c>. <c>always_open</c> lo ignora.</summary>
        [Column("is_open")]
        public bool IsOpen { get; set; }

        [Column("window_opened_at")]
        public DateTime? WindowOpenedAt { get; set; }

        /// <summary>Cuándo se cierra sola la ventana en modo <c>timed</c>.</summary>
        [Column("window_closes_at")]
        public DateTime? WindowClosesAt { get; set; }

        /// <summary>
        /// Si el sorteo acepta inscripciones ahora mismo. Es una propiedad y no una
        /// columna porque depende de la hora: una ventana temporizada se cierra sola
        /// sin que nadie escriba en la base.
        /// </summary>
        [NotMapped]
        public bool AceptaInscripciones => WindowMode switch
        {
            "always_open" => true,
            "timed"       => IsOpen && WindowClosesAt.HasValue && WindowClosesAt.Value > DateTime.UtcNow,
            _             => IsOpen,
        };

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
