using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("xp_boosts")]
public class XpBoost
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Required]
    [Column("guild_id")]
    [MaxLength(30)]
    public string GuildId { get; set; } = string.Empty;

    [Column("multiplier")]
    public double Multiplier { get; set; } = 2.0;

    [Required]
    [Column("activated_by_user_id")]
    [MaxLength(30)]
    public string ActivatedByUserId { get; set; } = string.Empty;

    [Column("activated_by_username")]
    [MaxLength(100)]
    public string ActivatedByUsername { get; set; } = string.Empty;

    [Column("starts_at")]
    public DateTime StartsAt { get; set; } = DateTime.UtcNow;

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
