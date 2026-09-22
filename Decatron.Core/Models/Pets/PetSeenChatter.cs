using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Pets;

/// <summary>Quién ya escribió alguna vez en el canal (desde que existe la mascota). Sirve para el saludo a nuevos.</summary>
[Table("pet_seen_chatters")]
public class PetSeenChatter
{
    [Column("channel_user_id")]
    public long ChannelUserId { get; set; }

    [Column("chatter_login")]
    public string ChatterLogin { get; set; } = string.Empty;

    [Column("first_seen_at")]
    public DateTime FirstSeenAt { get; set; } = DateTime.UtcNow;
}
