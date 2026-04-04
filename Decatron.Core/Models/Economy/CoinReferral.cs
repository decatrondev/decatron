using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Economy;

[Table("coin_referrals")]
public class CoinReferral
{
    [Column("id")]
    public long Id { get; set; }

    [Column("referrer_user_id")]
    public long ReferrerUserId { get; set; }

    [Column("referred_user_id")]
    public long ReferredUserId { get; set; }

    [Column("referral_code")]
    public string ReferralCode { get; set; } = string.Empty;

    [Column("bonus_given_to_referrer")]
    public int BonusGivenToReferrer { get; set; }

    [Column("bonus_given_to_referred")]
    public int BonusGivenToReferred { get; set; }

    [Column("status")]
    public string Status { get; set; } = "pending";

    [Column("completed_at")]
    public DateTime? CompletedAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
