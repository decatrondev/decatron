using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Decatron.Core.Models.Promo;

namespace Decatron.Services.Promo
{
    /// <summary>
    /// Reglas del catálogo de Promociones, sin base de datos (se prueban solas). Devuelven códigos de error
    /// ("titleOrBodyRequired", "linkInvalid"…) que el panel traduce a es y en; nunca texto fijo.
    /// Plan: .dev/plans/overlay-promo/PLAN.md §3 y §8 (sanear lo que escribe una persona).
    /// </summary>
    public static class PromoValidator
    {
        public static readonly string[] Kinds = { "commands", "module", "qr", "news", "credits", "community", "emergency" };
        public static readonly string[] Origins = { "bot", "tercero" };
        /// <summary>Anclas posibles de una zona en el lienzo de 1920×1080.</summary>
        public static readonly string[] Anchors = { "top-left", "top-center", "top-right", "middle-left", "center", "middle-right", "bottom-left", "bottom-center", "bottom-right" };
        public static readonly string[] Platforms = { "all", "twitch", "kick" };
        public static readonly string[] Statuses = { "draft", "published" };

        /// <summary>Iconos disponibles (nombres de lucide). El front dibuja exactamente esta lista; cualquier otro nombre se rechaza.</summary>
        public static readonly string[] Icons =
        {
            "megaphone", "sparkles", "gift", "star", "heart", "bell", "music", "trophy", "gamepad-2", "message-square",
            "users", "zap", "tv", "link", "qr-code", "clapperboard", "mic", "languages", "shield-check", "coins",
        };

        /// <summary>Variables que el overlay sabe reemplazar. Cualquier otra {{x}} se rechaza para que no salga cruda en pantalla.</summary>
        public static readonly string[] Variables = { "channel", "commands", "link" };

        public static readonly Regex VariableRx = new(@"\{\{\s*([A-Za-z_]+)\s*\}\}", RegexOptions.Compiled);
        private static readonly Regex ControlRx = new(@"[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]", RegexOptions.Compiled);
        private static readonly Regex ChannelRx = new(@"^[a-z0-9_]{1,40}$", RegexOptions.Compiled);
        private static readonly Regex KeyRx = new(@"^[a-z0-9_-]{2,40}$", RegexOptions.Compiled);
        /// <summary>Clave de una zona (también la de una plantilla).</summary>
        public static bool IsKey(string? s) => s != null && KeyRx.IsMatch(s);

        public const int MaxChannels = 50;

        private static string Clean(string? s) => ControlRx.Replace((s ?? "").Trim(), "");
        private static string? CleanOrNull(string? s) { var c = Clean(s); return c.Length == 0 ? null : c; }

