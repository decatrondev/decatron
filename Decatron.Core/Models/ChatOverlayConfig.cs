using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>Configuración del overlay de chat de un canal (JSON; el front la normaliza)</summary>
    [Table("chat_overlay_configs")]
    public class ChatOverlayConfig
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        [Column("config", TypeName = "jsonb")]
        public string Config { get; set; } = "{}";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}
