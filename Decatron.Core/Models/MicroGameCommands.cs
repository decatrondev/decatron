namespace Decatron.Core.Models
{
    public class MicroGameCommands
    {
        public long Id { get; set; }
        public string ChannelName { get; set; } = "";
        public string ShortCommand { get; set; } = "";
        public string CategoryName { get; set; } = "";
        public string CreatedBy { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}