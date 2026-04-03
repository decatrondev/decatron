using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using SixLabors.Fonts;

namespace Decatron.Discord;

public class RankCardGenerator
{
    private readonly ILogger<RankCardGenerator> _logger;
    private readonly HttpClient _httpClient;

    private const int W = 934;
    private const int H = 282;

    // Color palette
    private static readonly Rgba32 BgDark = new(23, 25, 30);
    private static readonly Rgba32 BgCard = new(32, 34, 39);
    private static readonly Rgba32 TextWhite = new(255, 255, 255);
    private static readonly Rgba32 TextGray = new(148, 163, 184);
    private static readonly Rgba32 BarBg = new(55, 65, 81);
    private static readonly Rgba32 AccentBlue = new(37, 99, 235);
    private static readonly Rgba32 AccentGold = new(245, 158, 11);
    private static readonly Rgba32 AccentGreen = new(34, 197, 94);

    // Tier colors
    private static readonly Dictionary<string, Rgba32> TierColors = new()
    {
        ["supporter"] = new Rgba32(59, 130, 246),
        ["premium"] = new Rgba32(168, 85, 247),
        ["fundador"] = new Rgba32(245, 158, 11),
    };

    public RankCardGenerator(ILogger<RankCardGenerator> logger, IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient();
    }

    public async Task<MemoryStream?> GenerateAsync(
        string username,
        string? avatarUrl,
        int level,
        long currentXp,
        long requiredXp,
        int rank,
        int totalUsers,
        string? tier)
    {
        try
        {
            using var image = new Image<Rgba32>(W, H);

            // Background
            image.Mutate(ctx => ctx.BackgroundColor(new Color(BgDark)));

            // Main card area with rounded feel (slightly lighter bg)
            image.Mutate(ctx => ctx.Fill(new Color(BgCard),
                new RectangularPolygon(16, 16, W - 32, H - 32)));

            // Accent line on left
            var accentColor = tier != null && TierColors.TryGetValue(tier, out var tc) ? tc : AccentBlue;
            image.Mutate(ctx => ctx.Fill(new Color(accentColor),
                new RectangularPolygon(16, 16, 4, H - 32)));

            // Avatar (left side)
            var avSize = 140;
            var avX = 60;
            var avY = (H - avSize) / 2;

            // Avatar circle bg
            image.Mutate(ctx => ctx.Fill(new Color(BarBg),
                new EllipsePolygon(avX + avSize / 2f, avY + avSize / 2f, avSize / 2f + 3)));

            var avatar = await LoadRemoteImage(avatarUrl);
            if (avatar != null)
            {
                avatar.Mutate(ctx => ctx.Resize(avSize, avSize));
                using var circled = ClipToCircle(avatar, avSize);
                image.Mutate(ctx => ctx.DrawImage(circled, new Point(avX, avY), 1f));
                avatar.Dispose();
            }
            else
            {
                // Placeholder circle with initial
                image.Mutate(ctx => ctx.Fill(new Color(AccentBlue),
                    new EllipsePolygon(avX + avSize / 2f, avY + avSize / 2f, avSize / 2f)));
                var initFont = GetFont(56, FontStyle.Bold);
                DrawText(image, username.Length > 0 ? username[..1].ToUpper() : "?", initFont,
                    Color.White, avX + avSize / 2f, avY + avSize / 2f, HorizontalAlignment.Center, VerticalAlignment.Center);
            }

            // Right side content
            var contentX = avX + avSize + 40;
            var contentW = W - contentX - 40;

            // Username
            var nameFont = GetFont(28, FontStyle.Bold);
            DrawText(image, username, nameFont, new Color(TextWhite),
                contentX, 50, HorizontalAlignment.Left, VerticalAlignment.Top, contentW - 160);

            // Level badge (top right area)
            var levelText = $"LVL {level}";
            var levelFont = GetFont(32, FontStyle.Bold);
            DrawText(image, levelText, levelFont, new Color(accentColor),
                W - 55, 50, HorizontalAlignment.Right, VerticalAlignment.Top);

            // Rank info
            var rankText = rank > 0 ? $"#{rank} / {totalUsers}" : "";
            var rankFont = GetFont(16, FontStyle.Regular);
            DrawText(image, rankText, rankFont, new Color(TextGray),
                contentX, 88, HorizontalAlignment.Left, VerticalAlignment.Top);

            // Tier badge
            if (tier != null && tier != "free")
            {
                var tierLabel = tier.ToUpper();
                var tierFont = GetFont(12, FontStyle.Bold);
                var tierColor = TierColors.GetValueOrDefault(tier, AccentBlue);

                // Small pill badge
                var pillX = contentX + 120;
                var pillY = 85;
                image.Mutate(ctx => ctx.Fill(new Color(new Rgba32(tierColor.R, tierColor.G, tierColor.B, 40)),
                    new RectangularPolygon(pillX, pillY, tierLabel.Length * 9 + 16, 22)));
                DrawText(image, tierLabel, tierFont, new Color(tierColor),
                    pillX + (tierLabel.Length * 9 + 16) / 2f, pillY + 11,
                    HorizontalAlignment.Center, VerticalAlignment.Center);
            }

            // XP Progress bar
            var barX = contentX;
            var barY = 145;
            var barW = contentW;
            var barH = 24;

            // Bar background
            image.Mutate(ctx => ctx.Fill(new Color(BarBg),
                new RectangularPolygon(barX, barY, barW, barH)));

            // Bar fill
            var progress = requiredXp > 0 ? Math.Min((double)currentXp / requiredXp, 1.0) : 0;
            var fillW = (int)(barW * progress);
            if (fillW > 0)
            {
                // Gradient-like: use accent color
                image.Mutate(ctx => ctx.Fill(new Color(accentColor),
                    new RectangularPolygon(barX, barY, fillW, barH)));
            }

            // XP text on bar
            var xpBarFont = GetFont(13, FontStyle.Bold);
            var xpText = $"{FormatNumber(currentXp)} / {FormatNumber(requiredXp)} XP";
            DrawText(image, xpText, xpBarFont, new Color(TextWhite),
                barX + barW / 2f, barY + barH / 2f,
                HorizontalAlignment.Center, VerticalAlignment.Center);

            // Stats row below bar
            var statsY = barY + barH + 24;
            var statsFont = GetFont(14, FontStyle.Regular);
            var statsLabelFont = GetFont(12, FontStyle.Regular);

            // Total XP
            var totalXp = Services.XpService.CalculateTotalXpForLevel(level) + currentXp;
            DrawText(image, "TOTAL XP", statsLabelFont, new Color(TextGray),
                contentX, statsY, HorizontalAlignment.Left, VerticalAlignment.Top);
            DrawText(image, FormatNumber(totalXp), GetFont(16, FontStyle.Bold), new Color(TextWhite),
                contentX, statsY + 18, HorizontalAlignment.Left, VerticalAlignment.Top);

            // Progress %
            var pctX = contentX + contentW / 3f;
            var pct = (int)(progress * 100);
            DrawText(image, "PROGRESO", statsLabelFont, new Color(TextGray),
                pctX, statsY, HorizontalAlignment.Left, VerticalAlignment.Top);
            DrawText(image, $"{pct}%", GetFont(16, FontStyle.Bold), new Color(AccentGreen),
                pctX, statsY + 18, HorizontalAlignment.Left, VerticalAlignment.Top);

            // Next level
            var nextX = contentX + contentW * 2f / 3f;
            var remaining = requiredXp - currentXp;
            DrawText(image, "SIGUIENTE", statsLabelFont, new Color(TextGray),
                nextX, statsY, HorizontalAlignment.Left, VerticalAlignment.Top);
            DrawText(image, $"{FormatNumber(remaining)} XP", GetFont(16, FontStyle.Bold), new Color(TextWhite),
                nextX, statsY + 18, HorizontalAlignment.Left, VerticalAlignment.Top);

            // Footer line
            var footerFont = GetFont(11, FontStyle.Regular);
            DrawText(image, "Decatron Bot • twitch.decatron.net", footerFont,
                new Color(new Rgba32(100, 116, 139)),
                W / 2f, H - 12, HorizontalAlignment.Center, VerticalAlignment.Center);

            // Export
            var stream = new MemoryStream();
            await image.SaveAsPngAsync(stream);
            stream.Position = 0;
            return stream;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating rank card for {User}", username);
            return null;
        }
    }

