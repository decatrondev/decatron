using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("title_history")]
    public class TitleHistory
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("channel_login")]
        public string ChannelLogin { get; set; } = "";

        [Required]
        [MaxLength(500)]
        [Column("title")]
        public string Title { get; set; } = "";

        [Required]
        [MaxLength(100)]
        [Column("changed_by")]
        public string ChangedBy { get; set; } = "";

        [Required]
        [Column("changed_at")]
        public DateTime ChangedAt { get; set; }
    }
}