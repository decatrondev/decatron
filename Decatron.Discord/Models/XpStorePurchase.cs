using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Discord.Models;

[Table("xp_store_purchases")]
public class XpStorePurchase
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

    [Column("item_id")]
    public long ItemId { get; set; }

    [Column("cost_paid")]
    public int CostPaid { get; set; }

    [Column("purchased_at")]
    public DateTime PurchasedAt { get; set; } = DateTime.UtcNow;

    [Column("expires_at")]
    public DateTime? ExpiresAt { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Status: completed (auto items), pending (custom, waiting delivery), delivered (custom, streamer delivered)
    /// </summary>
    [Column("status")]
    [MaxLength(20)]
    public string Status { get; set; } = "completed";
}
