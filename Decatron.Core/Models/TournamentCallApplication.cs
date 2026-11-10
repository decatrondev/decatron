using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models;

[Table("tournament_call_applications")]
public class TournamentCallApplication
{
    [Key, Column("id")] public long Id { get; set; }
    [Column("identity_key")] public string IdentityKey { get; set; } = "";
    [Column("user_id")] public long UserId { get; set; }
    [Column("channel_user_id")] public long ChannelUserId { get; set; }
    [Column("kind")] public string Kind { get; set; } = "participant";
    [Column("display_name")] public string DisplayName { get; set; } = "";
    [Column("channel_url")] public string ChannelUrl { get; set; } = "";
    [Column("avatar_url")] public string AvatarUrl { get; set; } = "";
    [Column("contact")] public string Contact { get; set; } = "";
    [Column("notes")] public string Notes { get; set; } = "";
    [Column("contribution_type")] public string ContributionType { get; set; } = "";
    [Column("amount")] public decimal? Amount { get; set; }
    [Column("currency")] public string Currency { get; set; } = "";
    [Column("public_listing")] public bool PublicListing { get; set; }
    [Column("uses_bot")] public bool UsesBot { get; set; }
    [Column("will_stream")] public bool WillStream { get; set; }
    [Column("accepted_at")] public DateTimeOffset AcceptedAt { get; set; }
    [Column("rules_snapshot", TypeName = "jsonb")] public string RulesSnapshot { get; set; } = "{}";
    [Column("status")] public string Status { get; set; } = "pending";
    [Column("review_note")] public string ReviewNote { get; set; } = "";
    [Column("reviewed_at")] public DateTimeOffset? ReviewedAt { get; set; }
    [Column("reviewed_by")] public long? ReviewedBy { get; set; }
    /// <summary>"form" = enviada por la persona; "payment" = creada al completarse su pago (se aprueba al confirmar la recepcion).</summary>
    [Column("origin")] public string Origin { get; set; } = "form";
    [Column("custody_accepted_at")] public DateTimeOffset? CustodyAcceptedAt { get; set; }
    [Column("custody_notice_version")] public string CustodyNoticeVersion { get; set; } = "";
    /// <summary>Consentimiento aparte (no el de la ficha) para mostrar la cantidad ofrecida bajo custodia.</summary>
    [Column("public_offer")] public bool PublicOffer { get; set; }
    [Column("revision"), ConcurrencyCheck] public long Revision { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
    [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
}
