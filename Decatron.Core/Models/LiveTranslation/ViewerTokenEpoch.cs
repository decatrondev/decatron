using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.LiveTranslation
{
    /// <summary>La «época» de los tokens de espectador de una persona: subirla invalida los anteriores (cerrar sesión en todas las extensiones).</summary>
    [Table("viewer_token_epoch")]
    public class ViewerTokenEpoch
    {
        [Key][Column("user_id")] public long UserId { get; set; }
        [Column("epoch")] public int Epoch { get; set; }
        [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
