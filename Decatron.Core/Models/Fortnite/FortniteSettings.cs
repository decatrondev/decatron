using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Fortnite
{
    /// <summary>
    /// Ajustes globales de Fortnite Spirits (fila única, id = 1). La temporada actual se elige en
    /// /admin/fortnite; si está vacía se usa Fortnite:CurrentSeason de appsettings.json.
    /// </summary>
    [Table("fortnite_settings")]
    public class FortniteSettings
    {
        [Column("id")] public int Id { get; set; } = 1;
        [Column("current_season")] public string? CurrentSeason { get; set; }
        [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
