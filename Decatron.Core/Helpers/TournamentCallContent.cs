using System;
using System.Text.RegularExpressions;

namespace Decatron.Core.Helpers;

public record CallCopy(string Title = "", string Summary = "", string ImageAlt = "", string Rules = "");
public record TournamentCallContent(CallCopy Es, CallCopy En, string ImageUrl = "", string ImageCredit = "", string ImageSource = "", string TournamentUrl = "");

public static class TournamentCallRules
{
    public static bool SafeImage(string? value) => string.IsNullOrEmpty(value) || value == "/images/tournament-call/fortnite-island.jpg" ||
        Regex.IsMatch(value, @"^/uploads/brand/[a-f0-9]{32}\.(png|jpe?g|webp)$", RegexOptions.IgnoreCase);

    public static bool SafeSource(string? value) => string.IsNullOrEmpty(value) ||
        (Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == "https" && string.IsNullOrEmpty(uri.UserInfo));

    /// <summary>Enlace a la inscripcion del torneo: vacio o ruta interna /torneos/canal/edicion (nunca un sitio externo).</summary>
    public static bool SafeTournamentPath(string? value) => string.IsNullOrEmpty(value) ||
        Regex.IsMatch(value, @"^/torneos/[a-z0-9_]{1,50}/[a-z0-9][a-z0-9-]{0,79}$");

    public static bool Valid(TournamentCallContent? content, bool publishing)
    {
        if (content?.Es == null || content.En == null || !SafeImage(content.ImageUrl) || !SafeSource(content.ImageSource) || !SafeTournamentPath(content.TournamentUrl)) return false;
        if (content.ImageCredit == null || content.ImageCredit.Length > 250 || content.ImageSource == null || content.ImageSource.Length > 2000) return false;
        foreach (var copy in new[] { content.Es, content.En })
        {
            if (copy.Title == null || copy.Summary == null || copy.ImageAlt == null || copy.Rules == null ||
                copy.Title.Length > 120 || copy.Summary.Length > 1200 || copy.ImageAlt.Length > 250 || copy.Rules.Length > 6000) return false;
            if (publishing && (string.IsNullOrWhiteSpace(copy.Title) || string.IsNullOrWhiteSpace(copy.Summary) ||
                string.IsNullOrWhiteSpace(copy.ImageAlt) || string.IsNullOrWhiteSpace(copy.Rules))) return false;
        }
        return !publishing || (!string.IsNullOrWhiteSpace(content.ImageUrl) && !string.IsNullOrWhiteSpace(content.ImageCredit) && !string.IsNullOrWhiteSpace(content.ImageSource));
    }
}
