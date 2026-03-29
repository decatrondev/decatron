using System.ComponentModel.DataAnnotations;

namespace Decatron.Core.Models
{
    public class CustomCommand
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string ChannelName { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string CommandName { get; set; } = string.Empty;

        [Required]
        public string Response { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Restriction { get; set; } = "all"; // all, mod, vip, sub

        public bool IsActive { get; set; } = true;

        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Para comandos con script
        public bool IsScripted { get; set; } = false;

        public string? ScriptContent { get; set; }
    }
}