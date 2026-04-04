using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Economy;

[Table("coin_settings")]
public class CoinSettings
{
    [Column("id")]
    public long Id { get; set; }

    [Column("currency_name")]
    public string CurrencyName { get; set; } = string.Empty;

    [Column("currency_icon")]
    public string CurrencyIcon { get; set; } = string.Empty;

    [Column("max_transfer_per_day")]
    public long MaxTransferPerDay { get; set; }

    [Column("max_transfers_per_day")]
    public int MaxTransfersPerDay { get; set; }

    [Column("min_transfer_amount")]
    public int MinTransferAmount { get; set; }

    [Column("min_account_age_to_transfer_days")]
    public int MinAccountAgeToTransferDays { get; set; }

    [Column("min_account_age_to_receive_days")]
    public int MinAccountAgeToReceiveDays { get; set; }

    [Column("max_referrals_per_user")]
    public int? MaxReferralsPerUser { get; set; }

    [Column("referral_bonus_referrer")]
    public int ReferralBonusReferrer { get; set; }

    [Column("referral_bonus_referred")]
    public int ReferralBonusReferred { get; set; }

    [Column("referral_min_activity_days")]
    public int ReferralMinActivityDays { get; set; }

    [Column("first_purchase_bonus_percent")]
    public int FirstPurchaseBonusPercent { get; set; }

    [Column("enabled")]
    public bool Enabled { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
