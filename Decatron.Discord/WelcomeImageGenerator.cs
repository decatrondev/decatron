using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using SixLabors.Fonts;

namespace Decatron.Discord;

public class WelcomeImageGenerator
{
    private readonly ILogger<WelcomeImageGenerator> _logger;
    private readonly HttpClient _httpClient;

    // Mismas dimensiones que el canvas frontend default
    private const int W = 1024;
    private const int H = 500;
    private const string DEFAULT_BG = "/system-files/images/welcome-templates/gaming-neon.png";

    public WelcomeImageGenerator(ILogger<WelcomeImageGenerator> logger, IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient();
    }

    public async Task<MemoryStream?> GenerateImage(
        string? backgroundImagePath,
        string avatarUrl,
        string displayName,
        string guildName,
        string message,
        string embedColor,
        bool showAvatar)
    {
        try
        {
            using var image = new Image<Rgba32>(W, H);

            // 1. Fondo oscuro base
            image.Mutate(ctx => ctx.BackgroundColor(new Color(new Rgba32(43, 45, 49))));

            // 2. Imagen de fondo (cover)
            var bgPath = backgroundImagePath ?? DEFAULT_BG;
            var bgImg = await LoadLocalImage(bgPath);
            if (bgImg != null)
            {
                bgImg.Mutate(ctx => ctx.Resize(new ResizeOptions { Size = new Size(W, H), Mode = ResizeMode.Crop }));
                image.Mutate(ctx => ctx.DrawImage(bgImg, new Point(0, 0), 1f));
                bgImg.Dispose();

                // Overlay oscuro para legibilidad del texto
                image.Mutate(ctx => ctx.Fill(new Color(new Rgba32(0, 0, 0, 90)),
                    new RectangularPolygon(0, 0, W, H)));
            }

            // 3. Barra de color accent arriba
            var accentColor = ParseColor(embedColor, new Rgba32(34, 197, 94));
            image.Mutate(ctx => ctx.Fill(new Color(accentColor),
                new RectangularPolygon(0, 0, W, 4)));

            // Layout centrado identico al canvas frontend:
            // Avatar: centrado horizontalmente, y=35, size=160
            // Texto: centrado, y=230, ancho casi total
            // Subtexto: centrado, y=340
            // Footer: centrado, y=410

            float centerX = W / 2f;

            // 4. Avatar en circulo — CENTRADO, grande
            if (showAvatar)
            {
                var avSize = 140;
                var avY = 35;
                var avatar = await LoadRemoteImage(avatarUrl);

                // Borde blanco circulo
                image.Mutate(ctx => ctx.Fill(new Color(new Rgba32(255, 255, 255, 230)),
                    new EllipsePolygon(centerX, avY + avSize / 2f, avSize / 2f + 4)));

                if (avatar != null)
                {
                    avatar.Mutate(ctx => ctx.Resize(avSize, avSize));
                    using var circled = ClipToCircle(avatar, avSize);
                    image.Mutate(ctx => ctx.DrawImage(circled,
                        new Point((int)(centerX - avSize / 2f), avY), 1f));
                    avatar.Dispose();
                }
                else
                {
                    // Placeholder
                    image.Mutate(ctx => ctx.Fill(new Color(new Rgba32(88, 101, 242)),
                        new EllipsePolygon(centerX, avY + avSize / 2f, avSize / 2f)));
                    var pFont = GetFont(60, FontStyle.Bold);
                    DrawCenteredText(image, displayName[..1].ToUpper(), pFont, Color.White,
                        centerX, avY + avSize / 2f, 200, false);
                }
            }

            // 5. Texto principal — CENTRADO, grande, bold, con sombra
            var msgFont = GetFont(40, FontStyle.Bold);
            var msgY = showAvatar ? 260f : 180f;
            DrawCenteredText(image, message, msgFont, Color.White, centerX, msgY, W - 60, true);

            // 6. Subtexto (nombre del servidor) — centrado debajo
            var subFont = GetFont(22, FontStyle.Regular);
            var subY = showAvatar ? 360f : 300f;
            DrawCenteredText(image, guildName, subFont,
                new Color(new Rgba32(255, 255, 255, 180)), centerX, subY, W - 100, false);

            // 7. Footer — centrado abajo
            var footerFont = GetFont(14, FontStyle.Regular);
            DrawCenteredText(image, $"{guildName} • Decatron Bot", footerFont,
                new Color(new Rgba32(255, 255, 255, 130)), centerX, H - 25f, W - 100, false);

            // Export
            var stream = new MemoryStream();
            await image.SaveAsPngAsync(stream);
            stream.Position = 0;
            return stream;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating welcome image");
            return null;
        }
    }

    // ============================================
    // HELPERS
    // ============================================

    private static void DrawCenteredText(Image<Rgba32> image, string text, Font font, Color color,
        float cx, float cy, float maxWidth, bool shadow)
    {
        if (shadow)
        {
            var shadowOpts = new RichTextOptions(font)
            {
                Origin = new System.Numerics.Vector2(cx + 2, cy + 2),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                WrappingLength = maxWidth,
            };
            image.Mutate(ctx => ctx.DrawText(shadowOpts, text, new Color(new Rgba32(0, 0, 0, 180))));
        }

        var opts = new RichTextOptions(font)
        {
            Origin = new System.Numerics.Vector2(cx, cy),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            WrappingLength = maxWidth,
        };
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

    private async Task<Image<Rgba32>?> LoadLocalImage(string path)
    {
        try
        {
            var localPath = path.StartsWith("/")
                ? System.IO.Path.Combine("/var/www/html/decatron/Decatron/decatron/ClientApp/public", path.TrimStart('/'))
                : path;
            if (!File.Exists(localPath))
                localPath = System.IO.Path.Combine("ClientApp", "public", path.TrimStart('/'));
            if (!File.Exists(localPath)) return null;
            return await Image.LoadAsync<Rgba32>(localPath);
        }
        catch { return null; }
    }

    private async Task<Image<Rgba32>?> LoadRemoteImage(string url)
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

    private static Rgba32 ParseColor(string hex, Rgba32 fallback)
    {
        try
        {
            hex = hex.TrimStart('#');
            if (hex.Length == 6)
                return new Rgba32(
                    Convert.ToByte(hex[..2], 16),
                    Convert.ToByte(hex[2..4], 16),
                    Convert.ToByte(hex[4..6], 16));
        }
        catch { }
        return fallback;
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
}
