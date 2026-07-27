using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    public class UsernameHistory
    {
        public long Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }

        [Column("old_login")]
        public string OldLogin { get; set; } = string.Empty;

        [Column("new_login")]
        public string NewLogin { get; set; } = string.Empty;

        [Column("changed_at")]
        public DateTime ChangedAt { get; set; } = DateTime.UtcNow;

        [Column("detected_by")]
        public string DetectedBy { get; set; } = "auth";
    }
}
