using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Text.RegularExpressions;
using System.Runtime.InteropServices;

namespace Decatron.Services
{
    /// <summary>
    /// Servicio para descargar clips de Twitch usando yt-dlp
    /// </summary>
    public class ClipDownloadService
    {
        private readonly ILogger<ClipDownloadService> _logger;
        private readonly string _downloadsPath;
        private readonly string _ytDlpCommand;

        public ClipDownloadService(ILogger<ClipDownloadService> logger)
        {
            _logger = logger;

            // Detectar sistema operativo y configurar comando yt-dlp
            _ytDlpCommand = GetYtDlpCommand();
            _logger.LogInformation($"Sistema detectado: {GetOSName()}, usando comando: {_ytDlpCommand}");

            // Ruta para React: ClientApp/public/downloads
            var projectRoot = Directory.GetCurrentDirectory();
            _downloadsPath = Path.Combine(projectRoot, "ClientApp", "public", "downloads");

            // Crear directorio si no existe
            if (!Directory.Exists(_downloadsPath))
            {
                Directory.CreateDirectory(_downloadsPath);
                _logger.LogInformation($"Directorio de descargas creado: {_downloadsPath}");
            }
        }

        private string GetYtDlpCommand()
        {
            var projectRoot = Directory.GetCurrentDirectory();

            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                // En Windows: primero intentar yt-dlp.exe en la raíz del proyecto
                var localExe = Path.Combine(projectRoot, "yt-dlp.exe");
                if (File.Exists(localExe))
                {
                    _logger.LogInformation($"Usando yt-dlp.exe local: {localExe}");
                    return localExe;
                }
                // Si no existe, usar el del PATH
                return "yt-dlp.exe";
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                // En Linux: usar yt-dlp del PATH
                return "yt-dlp";
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            {
                // En macOS: usar yt-dlp del PATH
                return "yt-dlp";
            }

            // Fallback
            return "yt-dlp";
        }

