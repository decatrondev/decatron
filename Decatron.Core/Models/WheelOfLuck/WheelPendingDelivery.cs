using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.WheelOfLuck
{
    /// <summary>
    /// Premio que el bot no puede cumplir solo (un <c>manual_message</c>, por
    /// ejemplo): queda en la bandeja para que el streamer lo resuelva a mano.
    /// </summary>
    [Table("wheel_pending_deliveries")]
    public class WheelPendingDelivery
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("wheel_id")]
        public int WheelId { get; set; }

        [ForeignKey("WheelId")]
        public Wheel? Wheel { get; set; }

        [Column("spin_id")]
        public long SpinId { get; set; }

        [ForeignKey("SpinId")]
        public WheelSpin? Spin { get; set; }

        [Column("viewer_user_id")]
        public long? ViewerUserId { get; set; }

        [Required]
        [Column("viewer_login")]
        [MaxLength(100)]
        public string ViewerLogin { get; set; } = string.Empty;

        [Required]
        [Column("prize", TypeName = "jsonb")]
        public string Prize { get; set; } = "{}";

        /// <summary>"pending", "done" o "cancelled".</summary>
        [Required]
        [Column("status")]
        [MaxLength(20)]
        public string Status { get; set; } = "pending";

        [Column("resolved_by")]
        public long? ResolvedBy { get; set; }

        [Column("resolved_at")]
        public DateTime? ResolvedAt { get; set; }

        /// <summary>
        /// Por qué el bot no pudo entregarlo. Lo escribe el bot; el streamer no lo
        /// edita. Es lo que le dice si hay algo que arreglar (el bot no es mod, el
        /// timer está detenido) o si solo tiene que entregarlo a mano.
        /// </summary>
        [Column("reason")]
        [MaxLength(200)]
        public string? Reason { get; set; }

        [Column("notes")]
        [MaxLength(500)]
        public string? Notes { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
