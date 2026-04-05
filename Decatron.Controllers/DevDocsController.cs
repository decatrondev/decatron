using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Decatron.Attributes;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/admin/dev-docs")]
    [Authorize]
    [RequireSystemOwner]
    public class DevDocsController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        private readonly string _devRoot;

        public DevDocsController(IWebHostEnvironment env)
        {
            _env = env;
            _devRoot = Path.Combine(env.ContentRootPath, ".dev");
        }

        /// <summary>
        /// Lista carpetas y archivos .md en una ruta relativa dentro de .dev/
        /// </summary>
        [HttpGet("browse")]
        public IActionResult Browse([FromQuery] string path = "")
        {
            var safePath = SanitizePath(path);
            var fullPath = Path.Combine(_devRoot, safePath);

            if (!Directory.Exists(fullPath))
            {
                return NotFound(new { success = false, message = "Carpeta no encontrada" });
            }

            var folders = Directory.GetDirectories(fullPath)
                .Select(d => new DirectoryInfo(d))
                .OrderBy(d => d.Name)
                .Select(d => new
                {
                    name = d.Name,
                    path = Path.GetRelativePath(_devRoot, d.FullName).Replace('\\', '/'),
                    type = "folder",
                    itemCount = Directory.GetFiles(d.FullName, "*.md", SearchOption.AllDirectories).Length
                })
                .ToList();

            var files = Directory.GetFiles(fullPath, "*.md")
                .Select(f => new FileInfo(f))
                .OrderBy(f => f.Name)
                .Select(f => new
                {
                    name = f.Name,
                    path = Path.GetRelativePath(_devRoot, f.FullName).Replace('\\', '/'),
                    type = "file",
                    size = f.Length,
                    lastModified = f.LastWriteTimeUtc
                })
                .ToList();

            return Ok(new
            {
                success = true,
                currentPath = safePath,
                parentPath = string.IsNullOrEmpty(safePath) ? null : Path.GetDirectoryName(safePath)?.Replace('\\', '/') ?? "",
                folders,
                files
            });
        }

        /// <summary>
        /// Lee el contenido de un archivo .md
        /// </summary>
        [HttpGet("read")]
        public async Task<IActionResult> ReadFile([FromQuery] string path)
        {
            if (string.IsNullOrEmpty(path))
            {
                return BadRequest(new { success = false, message = "Path requerido" });
            }

            var safePath = SanitizePath(path);

            if (!safePath.EndsWith(".md", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { success = false, message = "Solo archivos .md permitidos" });
            }

            var fullPath = Path.Combine(_devRoot, safePath);

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound(new { success = false, message = "Archivo no encontrado" });
            }

            var content = await System.IO.File.ReadAllTextAsync(fullPath);
            var fileInfo = new FileInfo(fullPath);

            return Ok(new
            {
                success = true,
                name = fileInfo.Name,
                path = safePath,
                content,
                size = fileInfo.Length,
                lastModified = fileInfo.LastWriteTimeUtc
            });
        }

        /// <summary>
        /// Sanitiza el path para prevenir directory traversal
        /// </summary>
        private string SanitizePath(string path)
        {
            if (string.IsNullOrEmpty(path)) return "";

            // Eliminar caracteres peligrosos
            var sanitized = path
                .Replace("..", "")
                .Replace("~", "")
                .Trim('/', '\\', ' ');

            // Verificar que el path resuelto esté dentro de _devRoot
            var fullPath = Path.GetFullPath(Path.Combine(_devRoot, sanitized));
            if (!fullPath.StartsWith(Path.GetFullPath(_devRoot)))
            {
                return "";
            }

            return sanitized;
        }
    }
}
