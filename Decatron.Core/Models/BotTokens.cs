using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("bot_tokens")]
    public class BotTokens
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string BotUsername { get; set; }

        [MaxLength(50)]
        public string? BotTwitchId { get; set; }

        [Required]
        [MaxLength(500)]
        public string AccessToken { get; set; }

        [MaxLength(500)]
        public string? RefreshToken { get; set; }

        [Required]
        [MaxLength(500)]
        public string ChatToken { get; set; }

        public DateTime? TokenExpiration { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        public bool IsActive { get; set; } = true;
    }
}