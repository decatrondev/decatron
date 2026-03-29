using System.ComponentModel.DataAnnotations;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Cache local de juegos populares de Twitch
    /// Se actualiza periódicamente mediante background service
    /// </summary>
    public class GameCache
    {
        [Key]
        [MaxLength(50)]
        public string GameId { get; set; } = "";

        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = "";

        [MaxLength(500)]
        public string? BoxArtUrl { get; set; }

        /// <summary>
        /// Ranking de popularidad (1 = más popular)
        /// Se actualiza basado en viewers o top games
        /// </summary>
        public int PopularityRank { get; set; }

        /// <summary>
        /// Número de veces que se ha usado en micro comandos
        /// </summary>
        public int UsageCount { get; set; } = 0;

        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
