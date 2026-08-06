using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("xp_seasonal")]
public class XpSeasonal
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Required]
    [Column("guild_id")]
    [MaxLength(30)]
    public string GuildId { get; set; } = string.Empty;

    [Required]
    [Column("user_id")]
    [MaxLength(30)]
    public string UserId { get; set; } = string.Empty;

    [Column("username")]
    [MaxLength(100)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [Column("year_month")]
    [MaxLength(7)]
    public string YearMonth { get; set; } = string.Empty;

    [Column("xp_gained")]
    public int XpGained { get; set; } = 0;

    [Column("messages_count")]
    public int MessagesCount { get; set; } = 0;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