        /// <summary>Limpia y recorta una pieza en el lugar (no valida). Se llama antes de <see cref="ValidatePiece"/>.</summary>
        public static void NormalizePiece(PromoPiece p)
        {
            p.Kind = Clean(p.Kind).ToLowerInvariant();
            p.Origin = Clean(p.Origin).ToLowerInvariant();
            p.Zone = Clean(p.Zone).ToLowerInvariant();
            p.Platforms = Clean(p.Platforms).ToLowerInvariant();
            p.Status = Clean(p.Status).ToLowerInvariant();
            p.TitleEs = Clean(p.TitleEs); p.TitleEn = Clean(p.TitleEn);
            p.BodyEs = Clean(p.BodyEs); p.BodyEn = Clean(p.BodyEn);
            p.LinkUrl = CleanOrNull(p.LinkUrl);
            p.ImageUrl = CleanOrNull(p.ImageUrl);
            p.Icon = CleanOrNull(p.Icon)?.ToLowerInvariant();
            if (p.Kind == "emergency") p.IsPinned = false; // la emergencia ya ignora lo que apague el streamer
            p.Weight = Math.Clamp(p.Weight, 0, 100);
            p.Priority = Math.Clamp(p.Priority, 0, 100);
            p.DurationSeconds = Math.Clamp(p.DurationSeconds, 3, 30);
            p.StartsAt = p.StartsAt?.ToUniversalTime();
            p.EndsAt = p.EndsAt?.ToUniversalTime();
            var chans = (p.OnlyChannels ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(c => c.ToLowerInvariant()).Distinct().ToList();
            p.OnlyChannels = chans.Count == 0 ? null : string.Join(",", chans);
        }

        public static List<string> ValidatePiece(PromoPiece p)
        {
            var e = new List<string>();
            if (!Kinds.Contains(p.Kind)) e.Add("kindInvalid");
            if (!Origins.Contains(p.Origin)) e.Add("originInvalid");
            if (!IsKey(p.Zone)) e.Add("zoneInvalid");
            if (!Platforms.Contains(p.Platforms)) e.Add("platformsInvalid");
            if (!Statuses.Contains(p.Status)) e.Add("statusInvalid");

            if (p.TitleEs.Length > 120 || p.TitleEn.Length > 120) e.Add("titleTooLong");
            if (p.BodyEs.Length > 300 || p.BodyEn.Length > 300) e.Add("bodyTooLong");
            if (p.TitleEs.Length == 0 && p.BodyEs.Length == 0) e.Add("titleOrBodyRequired");
            if (p.Kind == "emergency" && p.BodyEs.Length == 0) e.Add("emergencyNeedsBody");

            var texts = new[] { p.TitleEs, p.TitleEn, p.BodyEs, p.BodyEn };
            if (texts.Any(t => t.Contains('<') || t.Contains('>'))) e.Add("noAngleBrackets");
            var used = texts.SelectMany(t => VariableRx.Matches(t).Select(m => m.Groups[1].Value.ToLowerInvariant())).ToList();
            if (used.Any(v => !Variables.Contains(v))) e.Add("unknownVariable");
            if (used.Contains("link") && p.LinkUrl == null) e.Add("linkVariableNeedsLink");

            if (p.LinkUrl != null && !IsHttpsUrl(p.LinkUrl)) e.Add("linkInvalid");
            if (p.ShowQr && p.LinkUrl == null) e.Add("qrNeedsLink");
            if (p.ImageUrl != null && !IsImageRef(p.ImageUrl)) e.Add("imageInvalid");
            if (p.Icon != null && !Icons.Contains(p.Icon)) e.Add("iconInvalid");

            if (p.StartsAt.HasValue && p.EndsAt.HasValue && p.EndsAt <= p.StartsAt) e.Add("datesOrder");

            if (p.OnlyChannels != null)
            {
                var chans = p.OnlyChannels.Split(',');
                if (chans.Length > MaxChannels || chans.Any(c => !ChannelRx.IsMatch(c))) e.Add("channelsInvalid");
            }
            return e;
        }

        public static void NormalizeTemplate(PromoTemplate t)
        {
            t.Key = Clean(t.Key).ToLowerInvariant();
            t.NameEs = Clean(t.NameEs); t.NameEn = Clean(t.NameEn);
            t.Zone = Clean(t.Zone).ToLowerInvariant();
        }

        public static List<string> ValidateTemplate(PromoTemplate t)
        {
            var e = new List<string>();
            if (!KeyRx.IsMatch(t.Key)) e.Add("keyInvalid");
            if (t.NameEs.Length == 0) e.Add("nameRequired");
            if (t.NameEs.Length > 80 || t.NameEn.Length > 80) e.Add("nameTooLong");
            if (t.NameEs.Contains('<') || t.NameEs.Contains('>') || t.NameEn.Contains('<') || t.NameEn.Contains('>')) e.Add("noAngleBrackets");
            if (!IsKey(t.Zone)) e.Add("zoneInvalid");
            e.AddRange(PromoDesignValidator.Validate(t.Design));
            return e;
        }

        public static void NormalizeZone(PromoZone z)
        {
            z.Key = Clean(z.Key).ToLowerInvariant();
            z.NameEs = Clean(z.NameEs); z.NameEn = Clean(z.NameEn);
            z.Anchor = Clean(z.Anchor).ToLowerInvariant();
        }

        public static List<string> ValidateZone(PromoZone z)
        {
            var e = new List<string>();
            if (!KeyRx.IsMatch(z.Key)) e.Add("keyInvalid");
            if (z.NameEs.Length == 0) e.Add("nameRequired");
            if (z.NameEs.Length > 80 || z.NameEn.Length > 80) e.Add("nameTooLong");
            if (z.NameEs.Contains('<') || z.NameEs.Contains('>') || z.NameEn.Contains('<') || z.NameEn.Contains('>')) e.Add("noAngleBrackets");
            if (!Anchors.Contains(z.Anchor)) e.Add("anchorInvalid");
            if (z.MarginX < 0 || z.MarginX > 1000 || z.MarginY < 0 || z.MarginY > 1000) e.Add("marginRange");
            return e;
        }

        public static List<string> ValidateLimits(int minGapSeconds, int hourlyCapSeconds)
        {
            var e = new List<string>();
            if (minGapSeconds < 10 || minGapSeconds > 3600) e.Add("minGapRange");
            if (hourlyCapSeconds < 30 || hourlyCapSeconds > 3600) e.Add("hourlyCapRange");
            return e;
        }

        /// <summary>Solo https con host; sin espacios. (http y javascript: quedan fuera.)</summary>
        public static bool IsHttpsUrl(string s) =>
            s.Length <= 500 && !s.Any(char.IsWhiteSpace)
            && Uri.TryCreate(s, UriKind.Absolute, out var u) && u.Scheme == Uri.UriSchemeHttps && !string.IsNullOrEmpty(u.Host);

        /// <summary>https, o una ruta propia del sitio ("/brand/x.png"): una sola barra inicial y sin "..".</summary>
        public static bool IsImageRef(string s)
        {
            if (s.Length > 500 || s.Any(char.IsWhiteSpace)) return false;
            if (s.StartsWith('/')) return !s.StartsWith("//") && !s.Contains("..") && !s.Contains('\\');
            return IsHttpsUrl(s);
        }
    }
}
