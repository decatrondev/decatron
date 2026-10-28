using System;
using System.IO;

namespace Decatron.Services.Promo
{
    /// <summary>Dónde viven las imágenes de las tarjetas propias: <c>ClientApp/public/timerextensible/{canal}/promo/{guid}.webp</c> (la biblioteca de medios), con nombre aleatorio.</summary>
    public static class PromoCardImageFiles
    {
        public const string Category = "promo";

        public static string Root(string contentRoot) => Path.Combine(contentRoot, "ClientApp", "public", "timerextensible");

        public static string Folder(string contentRoot, string channel) => Path.Combine(Root(contentRoot), channel, Category);

        public static string NewFileName() => Guid.NewGuid().ToString("N") + ".webp";

        public static string PublicUrl(string channel, string fileName) => $"/timerextensible/{channel}/{Category}/{fileName}";

        /// <summary>Borra el archivo solo si está dentro de la biblioteca de medios (nunca una ruta de otra parte). Nunca lanza.</summary>
        public static void TryDelete(string contentRoot, string? path)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(path)) return;
                var root = Path.GetFullPath(Root(contentRoot)) + Path.DirectorySeparatorChar;
                var full = Path.GetFullPath(path);
                if (full.StartsWith(root, StringComparison.Ordinal) && File.Exists(full)) File.Delete(full);
            }
            catch (Exception) { /* el archivo huérfano no rompe nada */ }
        }
    }
}
