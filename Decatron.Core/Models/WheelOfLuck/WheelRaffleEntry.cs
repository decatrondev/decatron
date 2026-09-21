using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.WheelOfLuck
{
    /// <summary>Un inscrito en una rueda de modo Sorteo.</summary>
    [Table("wheel_raffle_entries")]
    public class WheelRaffleEntry
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("wheel_id")]
        public int WheelId { get; set; }

        [ForeignKey("WheelId")]
        public Wheel? Wheel { get; set; }

        [Column("viewer_user_id")]
        public long? ViewerUserId { get; set; }

        [Required]
        [Column("viewer_login")]
        [MaxLength(100)]
        public string ViewerLogin { get; set; } = string.Empty;

        /// <summary>Número de boletos, si la rueda permite comprar varios.</summary>
        [Column("entries")]
        public int Entries { get; set; } = 1;

        /// <summary>Peso efectivo tras aplicar los multiplicadores.</summary>
        [Column("weight")]
        public decimal Weight { get; set; } = 1m;

        /// <summary>
        /// De dónde salió ese peso (watchtime, sub, tier, coins, manual). Se guarda
        /// para poder explicarle al espectador por qué otro pesaba más que él.
        /// </summary>
        [Required]
        [Column("weight_breakdown", TypeName = "jsonb")]
        public string WeightBreakdown { get; set; } = "{}";

        [Column("joined_at")]
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Saca al ganador del pool sin perder el registro de que participó.</summary>
        [Column("has_won")]
        public bool HasWon { get; set; }

        /// <summary>
        /// Cuándo ganó. Va junto a <see cref="HasWon"/>: sin fecha, dos ganadores del
        /// mismo pool son indistinguibles y `remove_and_continue` no se puede narrar.
        /// </summary>
        [Column("won_at")]
        public DateTime? WonAt { get; set; }
    }
}
