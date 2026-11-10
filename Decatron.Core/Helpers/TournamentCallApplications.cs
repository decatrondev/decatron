using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Decatron.Core.Helpers;

public record CallApplicationInput(string Kind, long ChannelUserId, string Contact, string Notes,
    string ContributionType, decimal? Amount, string Currency, bool PublicListing,
    bool AcceptedRules, bool UsesBot, bool WillStream, string PageVersion, long Revision = 0,
    bool AcceptedCustody = false, bool PublicOffer = false, string CustodyNoticeVersion = "");
public record CallApplicationReview(string Status, string Note, long Revision);

public static class TournamentCallApplicationRules
{
    /// <summary>Version del aviso de custodia mostrado al colaborador (clave `custody.notice` en tournament-call).
    /// Al cambiar el texto del aviso hay que cambiar esta version: los formularios abiertos con el texto anterior se rechazan.</summary>
    public const string CustodyNoticeVersion = "custody-2026-11-08";
    /// <summary>paVos, tarjetas y regalos quedan bajo custodia del colaborador; el dinero lo recibe el organizador.</summary>
    public static bool UnderCustody(string? contributionType) => contributionType is "vbucks" or "giftcard";
    public static string Version(string published)
    {
        // PostgreSQL jsonb changes whitespace/property order; neither changes the accepted content.
        using var document = JsonDocument.Parse(published);
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream)) WriteCanonical(document.RootElement, writer);
        return Convert.ToHexString(SHA256.HashData(stream.ToArray()));
    }
    private static void WriteCanonical(JsonElement element, Utf8JsonWriter writer)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            writer.WriteStartObject();
            foreach (var property in element.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal))
            { writer.WritePropertyName(property.Name); WriteCanonical(property.Value, writer); }
            writer.WriteEndObject();
        }
        else if (element.ValueKind == JsonValueKind.Array)
        { writer.WriteStartArray(); foreach (var value in element.EnumerateArray()) WriteCanonical(value, writer); writer.WriteEndArray(); }
        else element.WriteTo(writer);
    }
    public static bool Kind(string? kind) => kind is "participant" or "collaborator";
    public static bool ReviewStatus(string? status) => status is "pending" or "approved" or "rejected";
    public static bool Text(string? text, int maximum, bool required = false) => text != null && text.Length <= maximum &&
        (!required || !string.IsNullOrWhiteSpace(text)) && !Regex.IsMatch(text, @"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]");

    public static string? Validate(CallApplicationInput input)
    {
        if (!Kind(input.Kind) || input.ChannelUserId <= 0 || input.Revision < 0 ||
            !Text(input.Contact, 254, true) || !Text(input.Notes, 1500) || !Text(input.PageVersion, 64, true)) return "invalid_application";
        if (!input.AcceptedRules) return "accept_rules";
        if (input.Kind == "participant") return input.UsesBot && input.WillStream ? null : "participant_requirements";
        if (input.ContributionType is not ("money" or "vbucks" or "giftcard") || input.Amount is not > 0 ||
            input.Amount > 9999999999999999.99m || decimal.Round(input.Amount.Value, 2) != input.Amount.Value) return "invalid_contribution";
        if (input.ContributionType == "vbucks" && decimal.Truncate(input.Amount.Value) != input.Amount.Value) return "invalid_contribution";
        if (input.ContributionType != "vbucks" && (input.Currency == null || !Regex.IsMatch(input.Currency, "^[A-Z]{3}$"))) return "invalid_currency";
        if (!UnderCustody(input.ContributionType)) return null;
        // El aviso se acepta con su version exacta; mostrar la cantidad es un consentimiento distinto del de la ficha.
        if (input.CustodyNoticeVersion != CustodyNoticeVersion) return "notice_changed";
        if (!input.AcceptedCustody) return "custody_required";
        return input.PublicOffer && !input.PublicListing ? "public_offer_requires_listing" : null;
    }
}
