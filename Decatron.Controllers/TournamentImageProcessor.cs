using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace Decatron.Controllers
{
    /// <summary>
    /// Capturas y justificantes de torneos (.dev/torneos/15-fortnite.md F4): se
    /// vuelven a codificar como JPEG para validar que sean imagenes de verdad y
    /// quitarles los metadatos. Vive aca porque ImageSharp esta en el proyecto web,
    /// no en Decatron.Business.
    /// </summary>
    public static class TournamentImageProcessor
    {
        public const long MaxBytes = 10 * 1024 * 1024;
        private const int MaxWidth = 2560;

        public static async Task<(byte[]? jpeg, string? error)> ToJpegAsync(IFormFile file, CancellationToken ct = default)
        {
            if (file.Length <= 0) return (null, "El archivo está vacío");
            if (file.Length > MaxBytes) return (null, "La imagen pesa más de 10 MB");

            await using var input = file.OpenReadStream();
            Image image;
            try { image = await Image.LoadAsync(input, ct); }
            catch { return (null, "El archivo no es una imagen válida (usa PNG, JPG o WEBP)"); }

            using (image)
            {
                image.Metadata.ExifProfile = null;
                image.Metadata.XmpProfile = null;
                if (image.Width > MaxWidth)
                    image.Mutate(x => x.Resize(MaxWidth, 0));

                using var output = new MemoryStream();
                await image.SaveAsJpegAsync(output, new JpegEncoder { Quality = 90 }, ct);
                return (output.ToArray(), null);
            }
        }
    }
}
