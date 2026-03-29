namespace Decatron.Core.Models
{
    public class GameHistory
    {
        public long Id { get; set; }
        public string ChannelLogin { get; set; } = "";
        public string CategoryName { get; set; } = "";
        public string ChangedBy { get; set; } = "";
        public DateTime ChangedAt { get; set; }
    }
}