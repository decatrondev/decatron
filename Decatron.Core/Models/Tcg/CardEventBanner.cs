using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Tcg;

[Table("card_event_banners")]
public class CardEventBanner
{
    [Column("id")]
    public int Id { get; set; }

    [Column("event_id")]
    public string EventId { get; set; } = string.Empty;

    [Column("starts_at")]
    public DateTime StartsAt { get; set; }

    [Column("ends_at")]
    public DateTime EndsAt { get; set; }

    [Column("active")]
    public bool Active { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
