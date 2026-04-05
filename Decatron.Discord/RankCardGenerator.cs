using System.Text.Json;
using Decatron.Data;
using Decatron.Discord.Models;
using Microsoft.EntityFrameworkCore;
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
    private readonly DecatronDbContext _db;

    public RankCardGenerator(ILogger<RankCardGenerator> logger, IHttpClientFactory httpClientFactory, DecatronDbContext db)
    {
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient();
        _db = db;
    }

    /// <summary>
    /// Generate rank card — tries custom config first, falls back to hardcoded
    /// </summary>
    public async Task<MemoryStream?> GenerateAsync(
        string username,
        string? avatarUrl,
        int level,
        long currentXp,
        long requiredXp,
        int rank,
        int totalUsers,
        string? tier,
        string? guildId = null)
    {
        try
        {
            // Try to load custom config for this guild + level
            if (!string.IsNullOrEmpty(guildId))
            {
                var customConfig = await GetConfigForLevel(guildId, level);
                if (customConfig != null)
                {
                    return await GenerateFromConfigAsync(customConfig, username, avatarUrl, level, currentXp, requiredXp, rank, totalUsers, tier);
                }
            }

            // Fallback: hardcoded card
            return await GenerateHardcodedAsync(username, avatarUrl, level, currentXp, requiredXp, rank, totalUsers, tier);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating rank card for {User}", username);
            return null;
        }
    }

    /// <summary>
    /// Find the best config: level-specific > base > null
    /// </summary>
    private async Task<RankCardConfig?> GetConfigForLevel(string guildId, int level)
    {
        // First check level-specific configs
        var levelConfig = await _db.Set<RankCardLevelConfig>()
            .Where(c => c.GuildId == guildId && c.Enabled && c.LevelMin <= level && (c.LevelMax == null || c.LevelMax >= level))
            .OrderByDescending(c => c.LevelMin)
            .FirstOrDefaultAsync();

        if (levelConfig != null)
        {
            return new RankCardConfig
            {
                GuildId = guildId,
                ConfigJson = levelConfig.ConfigJson,
                BackgroundUrl = levelConfig.BackgroundUrl,
                TemplateId = levelConfig.TemplateId,
                Width = 1400,
                Height = 400,
            };
        }

        // Then check base config
        return await _db.RankCardConfigs.FirstOrDefaultAsync(c => c.GuildId == guildId);
    }

    /// <summary>
    /// Generate card from JSON config
    /// </summary>
    private async Task<MemoryStream?> GenerateFromConfigAsync(
        RankCardConfig config,
        string username, string? avatarUrl, int level, long currentXp, long requiredXp, int rank, int totalUsers, string? tier)
    {
        var W = config.Width > 0 ? config.Width : 1400;
        var H = config.Height > 0 ? config.Height : 400;

        using var image = new Image<Rgba32>(W, H);

        // Parse config JSON
        JsonElement root;
        try { root = JsonDocument.Parse(config.ConfigJson).RootElement; }
        catch { return await GenerateHardcodedAsync(username, avatarUrl, level, currentXp, requiredXp, rank, totalUsers, tier); }

        // Background
        if (root.TryGetProperty("background", out var bgEl))
        {
            var bgColor = ParseColor(bgEl.TryGetProperty("color", out var c) ? c.GetString() : "#1a1b1e");
            image.Mutate(ctx => ctx.BackgroundColor(new Color(bgColor)));

            // Background image
            var bgImageUrl = bgEl.TryGetProperty("imageUrl", out var iu) ? iu.GetString() : config.BackgroundUrl;
            if (!string.IsNullOrEmpty(bgImageUrl))
            {
                var bgImg = await LoadRemoteImage(bgImageUrl);
                if (bgImg != null)
                {
                    bgImg.Mutate(ctx => ctx.Resize(W, H));
                    image.Mutate(ctx => ctx.DrawImage(bgImg, new Point(0, 0), 1f));
                    bgImg.Dispose();
                }
            }
        }
        else
        {
            image.Mutate(ctx => ctx.BackgroundColor(new Color(new Rgba32(26, 27, 30))));
        }

        // Render elements
        var progress = requiredXp > 0 ? Math.Min((double)currentXp / requiredXp, 1.0) : 0;
        var totalXp = Services.XpService.CalculateTotalXpForLevel(level) + currentXp;
        var remaining = requiredXp - currentXp;

        var variables = new Dictionary<string, string>
        {
            ["{username}"] = username,
            ["{level}"] = level.ToString(),
            ["{rank}"] = $"#{rank}",
            ["{total_users}"] = totalUsers.ToString(),
            ["{current_xp}"] = FormatNumber(currentXp),
            ["{required_xp}"] = FormatNumber(requiredXp),
            ["{total_xp}"] = FormatNumber(totalXp),
            ["{progress}"] = ((int)(progress * 100)).ToString(),
            ["{remaining_xp}"] = FormatNumber(remaining),
            ["{tier}"] = tier?.ToUpper() ?? "FREE",
        };

        if (root.TryGetProperty("elements", out var elementsEl) && elementsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in elementsEl.EnumerateArray())
            {
                var visible = el.TryGetProperty("visible", out var vis) && vis.GetBoolean();
                if (!visible) continue;

                var type = el.TryGetProperty("type", out var t) ? t.GetString() : "";
                var x = el.TryGetProperty("x", out var xv) ? xv.GetInt32() : 0;
                var y = el.TryGetProperty("y", out var yv) ? yv.GetInt32() : 0;
                var w = el.TryGetProperty("width", out var wv) ? wv.GetInt32() : 100;
                var h = el.TryGetProperty("height", out var hv) ? hv.GetInt32() : 30;

                switch (type)
                {
                    case "avatar":
                        await RenderAvatar(image, el, x, y, w, h, avatarUrl, username);
                        break;
                    case "text":
                        RenderText(image, el, x, y, w, variables);
                        break;
                    case "progress_bar":
                        RenderProgressBar(image, el, x, y, w, h, progress);
                        break;
                }
            }
        }

        var stream = new MemoryStream();
        await image.SaveAsPngAsync(stream);
        stream.Position = 0;
        return stream;
    }

    private async Task RenderAvatar(Image<Rgba32> image, JsonElement el, int x, int y, int w, int h, string? avatarUrl, string username)
    {
        var shape = el.TryGetProperty("shape", out var s) ? s.GetString() : "circle";
        var borderColor = ParseColor(el.TryGetProperty("borderColor", out var bc) ? bc.GetString() : "#2563eb");
        var borderWidth = el.TryGetProperty("borderWidth", out var bw) ? bw.GetInt32() : 4;
        var size = Math.Min(w, h);

        if (shape == "circle")
        {
            // Border circle
            image.Mutate(ctx => ctx.Fill(new Color(borderColor),
                new EllipsePolygon(x + size / 2f, y + size / 2f, size / 2f)));

            var avatar = await LoadRemoteImage(avatarUrl);
            if (avatar != null)
            {
                var innerSize = size - borderWidth * 2;
                avatar.Mutate(ctx => ctx.Resize(innerSize, innerSize));
                using var circled = ClipToCircle(avatar, innerSize);
                image.Mutate(ctx => ctx.DrawImage(circled, new Point(x + borderWidth, y + borderWidth), 1f));
                avatar.Dispose();
            }
            else
            {
                var innerSize = size - borderWidth * 2;
                image.Mutate(ctx => ctx.Fill(new Color(new Rgba32(55, 65, 81)),
                    new EllipsePolygon(x + size / 2f, y + size / 2f, innerSize / 2f)));
                var font = GetFont(size / 3, FontStyle.Bold);
                DrawText(image, username.Length > 0 ? username[..1].ToUpper() : "?", font,
                    Color.White, x + size / 2f, y + size / 2f, HorizontalAlignment.Center, VerticalAlignment.Center);
            }
        }
        else
        {
            // Square avatar
            var avatar = await LoadRemoteImage(avatarUrl);
            if (avatar != null)
            {
                avatar.Mutate(ctx => ctx.Resize(w, h));
                image.Mutate(ctx => ctx.DrawImage(avatar, new Point(x, y), 1f));
                avatar.Dispose();
            }
        }
    }

    private void RenderText(Image<Rgba32> image, JsonElement el, int x, int y, int w, Dictionary<string, string> variables)
    {
        var text = el.TryGetProperty("text", out var t) ? t.GetString() ?? "" : "";
        var fontSize = el.TryGetProperty("fontSize", out var fs) ? fs.GetInt32() : 16;
        var fontWeight = el.TryGetProperty("fontWeight", out var fw) ? fw.GetString() : "normal";
        var color = ParseColor(el.TryGetProperty("color", out var c) ? c.GetString() : "#ffffff");
        var textAlign = el.TryGetProperty("textAlign", out var ta) ? ta.GetString() : "left";

        // Replace variables
        foreach (var (key, val) in variables)
            text = text.Replace(key, val);

        var style = fontWeight == "bold" ? FontStyle.Bold : FontStyle.Regular;
        var font = GetFont(fontSize, style);

        var hAlign = textAlign switch
        {
            "center" => HorizontalAlignment.Center,
            "right" => HorizontalAlignment.Right,
            _ => HorizontalAlignment.Left
        };

        var originX = hAlign switch
        {
            HorizontalAlignment.Center => x + w / 2f,
            HorizontalAlignment.Right => x + w,
            _ => (float)x
        };

        DrawText(image, text, font, new Color(color), originX, y, hAlign, VerticalAlignment.Top, w);
    }

    private void RenderProgressBar(Image<Rgba32> image, JsonElement el, int x, int y, int w, int h, double progress)
    {
        var bgColor = ParseColor(el.TryGetProperty("barBgColor", out var bg) ? bg.GetString() : "#374151");
        var fillColor = ParseColor(el.TryGetProperty("barFillColor", out var fc) ? fc.GetString() : "#2563eb");

        // Background
        image.Mutate(ctx => ctx.Fill(new Color(bgColor), new RectangularPolygon(x, y, w, h)));

        // Fill
        var fillW = (int)(w * progress);
        if (fillW > 0)
            image.Mutate(ctx => ctx.Fill(new Color(fillColor), new RectangularPolygon(x, y, fillW, h)));
    }

    // ============================================
    // HARDCODED FALLBACK (original)
    // ============================================

    private async Task<MemoryStream?> GenerateHardcodedAsync(
        string username, string? avatarUrl, int level, long currentXp, long requiredXp, int rank, int totalUsers, string? tier)
    {
        var W = 1400; var H = 400;
        using var image = new Image<Rgba32>(W, H);

        var BgDark = new Rgba32(23, 25, 30);
        var BgCard = new Rgba32(32, 34, 39);
        var TextWhite = new Rgba32(255, 255, 255);
        var TextGray = new Rgba32(148, 163, 184);
        var BarBg = new Rgba32(55, 65, 81);
        var AccentBlue = new Rgba32(37, 99, 235);
        var AccentGreen = new Rgba32(34, 197, 94);

        var TierColors = new Dictionary<string, Rgba32>
        {
            ["supporter"] = new Rgba32(59, 130, 246),
            ["premium"] = new Rgba32(168, 85, 247),
            ["fundador"] = new Rgba32(245, 158, 11),
        };

        image.Mutate(ctx => ctx.BackgroundColor(new Color(BgDark)));
        image.Mutate(ctx => ctx.Fill(new Color(BgCard), new RectangularPolygon(16, 16, W - 32, H - 32)));

        var accentColor = tier != null && TierColors.TryGetValue(tier, out var tc) ? tc : AccentBlue;
        image.Mutate(ctx => ctx.Fill(new Color(accentColor), new RectangularPolygon(16, 16, 4, H - 32)));

        // Avatar
        var avSize = 280;
        var avX = 60;
        var avY = (H - avSize) / 2;

        image.Mutate(ctx => ctx.Fill(new Color(BarBg), new EllipsePolygon(avX + avSize / 2f, avY + avSize / 2f, avSize / 2f + 3)));

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
            image.Mutate(ctx => ctx.Fill(new Color(AccentBlue), new EllipsePolygon(avX + avSize / 2f, avY + avSize / 2f, avSize / 2f)));
            DrawText(image, username.Length > 0 ? username[..1].ToUpper() : "?", GetFont(80, FontStyle.Bold),
                Color.White, avX + avSize / 2f, avY + avSize / 2f, HorizontalAlignment.Center, VerticalAlignment.Center);
        }

        var contentX = avX + avSize + 50;
        var contentW = W - contentX - 50;

        DrawText(image, username, GetFont(36, FontStyle.Bold), new Color(TextWhite), contentX, 80, HorizontalAlignment.Left, VerticalAlignment.Top, contentW - 250);
        DrawText(image, $"LVL {level}", GetFont(40, FontStyle.Bold), new Color(accentColor), W - 70, 80, HorizontalAlignment.Right, VerticalAlignment.Top);
        DrawText(image, rank > 0 ? $"#{rank} / {totalUsers}" : "", GetFont(18, FontStyle.Regular), new Color(TextGray), contentX, 130, HorizontalAlignment.Left, VerticalAlignment.Top);

        // Progress bar
        var barY = 200; var barH = 30;
        image.Mutate(ctx => ctx.Fill(new Color(BarBg), new RectangularPolygon(contentX, barY, contentW, barH)));
        var progress = requiredXp > 0 ? Math.Min((double)currentXp / requiredXp, 1.0) : 0;
        var fillW = (int)(contentW * progress);
        if (fillW > 0)
            image.Mutate(ctx => ctx.Fill(new Color(accentColor), new RectangularPolygon(contentX, barY, fillW, barH)));

        DrawText(image, $"{FormatNumber(currentXp)} / {FormatNumber(requiredXp)} XP", GetFont(14, FontStyle.Bold), new Color(TextWhite),
            contentX + contentW / 2f, barY + barH / 2f, HorizontalAlignment.Center, VerticalAlignment.Center);

        var statsY = barY + barH + 30;
        var totalXp = Services.XpService.CalculateTotalXpForLevel(level) + currentXp;
        DrawText(image, "TOTAL XP", GetFont(12, FontStyle.Regular), new Color(TextGray), contentX, statsY, HorizontalAlignment.Left, VerticalAlignment.Top);
        DrawText(image, FormatNumber(totalXp), GetFont(20, FontStyle.Bold), new Color(TextWhite), contentX, statsY + 20, HorizontalAlignment.Left, VerticalAlignment.Top);

        DrawText(image, "PROGRESO", GetFont(12, FontStyle.Regular), new Color(TextGray), contentX + contentW / 3f, statsY, HorizontalAlignment.Left, VerticalAlignment.Top);
        DrawText(image, $"{(int)(progress * 100)}%", GetFont(20, FontStyle.Bold), new Color(AccentGreen), contentX + contentW / 3f, statsY + 20, HorizontalAlignment.Left, VerticalAlignment.Top);

        DrawText(image, "SIGUIENTE", GetFont(12, FontStyle.Regular), new Color(TextGray), contentX + contentW * 2f / 3f, statsY, HorizontalAlignment.Left, VerticalAlignment.Top);
        DrawText(image, $"{FormatNumber(requiredXp - currentXp)} XP", GetFont(20, FontStyle.Bold), new Color(TextWhite), contentX + contentW * 2f / 3f, statsY + 20, HorizontalAlignment.Left, VerticalAlignment.Top);

        DrawText(image, "Decatron Bot • twitch.decatron.net", GetFont(12, FontStyle.Regular), new Color(new Rgba32(100, 116, 139)),
            W / 2f, H - 15, HorizontalAlignment.Center, VerticalAlignment.Center);

        var stream = new MemoryStream();
        await image.SaveAsPngAsync(stream);
        stream.Position = 0;
        return stream;
    }

    // ============================================
    // HELPERS
    // ============================================

    private static Rgba32 ParseColor(string? hex)
    {
        if (string.IsNullOrEmpty(hex)) return new Rgba32(255, 255, 255);
        hex = hex.TrimStart('#');
        if (hex.Length == 6)
            return new Rgba32(
                Convert.ToByte(hex[..2], 16),
                Convert.ToByte(hex[2..4], 16),
                Convert.ToByte(hex[4..6], 16));
        return new Rgba32(255, 255, 255);
    }

    private static void DrawText(Image<Rgba32> image, string text, Font font, Color color,
        float x, float y, HorizontalAlignment hAlign, VerticalAlignment vAlign, float? maxWidth = null)
    {
        var opts = new RichTextOptions(font)
        {
            Origin = new System.Numerics.Vector2(x, y),
            HorizontalAlignment = hAlign,
            VerticalAlignment = vAlign,
        };
        if (maxWidth.HasValue) opts.WrappingLength = maxWidth.Value;
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
            if (url.StartsWith("/")) url = $"https://twitch.decatron.net{url}";
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
