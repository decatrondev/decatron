using System.IO;
using System.Text;
using Decatron.Services.Promo;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Gif;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Metadata.Profiles.Exif;
using SixLabors.ImageSharp.PixelFormats;
using Xunit;

namespace Decatron.Tests;

/// <summary>Imagen de una tarjeta propia (Fase 5): solo PNG/JPG/WebP reales, límites de tamaño, siempre WebP sin metadatos.</summary>
public class PromoImageTests
{
    private static byte[] Make(int w, int h, SixLabors.ImageSharp.Formats.IImageEncoder enc, bool exif = false)
    {
        using var img = new Image<Rgba32>(w, h, new Rgba32(30, 120, 255));
        if (exif) { img.Metadata.ExifProfile = new ExifProfile(); img.Metadata.ExifProfile.SetValue(ExifTag.Software, "secreto"); }
        using var ms = new MemoryStream();
        img.Save(ms, enc);
        return ms.ToArray();
    }

    private static PromoImage.Result Run(byte[] bytes) => PromoImage.Process(new MemoryStream(bytes), bytes.Length);

    [Fact(DisplayName = "Promo imagen: un PNG grande se reduce a 1024 px conservando la proporción y sale en WebP")]
    public void Png_IsResizedToWebp()
    {
        var r = Run(Make(2000, 1000, new PngEncoder()));
        Assert.Null(r.Error);
        Assert.Equal((1024, 512), (r.Width, r.Height));
        Assert.IsType<WebpFormat>(Image.DetectFormat(r.Webp!));
    }

    [Theory(DisplayName = "Promo imagen: JPG y WebP también se aceptan")]
    [InlineData("jpg")]
    [InlineData("webp")]
    public void JpgAndWebp_Accepted(string kind)
    {
        var bytes = kind == "jpg" ? Make(300, 200, new JpegEncoder()) : Make(300, 200, new WebpEncoder());
        var r = Run(bytes);
        Assert.Null(r.Error);
        Assert.Equal((300, 200), (r.Width, r.Height));
    }

    [Fact(DisplayName = "Promo imagen: los metadatos (EXIF) no sobreviven")]
    public void Exif_IsStripped()
    {
        var r = Run(Make(200, 200, new JpegEncoder(), exif: true));
        Assert.Null(r.Error);
        using var back = Image.Load(r.Webp!);
        Assert.Null(back.Metadata.ExifProfile);
    }

    [Fact(DisplayName = "Promo imagen: GIF, SVG y texto con extensión de imagen se rechazan por su contenido")]
    public void NonImages_Rejected()
    {
        Assert.Equal("notImage", Run(Make(50, 50, new GifEncoder())).Error);
        Assert.Equal("notImage", Run(Encoding.UTF8.GetBytes("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")).Error);
        Assert.Equal("notImage", Run(Encoding.UTF8.GetBytes("esto no es una imagen")).Error);
        Assert.Equal("notImage", Run(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0, 0, 0 }).Error); // cabecera de PNG truncada
    }

    [Fact(DisplayName = "Promo imagen: vacío, más de 1 MB y demasiados píxeles se rechazan con su código")]
    public void Limits_Rejected()
    {
        Assert.Equal("empty", PromoImage.Process(new MemoryStream(), 0).Error);
        var big = new byte[PromoImage.MaxBytes + 1];
        Assert.Equal("tooLarge", PromoImage.Process(new MemoryStream(big), big.Length).Error);
        Assert.Equal("tooBig", Run(Make(5000, 20, new PngEncoder())).Error);
    }
}
