using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Gif;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace Decatron.Services.Emotes
{
    /// <summary>El archivo subido no sirve como emote; <see cref="Code"/> dice por qué (clave para la interfaz)</summary>
    public sealed class EmoteImageException : Exception
    {
        public string Code { get; }
        public EmoteImageException(string code) : base(code) => Code = code;
    }

    public sealed record ProcessedEmote(int Width, int Height, bool Animated, IReadOnlyDictionary<int, byte[]> Files)
    {
        public int TotalBytes => Files.Values.Sum(f => f.Length);
    }

    /// <summary>
    /// Valida y convierte la imagen de un emote: se mira el contenido real (no la extensión), se acotan peso,
    /// tamaño y cuadros, y se generan tres tamaños en WebP (1x, 2x y 4x) sin metadatos. Las animaciones se
    /// conservan. Plan: .dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 3.
    /// </summary>
    public static class EmoteImageProcessor
    {
        public const int MaxInputBytes = 2 * 1024 * 1024;
        public const int MaxSourceSide = 2048;
        public const int MinSide = 8;
        public const int MaxFrames = 150;
        /// <summary>Ancho × alto × cuadros que se aceptan decodificar (cuida la memoria del servidor)</summary>
        public const long MaxPixelBudget = 120_000_000;

        /// <summary>Alto de cada tamaño; el ancho puede llegar a 4 veces el alto (emotes anchos)</summary>
        public static readonly IReadOnlyDictionary<int, int> SizeHeights = new Dictionary<int, int> { [1] = 32, [2] = 64, [4] = 128 };
        private const int MaxAspect = 4;

        // Se transforman de a pocos a la vez: cada decodificación de una animación puede pesar cientos de MB
        private static readonly SemaphoreSlim Gate = new(2, 2);

        public static async Task<ProcessedEmote> ProcessAsync(Stream input, CancellationToken ct = default)
        {
            if (input.CanSeek && input.Length > MaxInputBytes) throw new EmoteImageException("too_large");
            using var ms = new MemoryStream();
            await input.CopyToAsync(ms, ct);
            if (ms.Length > MaxInputBytes) throw new EmoteImageException("too_large");
            if (ms.Length < 16) throw new EmoteImageException("invalid_image");
            var bytes = ms.ToArray();

            ImageInfo info;
            try { info = Image.Identify(bytes); }
            catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
            {
                throw new EmoteImageException("unsupported_format");
            }

            var format = info.Metadata.DecodedImageFormat;
            if (format is not (GifFormat or PngFormat or WebpFormat or JpegFormat)) throw new EmoteImageException("unsupported_format");
            if (info.Width < MinSide || info.Height < MinSide) throw new EmoteImageException("too_small");
            if (info.Width > MaxSourceSide || info.Height > MaxSourceSide) throw new EmoteImageException("too_big_dimensions");
            var frames = Math.Max(1, info.FrameMetadataCollection.Count);
            if (frames > MaxFrames) throw new EmoteImageException("too_many_frames");
            if ((long)info.Width * info.Height * frames > MaxPixelBudget) throw new EmoteImageException("too_big_dimensions");

            await Gate.WaitAsync(ct);
            try
            {
                return await Task.Run(() => Convert(bytes, frames > 1), ct);
            }
            finally
            {
                Gate.Release();
            }
        }

        private static ProcessedEmote Convert(byte[] bytes, bool animated)
        {
            Image source;
            try
            {
                source = Image.Load<Rgba32>(new DecoderOptions { MaxFrames = MaxFrames }, bytes);
            }
            catch (Exception ex) when (ex is InvalidImageContentException or UnknownImageFormatException or NotSupportedException or InvalidOperationException)
            {
                throw new EmoteImageException("invalid_image");
            }

            using (source)
            {
                var files = new Dictionary<int, byte[]>();
                int outW = 0, outH = 0;

                foreach (var (scale, targetHeight) in SizeHeights.OrderBy(k => k.Key))
                {
                    using var copy = source.Clone(ctx => { });
                    // Nunca se agranda: un emote chico queda del tamaño que tiene en los tamaños grandes
                    var boxW = targetHeight * MaxAspect;
                    var ratio = Math.Min(1.0, Math.Min((double)targetHeight / copy.Height, (double)boxW / copy.Width));
                    var w = Math.Max(1, (int)Math.Round(copy.Width * ratio));
                    var h = Math.Max(1, (int)Math.Round(copy.Height * ratio));
                    if (w != copy.Width || h != copy.Height)
                        copy.Mutate(x => x.Resize(w, h, KnownResamplers.Lanczos3));

                    // Sin metadatos (EXIF, ubicación, comentarios): lo que se sirve es solo la imagen
                    copy.Metadata.ExifProfile = null;
                    copy.Metadata.IccProfile = null;
                    copy.Metadata.XmpProfile = null;
                    foreach (var frame in copy.Frames) { frame.Metadata.ExifProfile = null; }

                    using var output = new MemoryStream();
                    var encoder = animated
                        ? new WebpEncoder { FileFormat = WebpFileFormatType.Lossy, Quality = 88, SkipMetadata = true }
                        : new WebpEncoder { FileFormat = WebpFileFormatType.Lossless, SkipMetadata = true };
                    copy.Save(output, encoder);
                    files[scale] = output.ToArray();
                    if (scale == 4) { outW = w; outH = h; }
                }

                return new ProcessedEmote(outW, outH, animated, files);
            }
        }
    }
}
