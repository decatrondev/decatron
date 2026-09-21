using System;
namespace Decatron.Core.Helpers
{
    /// <summary>
    /// Convierte rutas de archivo del disco a la ruta pública que sirve
    /// ClientApp/public — usado por cualquier controller que dispare media
    /// hacia el overlay (Sound Alerts, y ahora la API pública de Decatron).
    /// Antes vivía duplicado como métodos privados en SoundAlertsController.
    /// </summary>
    public static class MediaPathHelpers
    {
        public static string ToPublicPath(string filePath)
        {
            if (string.IsNullOrEmpty(filePath)) return "";

            var ruta = filePath.Replace("\\", "/");

            // Ya es una URL (http, //cdn, o una ruta publica): se deja como está.
            if (ruta.StartsWith("http://") || ruta.StartsWith("https://") || ruta.StartsWith("//"))
                return ruta;

            // Se corta TODO lo anterior a ClientApp/public, no solo ese trozo.
            //
            // Antes esto era un Replace("ClientApp/public", ""), que funcionaba solo si
            // la ruta venía relativa. Pero 111 de las 140 filas de timer_media_files
            // guardan la ruta absoluta del servidor, y ahí el Replace dejaba el prefijo
            // del disco pegado delante:
            //   /var/www/.../decatron/ClientApp/public/timerextensible/x/y.gif
            //   -> /var/www/.../decatron//timerextensible/x/y.gif   (URL rota)
            // El navegador pedía esa ruta, recibía el index.html del SPA y la imagen
            // no aparecía nunca.
            const string marca = "ClientApp/public";
            var i = ruta.IndexOf(marca, StringComparison.Ordinal);
            if (i >= 0) ruta = ruta[(i + marca.Length)..];

            if (!ruta.StartsWith("/")) ruta = "/" + ruta;

            // Las barras repetidas que dejaba el Replace viejo tampoco resuelven.
            while (ruta.Contains("//")) ruta = ruta.Replace("//", "/");

            return ruta;
        }

        /// <summary>Los archivos de sistema no tienen fila de BD con FileType — se infiere de la carpeta (sounds/videos/images).</summary>
        public static string InferSystemFileType(string systemFilePath)
        {
            if (systemFilePath.Contains("/sounds/")) return "sound";
            if (systemFilePath.Contains("/videos/")) return "video";
            if (systemFilePath.Contains("/images/")) return "image";
            return "sound";
        }
    }
}
