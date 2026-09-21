using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.WheelOfLuck
{
    /// <summary>
    /// Un gajo. En modo Premios lleva el payload del premio; en modo Sorteo
    /// representa a un participante.
    /// </summary>
    [Table("wheel_segments")]
    public class WheelSegment
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("wheel_id")]
        public int WheelId { get; set; }

        [ForeignKey("WheelId")]
        public Wheel? Wheel { get; set; }

        [Required]
        [Column("label")]
        [MaxLength(60)]
        public string Label { get; set; } = string.Empty;

        /// <summary>
        /// Peso relativo. El % efectivo lo calcula la app normalizando sobre los
        /// gajos habilitados y con stock, no se guarda.
        /// </summary>
        [Column("weight")]
        public decimal Weight { get; set; } = 1m;

        /// <summary>Hex #RRGGBB o #RRGGBBAA. NULL usa la paleta de visual_config.</summary>
        [Column("color")]
        [MaxLength(9)]
        public string? Color { get; set; }

        /// <summary>Emoji o clave de ícono.</summary>
        [Column("icon")]
        [MaxLength(100)]
        public string? Icon { get; set; }

        /// <summary>El plan lo llama <c>order</c>; en Postgres esa palabra es reservada.</summary>
        [Column("display_order")]
        public int DisplayOrder { get; set; }

        /// <summary>Un solo premio por gajo. Ver <see cref="WheelPrizeTypes"/>.</summary>
        [Required]
        [Column("prize", TypeName = "jsonb")]
        public string Prize { get; set; } = "{\"type\":\"nothing\",\"params\":{}}";

        /// <summary>NULL = ilimitado.</summary>
        [Column("stock_total")]
        public int? StockTotal { get; set; }

        [Column("stock_per_viewer")]
        public int? StockPerViewer { get; set; }

        /// <summary>"stream", "day" o "ever".</summary>
        [Required]
        [Column("stock_window")]
        [MaxLength(20)]
        public string StockWindow { get; set; } = "ever";

        /// <summary>Contador vivo de la ventana actual. NULL si el stock es ilimitado.</summary>
        [Column("stock_remaining")]
        public int? StockRemaining { get; set; }

        /// <summary>
        /// Cuándo se abrió la ventana de stock vigente. Con <c>stock_window = "ever"</c>
        /// queda en null: esa ventana no vence nunca.
        ///
        /// <para>Es lo que hace posibles las otras dos. "3 por día" necesita saber
        /// contra qué día comparar, y el stock por espectador necesita saber desde qué
        /// momento mirar su historial de giros.</para>
        /// </summary>
        [Column("stock_reset_at")]
        public DateTime? StockResetAt { get; set; }

        /// <summary>Apaga el gajo sin borrarlo, para no romper el historial que lo apunta.</summary>
        [Column("is_enabled")]
        public bool IsEnabled { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Un gajo entra en el sorteo del giro solo si está activo y le queda stock.
        ///
        /// <para>Ojo: esto NO mira la ventana ni el stock por espectador. El que decide
        /// de verdad es <c>WheelService</c>, que primero reinicia las ventanas vencidas
        /// y después cuenta lo que ya se llevó cada uno.</para>
        /// </summary>
        [NotMapped]
        public bool PuedeSalir => IsEnabled && Weight > 0 && (StockTotal == null || StockRemaining > 0);
    }

    /// <summary>Ventanas del stock de un gajo.</summary>
    public static class WheelStockWindows
    {
        /// <summary>No vence: el stock se agota una vez y no vuelve.</summary>
        public const string Ever   = "ever";
        /// <summary>Se reinicia con <c>stream.online</c>.</summary>
        public const string Stream = "stream";
        /// <summary>Se reinicia al cambiar el día UTC.</summary>
        public const string Day    = "day";

        public static bool EsValida(string? v) => v is Ever or Stream or Day;
    }

    /// <summary>
    /// Catálogo de tipos de premio. Es modular: agregar uno nuevo es una constante
    /// más acá, un widget en el editor y un handler de entrega. No toca el resto.
    /// </summary>
    public static class WheelPrizeTypes
    {
        public const string Coins         = "coins";
        public const string FreeSpin      = "free_spin";
        public const string GachaPull     = "gacha_pull";
        public const string TimerTime     = "timer_time";
        public const string Timeout       = "timeout";
        public const string SoundAlert    = "sound_alert";
        public const string ManualMessage = "manual_message";
        public const string Nothing       = "nothing";
    }
}
