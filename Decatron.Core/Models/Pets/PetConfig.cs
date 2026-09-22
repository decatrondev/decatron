using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Pets;

/// <summary>
/// Config de la mascota de un canal (/overlay/pets?channel=X). Una fila por canal.
/// Toda la config (mascotas, comportamiento, overlay, reacciones, comandos) vive en config_json:
/// el frontend es dueño del shape, igual que Event Alerts y Partida en vivo.
/// Plan: .dev/plans/PETS_PLAN.md
/// </summary>
[Table("pet_configs")]
public class PetConfig
{
    [Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("is_enabled")]
    public bool IsEnabled { get; set; } = true;

    [Column("config_json", TypeName = "jsonb")]
    public string ConfigJson { get; set; } = "{}";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
