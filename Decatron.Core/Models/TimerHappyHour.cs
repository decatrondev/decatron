using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    public static class HappyHourModes
    {
        public const string Schedule = "schedule";
        public const string Progress = "progress";
        /// <summary>Activa mientras al timer le quede el tiempo de StartAfterSeconds o menos (sube y baja con las donaciones).</summary>
        public const string Remaining = "remaining";
    }

    /// <summary>Cómo termina una Happy Hour por tiempo restante.</summary>
    public static class RemainingEndModes
    {
        /// <summary>Se apaga en cuanto el tiempo restante sube sobre el umbral (lo de siempre).</summary>
        public const string Above = "above";
        /// <summary>Se mantiene activa hasta que el tiempo restante suba a EndAfterSeconds (mayor que el umbral).</summary>
        public const string RiseTo = "rise_to";
        /// <summary>Se apaga cuando el tiempo restante baja a EndAfterSeconds (menor que el umbral).</summary>
        public const string FallTo = "fall_to";
        /// <summary>Dura DurationSeconds de tiempo del timer desde que se activó.</summary>
        public const string Duration = "duration";

        public static bool IsValid(string? m) => m is Above or RiseTo or FallTo or Duration;
    }

    [Table("timer_happyhour")]
    public class TimerHappyHour
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("name")]
        public string Name { get; set; } = string.Empty;

        [MaxLength(255)]
        [Column("description")]
        public string? Description { get; set; }

        [Required]
        [Column("start_time")]
        public TimeSpan StartTime { get; set; }

        [Required]
        [Column("end_time")]
        public TimeSpan EndTime { get; set; }

        [Required]
        [Column("multiplier")]
        public decimal Multiplier { get; set; } = 2.0m;

        [Required]
        [Column("days_of_week", TypeName = "jsonb")]
        public string DaysOfWeek { get; set; } = "[true,true,true,true,true,true,true]";

        /// <summary>A qué eventos se aplica (JSON: ["sub","bits",...]). Null = a todos.</summary>
        [Column("event_types", TypeName = "jsonb")]
        public string? EventTypes { get; set; }

        /// <summary>"schedule" = por horario (lo de siempre); "progress" = por tiempo transcurrido del timer; "remaining" = por tiempo restante (usa StartAfterSeconds como umbral).</summary>
        [Required]
        [MaxLength(16)]
        [Column("mode")]
        public string Mode { get; set; } = HappyHourModes.Schedule;

        /// <summary>Modo progreso: segundos de timer corriendo en que se activa.</summary>
        [Column("start_after_seconds")]
        public int? StartAfterSeconds { get; set; }

        /// <summary>Modo progreso: segundo umbral en que se apaga (alternativa a la duración).</summary>
        [Column("end_after_seconds")]
        public int? EndAfterSeconds { get; set; }

        /// <summary>Modo progreso: cuánto dura la ventana (alternativa al segundo umbral).</summary>
        [Column("duration_seconds")]
        public int? DurationSeconds { get; set; }

        /// <summary>Modo progreso: null = una sola vez; con valor, la ventana se repite cada tanto.</summary>
        [Column("repeat_every_seconds")]
        public int? RepeatEverySeconds { get; set; }

        /// <summary>Solo modo "remaining": cómo termina (ver <see cref="RemainingEndModes"/>).</summary>
        [Required]
        [MaxLength(16)]
        [Column("end_mode")]
        public string EndMode { get; set; } = RemainingEndModes.Above;

        /// <summary>Estado de rise_to y duration: null = esperando el umbral; >= 0 = activa desde ese tiempo del timer; -1 = ya cumplió su duración.</summary>
        [Column("latched_elapsed_seconds")]
        public long? LatchedElapsedSeconds { get; set; }

        [Required]
        [Column("enabled")]
        public bool Enabled { get; set; } = true;

        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}