    // ============================================
    // HELPERS
    // ============================================

    private static void DrawText(Image<Rgba32> image, string text, Font font, Color color,
        float x, float y, HorizontalAlignment hAlign, VerticalAlignment vAlign, float? maxWidth = null)
    {
        var opts = new RichTextOptions(font)
        {
            Origin = new System.Numerics.Vector2(x, y),
            HorizontalAlignment = hAlign,
            VerticalAlignment = vAlign,
        };
        if (maxWidth.HasValue)
            opts.WrappingLength = maxWidth.Value;

        image.Mutate(ctx => ctx.DrawText(opts, text, color));
    }

    private static Image<Rgba32> ClipToCircle(Image<Rgba32> source, int size)
    {
        var result = new Image<Rgba32>(size, size);
        var center = size / 2f;
        var radius = size / 2f;
        source.ProcessPixelRows(result, (srcAccessor, dstAccessor) =>
        {
            for (int y = 0; y < size; y++)
            {
                var srcRow = srcAccessor.GetRowSpan(y);
                var dstRow = dstAccessor.GetRowSpan(y);
                for (int x = 0; x < size; x++)
                {
                    var dx = x - center;
                    var dy = y - center;
                    dstRow[x] = dx * dx + dy * dy <= radius * radius
                        ? srcRow[x] : new Rgba32(0, 0, 0, 0);
                }
            }
        });
        return result;
    }

    private async Task<Image<Rgba32>?> LoadRemoteImage(string? url)
    {
        try
        {
            if (string.IsNullOrEmpty(url)) return null;
            var response = await _httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode) return null;
            var stream = await response.Content.ReadAsStreamAsync();
            return await Image.LoadAsync<Rgba32>(stream);
        }
        catch { return null; }
    }

    private static Font GetFont(int size, FontStyle style = FontStyle.Bold)
    {
        if (SystemFonts.TryGet("Inter", out var family) ||
            SystemFonts.TryGet("Noto Sans", out family) ||
            SystemFonts.TryGet("DejaVu Sans", out family))
            return family.CreateFont(size, style);
        var families = SystemFonts.Families.ToList();
        if (families.Count > 0) return families[0].CreateFont(size, style);
        throw new Exception("No fonts available");
    }

    private static string FormatNumber(long n)
    {
        if (n >= 1_000_000) return $"{n / 1_000_000.0:F1}M";
        if (n >= 1_000) return $"{n / 1_000.0:F1}K";
        return n.ToString("N0");
    }
}
