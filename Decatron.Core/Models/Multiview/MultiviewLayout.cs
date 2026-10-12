using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Multiview;

/// <summary>
/// Un layout guardado del Multi-view: qué canales y con qué distribución. Pertenece a la persona (la fila principal de su
/// cuenta), así que lo ve igual con Twitch o con Kick. Plan: .dev/plans/MULTIVIEW_PLAN.md, Fase 5.
/// </summary>
[Table("multiview_layouts")]
public class MultiviewLayout
{
    [Column("id")]
    public long Id { get; set; }

    [Column("owner_user_id")]
    public long OwnerUserId { get; set; }

    [Column("name")]
    public string Name { get; set; } = "";

    /// <summary>Claves separadas por coma, en orden: «twitch:canal,kick:canal».</summary>
    [Column("slots")]
    public string Slots { get; set; } = "";

    /// <summary>grid | focus | stack</summary>
    [Column("layout")]
    public string Layout { get; set; } = "grid";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
