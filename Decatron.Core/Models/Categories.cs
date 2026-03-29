namespace Decatron.Core.Models
{
    public class Categories
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public int Priority { get; set; } = 0;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}