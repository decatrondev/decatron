using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Aliases/shortcuts para juegos comunes
    /// Ejemplo: "lol" -> League of Legends
    /// </summary>
    public class GameAlias
    {
        [Key]
        [MaxLength(100)]
        public string Alias { get; set; } = "";

        [Required]
        [MaxLength(50)]
        public string GameId { get; set; } = "";

        [Required]
        [MaxLength(255)]
        public string GameName { get; set; } = "";

        /// <summary>
        /// Tipo de alias: 'system' (predefinido) o 'user' (creado por usuarios)
        /// </summary>
        [MaxLength(20)]
        public string AliasType { get; set; } = "system";

        /// <summary>
        /// ID del usuario que creó el alias (null si es system)
        /// </summary>
        public long? CreatedByUserId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation property (opcional)
        [ForeignKey("GameId")]
        public GameCache? Game { get; set; }
    }
}
