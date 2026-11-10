using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models;

[Table("tournament_call_contributions")]
public class TournamentCallContribution
{
    [NotMapped] public bool IsOnlineDonation { get; set; }
    [NotMapped] public bool IsTest { get; set; }
    /// <summary>Solo para el organizador: quien pago con sesion (nombre de cuenta y canal). Nunca va a la API publica.</summary>
    [NotMapped] public string PayerName { get; set; } = "";
    [NotMapped] public string PayerChannelUrl { get; set; } = "";
    [Key, Column("id")] public long Id { get; set; }
    [Column("reference")] public string Reference { get; set; } = "";
    [Column("payment_id")] public int? PaymentId { get; set; }
    [Column("payment_reference")] public string PaymentReference { get; set; } = "";
    [ForeignKey(nameof(PaymentId)), System.Text.Json.Serialization.JsonIgnore] public SupporterPayment? Payment { get; set; }
    [Column("application_id")] public long? ApplicationId { get; set; }
    [Column("donor_name")] public string DonorName { get; set; } = "";
    [Column("channel_url")] public string ChannelUrl { get; set; } = "";
    [Column("description_es")] public string DescriptionEs { get; set; } = "";
    [Column("description_en")] public string DescriptionEn { get; set; } = "";
    [Column("kind")] public string Kind { get; set; } = "money";
    [Column("currency")] public string Currency { get; set; } = "USD";
    [Column("gross_amount")] public decimal? GrossAmount { get; set; }
    [Column("received_amount")] public decimal? ReceivedAmount { get; set; }
    [Column("prize_amount")] public decimal? PrizeAmount { get; set; }
    [Column("custodian")] public string Custodian { get; set; } = "";
    [Column("delivered_by")] public string DeliveredBy { get; set; } = "";
    [Column("evidence")] public string Evidence { get; set; } = "";
    [Column("public_identity")] public bool PublicIdentity { get; set; }
    [Column("consent_evidence")] public string ConsentEvidence { get; set; } = "";
    [Column("status")] public string Status { get; set; } = "pending";
    [Column("confirmed_at")] public DateTimeOffset? ConfirmedAt { get; set; }
    [Column("confirmed_by")] public long? ConfirmedBy { get; set; }
    [Column("revision"), ConcurrencyCheck] public long Revision { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
    [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
}

[Table("tournament_call_contribution_events")]
public class TournamentCallContributionEvent
{
    [Key, Column("id")] public long Id { get; set; }
    [Column("contribution_id")] public long ContributionId { get; set; }
    [ForeignKey(nameof(ContributionId)), System.Text.Json.Serialization.JsonIgnore] public TournamentCallContribution Contribution { get; set; } = null!;
    [Column("actor_id")] public long? ActorId { get; set; }
    [Column("action")] public string Action { get; set; } = "";
    [Column("snapshot", TypeName = "jsonb")] public string Snapshot { get; set; } = "{}";
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
}

[Table("tournament_call_donation_intents")]
public class TournamentCallDonationIntent
{
    [Key, Column("id")] public Guid Id { get; set; }
    [Column("receipt_hash")] public string ReceiptHash { get; set; } = "";
    [Column("reference")] public string Reference { get; set; } = "";
    [Column("amount_usd")] public decimal AmountUsd { get; set; }
    [Column("amount_pen")] public decimal AmountPen { get; set; }
    [Column("public_identity")] public bool PublicIdentity { get; set; }
    [Column("display_name")] public string DisplayName { get; set; } = "";
    [Column("consented_at")] public DateTimeOffset? ConsentedAt { get; set; }
    [Column("token_hash")] public string TokenHash { get; set; } = "";
    [Column("device_hash")] public string DeviceHash { get; set; } = "";
    [Column("payment_key_hash")] public string PaymentKeyHash { get; set; } = "";
    [Column("state")] public string State { get; set; } = "prepared";
    [Column("charge_id")] public string ChargeId { get; set; } = "";
    [Column("is_test")] public bool IsTest { get; set; }
    [Column("user_id")] public long? UserId { get; set; }
    [Column("channel_user_id")] public long? ChannelUserId { get; set; }
    [Column("contribution_id")] public long? ContributionId { get; set; }
    [ForeignKey(nameof(ContributionId)), System.Text.Json.Serialization.JsonIgnore] public TournamentCallContribution? Contribution { get; set; }
    [Column("revision"), ConcurrencyCheck] public long Revision { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; }
    [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
}
