using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tcg;

// Catalogo de disenios base (nivel 0), generado aparte en ComfyUI Desktop e insertado
// directo por el lado de generacion — el bot nunca escribe en esta tabla, solo lee.
[Table("cards")]
public class Card
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("rarity")]
    public string Rarity { get; set; } = string.Empty;

    [Column("element")]
    public string Element { get; set; } = string.Empty;

    [Column("class")]
    public string Class { get; set; } = string.Empty;

    [Column("story")]
    public string? Story { get; set; }

    [Column("personality")]
    public string? Personality { get; set; }

    [Column("hp")]
    public int? Hp { get; set; }

    [Column("atk")]
    public int? Atk { get; set; }

    [Column("def")]
    public int? Def { get; set; }

    [Column("spd")]
    public int? Spd { get; set; }

    [Column("abilities")]
    public string? AbilitiesJson { get; set; }

    [Column("tags")]
    public string[]? Tags { get; set; }

    [Column("image_path")]
    public string? ImagePath { get; set; }

    [Column("seed")]
    public long? Seed { get; set; }

    [Column("prompt")]
    public string? Prompt { get; set; }

    [Column("negative_prompt")]
    public string? NegativePrompt { get; set; }

    [Column("lora_used")]
    public string? LoraUsed { get; set; }

    [Column("event_id")]
    public string? EventId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("combo_hash")]
    public string? ComboHash { get; set; }

    [Column("gender")]
    public string Gender { get; set; } = "female";

    [Column("animated")]
    public bool Animated { get; set; }
}
