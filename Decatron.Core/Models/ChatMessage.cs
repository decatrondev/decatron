using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("chat_messages")]
    public class ChatMessage
    {
        [Key]
        public long Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Channel { get; set; }

        [Required]
        [MaxLength(100)]
        public string Username { get; set; }

        [MaxLength(50)]
        public string UserId { get; set; }

        [Required]
        public string Message { get; set; }

        [Required]
        public DateTime Timestamp { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}