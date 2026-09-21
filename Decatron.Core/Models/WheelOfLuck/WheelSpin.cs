using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.WheelOfLuck
{
    /// <summary>
    /// Una tirada. El historial nunca se borra: pasada la ventana del tier solo
    /// deja de mostrarse en el panel, y las métricas lo siguen usando todo.
    ///
    /// <para>Por eso <see cref="ResultSegmentId"/> se anula en vez de arrastrar el
    /// giro cuando se borra un gajo, y el premio real queda copiado en
    /// <see cref="ResultPrize"/>: es una foto del momento, no una referencia.</para>
    /// </summary>
    [Table("wheel_spins")]
    public class WheelSpin
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("wheel_id")]
        public int WheelId { get; set; }

        [ForeignKey("WheelId")]
        public Wheel? Wheel { get; set; }

        /// <summary>Copia del modo al momento del giro.</summary>
        [Required]
        [Column("mode")]
        [MaxLength(10)]
        public string Mode { get; set; } = WheelModes.Prizes;

        [Column("spinner_user_id")]
        public long? SpinnerUserId { get; set; }

        [Column("spinner_login")]
        [MaxLength(100)]
        public string? SpinnerLogin { get; set; }

        /// <summary>Ver <see cref="WheelSpinTriggers"/>. El plan lo llama <c>trigger</c>, palabra reservada en Postgres.</summary>
        [Required]
        [Column("trigger_source")]
        [MaxLength(20)]
        public string TriggerSource { get; set; } = WheelSpinTriggers.Panel;

        [Column("credits_spent")]
        public int CreditsSpent { get; set; }

        [Column("result_segment_id")]
        public int? ResultSegmentId { get; set; }

        [ForeignKey("ResultSegmentId")]
        public WheelSegment? ResultSegment { get; set; }

        /// <summary>Snapshot del premio entregado.</summary>
        [Column("result_prize", TypeName = "jsonb")]
        public string? ResultPrize { get; set; }

        /// <summary>"delivered", "pending" o "failed".</summary>
        [Required]
        [Column("delivery_status")]
        [MaxLength(20)]
        public string DeliveryStatus { get; set; } = "delivered";

        /// <summary>Modo Sorteo: ganador o ganadores.</summary>
        [Column("raffle_winner", TypeName = "jsonb")]
        public string? RaffleWinner { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>Qué disparó el giro.</summary>
    public static class WheelSpinTriggers
    {
        public const string Command    = "command";
        public const string Panel      = "panel";
        /// <summary>El aporte alcanzó el precio y la rueda giró sola.</summary>
        public const string Auto       = "auto";
        public const string RaffleDraw = "raffle_draw";
    }
}
