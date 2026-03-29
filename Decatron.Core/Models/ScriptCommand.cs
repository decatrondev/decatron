using System.ComponentModel.DataAnnotations;

namespace Decatron.Core.Models
{
    public class ScriptCommand
    {
        public long Id { get; set; }

        [Required]
        public long UserId { get; set; }

        [Required]
        [MaxLength(100)]
        public string ChannelName { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string CommandName { get; set; } = string.Empty;

        [Required]
        public string ScriptContent { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}