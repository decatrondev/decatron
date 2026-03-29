namespace Decatron.Core.Models
{
    public class CommandSettings
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public string CommandName { get; set; } = "";
        public bool IsEnabled { get; set; } = true;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Navigation properties
        public virtual User User { get; set; } = null!;
    }
}