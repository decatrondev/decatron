using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("xp_transactions")]
public class XpTransaction
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

    [Column("xp_amount")]
    public int XpAmount { get; set; }

    [Required]
    [Column("source")]
    [MaxLength(30)]
    public string Source { get; set; } = "message";

    [Column("description")]
    [MaxLength(200)]
    public string? Description { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
