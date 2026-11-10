using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Decatron.Core.Helpers;

public record CallContributionInput(string Reference, int? PaymentId, long? ApplicationId, string DonorName,
    string ChannelUrl, string DescriptionEs, string DescriptionEn, string Kind, string Currency,
    decimal? ReceivedAmount, decimal? PrizeAmount, string Custodian, string DeliveredBy,
    string Evidence, bool PublicIdentity, string ConsentEvidence, string Status, long Revision = 0);
public record CallDonationInput(decimal AmountUsd, bool PublicIdentity = false, string DisplayName = "", long? ChannelUserId = null);

public static class TournamentCallContributionRules
{
    private static bool Text(string? value, int max, bool required = false) => TournamentCallApplicationRules.Text(value, max, required);
    public static bool Money(decimal? value) => value is > 0 and <= 999999999999.99m && decimal.Round(value.Value, 2) == value;
    public static bool Channel(string? url) => url != null && (url == "" || Regex.IsMatch(url, @"^https://(www\.)?(twitch\.tv|kick\.com)/[a-zA-Z0-9_-]+/?$"));
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static bool Receipt(string? key) => key != null && Regex.IsMatch(key, "^[A-F0-9]{64}$");
    public static bool Donation(CallDonationInput input) => input.AmountUsd is >= 1 and <= 10000 && Money(input.AmountUsd) &&
        Text(input.DisplayName, 100, input.PublicIdentity) && input.ChannelUserId is null or > 0;
    public static string? Validate(CallContributionInput input)
    {
        if (!Text(input.Reference, 150, true) || !Text(input.DonorName, 100, true) || !Channel(input.ChannelUrl) ||
            !Text(input.DescriptionEs, 600, true) || !Text(input.DescriptionEn, 600, true) ||
            !Text(input.Custodian, 150) || !Text(input.DeliveredBy, 150) || !Text(input.Evidence, 1500) ||
            !Text(input.ConsentEvidence, 1000) || input.Revision < 0 || input.PaymentId is <= 0 || input.ApplicationId is <= 0 ||
            input.Kind is not ("money" or "giftcard" or "item") || input.Status is not ("pending" or "confirmed" or "reversed")) return "invalid_contribution";
        if (input.Kind == "item" ? input.Currency != "" : input.Currency == null || !Regex.IsMatch(input.Currency, "^[A-Z]{3}$")) return "invalid_currency";
        if ((input.ReceivedAmount.HasValue && !Money(input.ReceivedAmount)) || (input.PrizeAmount.HasValue && !Money(input.PrizeAmount)) ||
            (input.PrizeAmount.HasValue && (!input.ReceivedAmount.HasValue || input.PrizeAmount > input.ReceivedAmount)) ||
            (input.Kind == "item" && ((input.ReceivedAmount.HasValue && input.ReceivedAmount % 1 != 0) || (input.PrizeAmount.HasValue && input.PrizeAmount % 1 != 0)))) return "invalid_amount";
        if (input.PublicIdentity && !Text(input.ConsentEvidence, 1000, true)) return "consent_required";
        if (input.Status == "confirmed" && (!Money(input.ReceivedAmount) || !Money(input.PrizeAmount) ||
            !Text(input.Custodian, 150, true) || !Text(input.DeliveredBy, 150, true) || !Text(input.Evidence, 1500, true))) return "receipt_required";
        return null;
    }
}
