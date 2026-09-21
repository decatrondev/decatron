using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Cuando !ruleta le da a alguien que ya era moderador, Twitch obliga a quitarle
    /// el mod antes de poder aplicar el timeout. Esta tabla es la cola persistente
    /// que RuletaBackgroundService revisa para devolverle el mod cuando expire —
    /// persistente porque un Task.Delay en memoria se pierde si el backend reinicia
    /// dentro de la ventana del timeout.
    /// </summary>
    [Table("ruleta_mod_restores")]
    public class RuletaModRestore
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("channel_login")]
        [MaxLength(255)]
        public string ChannelLogin { get; set; } = string.Empty;

        [Required]
        [Column("target_username")]
        [MaxLength(255)]
        public string TargetUsername { get; set; } = string.Empty;

        [Column("expires_at")]
        public DateTime ExpiresAt { get; set; }

        [Column("processed")]
        public bool Processed { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
