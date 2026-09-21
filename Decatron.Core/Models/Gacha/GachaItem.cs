using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Gacha
{
    [Table("gacha_items")]
    public class GachaItem
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("channel_name")]
        [MaxLength(100)]
        public string ChannelName { get; set; } = "";

        [Column("user_id")]
        public long UserId { get; set; }

        [ForeignKey("UserId")]
        public Decatron.Core.Models.User? ChannelUser { get; set; }

        [Required]
        [Column("name")]
        [MaxLength(255)]
        public string Name { get; set; } = "";

        [Required]
        [Column("rarity")]
        [MaxLength(50)]
        public string Rarity { get; set; } = "common";

        [Column("image")]
        [MaxLength(500)]
        public string? Image { get; set; }

        [Column("available")]
        public bool Available { get; set; } = true;

        /// <summary>Qué pasa cuando sale el item. Ver <see cref="GachaItemEffects"/>.</summary>
        [Column("effect_type")]
        [MaxLength(30)]
        public string EffectType { get; set; } = GachaItemEffects.None;

        /// <summary>Cantidad del efecto: tiros para extra_pulls, segundos para timer_time.</summary>
        [Column("effect_value")]
        public int EffectValue { get; set; } = 0;

        /// <summary>Se usa al salir y no queda en la colección.</summary>
        [Column("consumable")]
        public bool Consumable { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Catálogo de efectos de item. Agregar uno nuevo es una constante acá, el
    /// check de la tabla y un caso en GachaService.ApplyItemEffectAsync.
    /// </summary>
    public static class GachaItemEffects
    {
        public const string None       = "none";
        public const string RollAgain  = "roll_again";
        public const string ExtraPulls = "extra_pulls";
        public const string TimerTime  = "timer_time";

        public static bool EsValido(string? v) => v is None or RollAgain or ExtraPulls or TimerTime;
    }
}