        private string GetOSName()
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return "Windows";
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux)) return "Linux";
            if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX)) return "macOS";
            return "Unknown";
        }

        /// <summary>
        /// Descarga un clip de Twitch si no existe
        /// </summary>
        /// <param name="clipUrl">URL del clip de Twitch</param>
        /// <param name="username">Nombre del usuario del canal</param>
        /// <returns>Ruta local del clip descargado o null si falla</returns>
        public async Task<ClipDownloadResult> DownloadClipAsync(string clipUrl, string username)
        {
            try
            {
                // Validar URL - solo permitir URLs de Twitch clips
                if (!System.Text.RegularExpressions.Regex.IsMatch(clipUrl ?? "", @"^https://(clips\.twitch\.tv|www\.twitch\.tv/[^/]+/clip)/[A-Za-z0-9_-]+$"))
                {
                    _logger.LogWarning("URL de clip rechazada por validación: {Url}", clipUrl);
                    return new ClipDownloadResult { Success = false, Error = "URL de clip inválida" };
                }

                // Sanitizar username para evitar path traversal
                username = System.Text.RegularExpressions.Regex.Replace(username ?? "", @"[^a-zA-Z0-9_]", "");

                // Extraer ID del clip de la URL
                var clipId = ExtractClipId(clipUrl);
                if (string.IsNullOrEmpty(clipId))
                {
                    _logger.LogWarning($"No se pudo extraer ID del clip de: {clipUrl}");
                    return new ClipDownloadResult { Success = false, Error = "URL de clip inválida" };
                }

                // Crear directorio del usuario si no existe
                var userDir = Path.Combine(_downloadsPath, username.ToLower());
                if (!Directory.Exists(userDir))
                {
                    Directory.CreateDirectory(userDir);
                    _logger.LogInformation($"Directorio creado: {userDir}");
                }

                // Verificar si el clip ya existe
                var fileName = $"clip_{clipId}.mp4";
                var filePath = Path.Combine(userDir, fileName);

                if (File.Exists(filePath))
                {
                    _logger.LogInformation($"✅ Clip ya existe: {filePath}");
                    var relativePath = $"/downloads/{username.ToLower()}/{fileName}";
                    return new ClipDownloadResult
                    {
                        Success = true,
                        LocalPath = relativePath,
                        ClipId = clipId,
                        WasDownloaded = false
                    };
                }

                // Descargar con yt-dlp
                _logger.LogInformation($"📥 Descargando clip: {clipUrl} -> {filePath}");

                var startInfo = new ProcessStartInfo
                {
                    FileName = _ytDlpCommand,
                    Arguments = $"-f best -o \"{filePath}\" \"{clipUrl}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = new Process { StartInfo = startInfo };
                process.Start();

                var output = await process.StandardOutput.ReadToEndAsync();
                var error = await process.StandardError.ReadToEndAsync();

                await process.WaitForExitAsync();

                if (process.ExitCode != 0)
                {
                    _logger.LogError($"❌ Error descargando clip: {error}");
                    return new ClipDownloadResult
                    {
                        Success = false,
                        Error = $"yt-dlp error: {error}"
                    };
                }

                if (!File.Exists(filePath))
                {
                    _logger.LogError($"❌ Clip no se descargó correctamente: {filePath}");
                    return new ClipDownloadResult
                    {
                        Success = false,
                        Error = "Archivo no creado después de descarga"
                    };
                }

                var fileInfo = new FileInfo(filePath);
                _logger.LogInformation($"✅ Clip descargado exitosamente: {filePath} ({fileInfo.Length / 1024} KB)");

                var relativePathResult = $"/downloads/{username.ToLower()}/{fileName}";
                return new ClipDownloadResult
                {
                    Success = true,
                    LocalPath = relativePathResult,
                    ClipId = clipId,
                    WasDownloaded = true
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error en DownloadClipAsync: {clipUrl}");
                return new ClipDownloadResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        /// <summary>
        /// Extrae el ID del clip de una URL de Twitch
        /// Ejemplos:
        /// - https://clips.twitch.tv/ClipID
        /// - https://www.twitch.tv/username/clip/ClipID
        /// </summary>
        private string? ExtractClipId(string clipUrl)
        {
            try
            {
                // Patrón para clips.twitch.tv/ClipID
                var match1 = Regex.Match(clipUrl, @"clips\.twitch\.tv/([A-Za-z0-9_-]+)");
                if (match1.Success)
                {
                    return match1.Groups[1].Value;
                }

                // Patrón para twitch.tv/user/clip/ClipID
                var match2 = Regex.Match(clipUrl, @"twitch\.tv/[^/]+/clip/([A-Za-z0-9_-]+)");
                if (match2.Success)
                {
                    return match2.Groups[1].Value;
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error extrayendo ID de clip: {clipUrl}");
                return null;
            }
        }

        /// <summary>
        /// Verifica si yt-dlp está instalado
        /// </summary>
        public async Task<bool> IsYtDlpInstalledAsync()
        {
            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = _ytDlpCommand,
                    Arguments = "--version",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = new Process { StartInfo = startInfo };
                process.Start();
                await process.WaitForExitAsync();

                var isInstalled = process.ExitCode == 0;
                if (isInstalled)
                {
                    var version = await process.StandardOutput.ReadToEndAsync();
                    _logger.LogInformation($"✅ yt-dlp disponible: {version.Trim()}");
                }
                else
                {
                    _logger.LogWarning($"⚠️ yt-dlp NO disponible o no funciona correctamente");
                }

                return isInstalled;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error verificando yt-dlp");
                return false;
            }
        }
    }

    public class ClipDownloadResult
    {
        public bool Success { get; set; }
        public string? LocalPath { get; set; }
        public string? ClipId { get; set; }
        public bool WasDownloaded { get; set; }
        public string? Error { get; set; }
    }
}
