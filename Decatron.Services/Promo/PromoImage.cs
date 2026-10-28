using System;
using System.IO;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace Decatron.Services.Promo
{
    /// <summary>
    /// Imagen de una tarjeta propia (Fase 5): solo PNG, JPG o WebP reales (se mira el contenido, no la extensión; sin SVG ni GIF), hasta 1 MB y
    /// 1024 px por lado, y siempre se vuelve a codificar a WebP, lo que descarta metadatos y cualquier cosa escondida en el archivo.
    /// </summary>
    public static class PromoImage
    {
        public const long MaxBytes = 1024 * 1024;
        public const int MaxSide = 1024;
        /// <summary>Tope de lo que se acepta decodificar (evita imágenes diminutas en bytes pero enormes en píxeles).</summary>
        public const int MaxSourceSide = 4096;

        public record Result(byte[]? Webp, int Width, int Height, string? Error);

        /// <summary>Procesa lo subido. Error (código para traducir): empty, tooLarge, notImage, tooBig. Nunca lanza por un archivo corrupto.</summary>
        public static Result Process(Stream input, long length)
        {
            if (length <= 0) return new Result(null, 0, 0, "empty");
            if (length > MaxBytes) return new Result(null, 0, 0, "tooLarge");
            try
            {
                using var buffer = new MemoryStream();
                input.CopyTo(buffer);
                buffer.Position = 0;
                var info = Image.Identify(buffer);
                if (info == null) return new Result(null, 0, 0, "notImage");
                var format = Image.DetectFormat(buffer.ToArray());
                if (format is not (SixLabors.ImageSharp.Formats.Png.PngFormat or SixLabors.ImageSharp.Formats.Jpeg.JpegFormat or WebpFormat))
                    return new Result(null, 0, 0, "notImage");
                if (info.Width > MaxSourceSide || info.Height > MaxSourceSide) return new Result(null, 0, 0, "tooBig");

                buffer.Position = 0;
                using var image = Image.Load(buffer);
                image.Mutate(c => c.AutoOrient());
                if (image.Width > MaxSide || image.Height > MaxSide)
                    image.Mutate(c => c.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(MaxSide, MaxSide) }));
                image.Metadata.ExifProfile = null; image.Metadata.IccProfile = null; image.Metadata.IptcProfile = null; image.Metadata.XmpProfile = null;
                using var output = new MemoryStream();
                image.Save(output, new WebpEncoder { Quality = 85 });
                return new Result(output.ToArray(), image.Width, image.Height, null);
            }
            catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException or ImageFormatException)
            {
                return new Result(null, 0, 0, "notImage");
            }
        }
    }
}
