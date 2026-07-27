using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    public class GameHistory
    {
        public long Id { get; set; }
        public string ChannelLogin { get; set; } = "";

        [Column("user_id")]
        public long UserId { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }
        public string CategoryName { get; set; } = "";
        public string ChangedBy { get; set; } = "";
        public DateTime ChangedAt { get; set; }
    }
}