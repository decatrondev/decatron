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
        private readonly ILogger<DevDocsController> _logger;

        /// <summary>Donde viven los planes activos y donde van al archivarse (relativo a .dev/).</summary>
        private const string PlansDir = "plans";
        private const string ArchivedPlansDir = "archivados/plans";

        public DevDocsController(IWebHostEnvironment env, ILogger<DevDocsController> logger)
        {
            _env = env;
            _logger = logger;
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

        public class MoveRequest
        {
            public string Path { get; set; } = string.Empty;
            /// <summary>"archive" (plans/ → archivados/plans/) o "restore" (al revés).</summary>
            public string Action { get; set; } = "archive";
        }

        /// <summary>
        /// Archiva un plan (lo mueve de <c>plans/</c> a <c>archivados/plans/</c>) o lo restaura.
        ///
        /// <para>Solo mueve un archivo .md que esté DIRECTAMENTE en una de esas dos carpetas y nunca
        /// pisa uno que ya exista en el destino. Es lo único que esta pantalla escribe: el resto
        /// sigue siendo de solo lectura.</para>
        /// </summary>
        [HttpPost("move")]
        public IActionResult Move([FromBody] MoveRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.Path))
                return BadRequest(new { success = false, message = "Path requerido" });

            // `SanitizePath` quita los ".." en silencio y dejaria una ruta distinta de la pedida:
            // aqui se rechaza de plano en vez de mover otra cosa.
            if (req.Path.Contains("..") || req.Path.Contains('~'))
                return BadRequest(new { success = false, message = "Path no válido" });

            var archivar = string.Equals(req.Action, "archive", StringComparison.OrdinalIgnoreCase);
            var restaurar = string.Equals(req.Action, "restore", StringComparison.OrdinalIgnoreCase);
            if (!archivar && !restaurar)
                return BadRequest(new { success = false, message = "Acción no válida" });

            var origen = SanitizePath(req.Path).Replace('\\', '/');
            if (!origen.EndsWith(".md", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { success = false, message = "Solo archivos .md" });

            var carpetaOrigen = archivar ? PlansDir : ArchivedPlansDir;
            var carpetaDestino = archivar ? ArchivedPlansDir : PlansDir;
            var nombre = Path.GetFileName(origen);
            var dir = Path.GetDirectoryName(origen)?.Replace('\\', '/') ?? "";

            if (!string.Equals(dir, carpetaOrigen, StringComparison.Ordinal) || string.IsNullOrEmpty(nombre))
                return BadRequest(new { success = false, message = archivar
                    ? "Solo se pueden archivar archivos que estén directamente en plans/"
                    : "Solo se pueden restaurar archivos que estén directamente en archivados/plans/" });

            var fullOrigen = Path.Combine(_devRoot, carpetaOrigen, nombre);
            var fullDestino = Path.Combine(_devRoot, carpetaDestino, nombre);

            if (!System.IO.File.Exists(fullOrigen))
                return NotFound(new { success = false, message = "Archivo no encontrado" });

            if (System.IO.File.Exists(fullDestino))
                return Conflict(new { success = false, message = $"Ya existe {nombre} en {carpetaDestino}/" });

            Directory.CreateDirectory(Path.Combine(_devRoot, carpetaDestino));
            System.IO.File.Move(fullOrigen, fullDestino);

            _logger.LogInformation("📁 [DevDocs] {Accion}: {Origen} → {Destino}", archivar ? "Archivado" : "Restaurado", origen, $"{carpetaDestino}/{nombre}");
            return Ok(new { success = true, newPath = $"{carpetaDestino}/{nombre}" });
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
