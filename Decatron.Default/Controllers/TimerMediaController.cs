using System.Security.Claims;
using System.Text.RegularExpressions;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Controllers
{
    [Authorize]
    [Route("api/timer/media")]
    [ApiController]
    public class TimerMediaController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<TimerMediaController> _logger;
        private readonly IWebHostEnvironment _environment;
        private const long MaxFileSize = 50 * 1024 * 1024; // 50MB
        private const long MaxTotalStoragePerUser = 500 * 1024 * 1024; // 500MB por usuario

        // Carpetas/categorías predefinidas profesionales
        private static readonly string[] PredefinedCategories = new[]
        {
            "backgrounds",      // Fondos para el timer
            "progressbars",     // Imágenes para barras de progreso
            "indicators",       // Indicadores (bolitas, imágenes)
            "alerts/sounds",    // Sonidos para alertas
            "alerts/icons",     // Iconos para alertas
            "general"           // Archivos misceláneos
        };

        public TimerMediaController(
            DecatronDbContext dbContext,
            ILogger<TimerMediaController> logger,
            IWebHostEnvironment environment)
        {
            _dbContext = dbContext;
            _logger = logger;
            _environment = environment;
        }

        #region Helper Methods

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            throw new UnauthorizedAccessException("User not found");
        }

        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            {
                return sessionId;
            }

            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                return channelOwnerId;
            }

            return GetUserId();
        }

        private async Task<string?> GetChannelUsernameAsync(long channelOwnerId)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == channelOwnerId);
            return user?.Login?.ToLower();
        }

        /// <summary>
        /// Obtiene la ruta base para los archivos del usuario
        /// /ClientApp/public/timerextensible/{username}/
        /// </summary>
        private string GetUserMediaBasePath(string username)
        {
            // ContentRootPath apunta a la raíz del proyecto (donde está el .csproj)
            var basePath = Path.Combine(_environment.ContentRootPath, "ClientApp", "public", "timerextensible", username);
            return basePath;
        }

        /// <summary>
        /// Sanitiza un nombre de archivo removiendo caracteres peligrosos
        /// </summary>
        private string SanitizeFileName(string fileName)
        {
            // Remover caracteres no permitidos
            var invalidChars = Path.GetInvalidFileNameChars();
            var sanitized = new string(fileName.Where(c => !invalidChars.Contains(c)).ToArray());

            // Remover caracteres peligrosos adicionales
            sanitized = Regex.Replace(sanitized, @"[<>:""/\\|?*]", "");

            // Limitar longitud
            if (sanitized.Length > 100)
            {
                var extension = Path.GetExtension(sanitized);
                var nameWithoutExt = Path.GetFileNameWithoutExtension(sanitized);
                sanitized = nameWithoutExt.Substring(0, 100 - extension.Length) + extension;
            }

            return sanitized;
        }

        /// <summary>
        /// Genera un nombre de archivo único si ya existe uno con el mismo nombre
        /// Si existe mi_video.mp4, genera mi_video-a1b2c3d4.mp4 (UUID de 8 chars)
        /// </summary>
        private string GenerateUniqueFileName(string basePath, string originalFileName)
        {
            var fileName = SanitizeFileName(originalFileName);
            var fullPath = Path.Combine(basePath, fileName);

            // Si no existe, usar el nombre original
            if (!System.IO.File.Exists(fullPath))
            {
                return fileName;
            }

            // Si existe, agregar UUID de 8 caracteres al final
            var extension = Path.GetExtension(fileName);
            var nameWithoutExtension = Path.GetFileNameWithoutExtension(fileName);
            var uniqueId = Guid.NewGuid().ToString("N").Substring(0, 8);
            var uniqueFileName = $"{nameWithoutExtension}-{uniqueId}{extension}";

            return uniqueFileName;
        }

        /// <summary>
        /// Valida que la categoría sea válida (predefinida o personalizada segura)
        /// </summary>
        private bool IsValidCategory(string? category)
        {
            if (string.IsNullOrWhiteSpace(category))
                return false;

            // Validar que no tenga caracteres peligrosos
            if (category.Contains("..") || category.Contains("/") || category.Contains("\\"))
                return false;

            // Validar longitud
            if (category.Length > 100)
                return false;

            return true;
        }

        /// <summary>
        /// Calcula el uso total de almacenamiento de un usuario
        /// </summary>
        private async Task<long> GetUserTotalStorageUsageAsync(string username)
        {
            var files = await _dbContext.TimerMediaFiles
                .Where(f => f.ChannelName == username)
                .ToListAsync();

            return files.Sum(f => f.FileSize);
        }

        #endregion

        #region GET Endpoints

        /// <summary>
        /// GET /api/timer/media - Lista todos los archivos multimedia del canal
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetMediaFiles(
            [FromQuery] string? category = null,
            [FromQuery] string? fileType = null)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var query = _dbContext.TimerMediaFiles
                    .Where(f => f.ChannelName == username);

                // Filtrar por categoría si se proporciona
                if (!string.IsNullOrEmpty(category))
                {
                    query = query.Where(f => f.Category == category);
                }

                // Filtrar por tipo si se proporciona
                if (!string.IsNullOrEmpty(fileType))
                {
                    query = query.Where(f => f.FileType == fileType);
                }

                var files = await query
                    .OrderByDescending(f => f.UploadedAt)
                    .ToListAsync();

                var filesDto = files.Select(f => new
                {
                    id = f.Id,
                    originalFileName = f.OriginalFileName,
                    fileName = f.FileName,
                    fileType = f.FileType,
                    category = f.Category,
                    fileUrl = $"/timerextensible/{username}/{f.Category}/{f.FileName}",
                    thumbnailUrl = !string.IsNullOrEmpty(f.ThumbnailPath) ? $"/timerextensible/{username}/{f.ThumbnailPath}" : null,
                    fileSize = f.FileSize,
                    uploadedAt = f.UploadedAt,
                    duration = f.DurationSeconds,
                    usageCount = f.UsageCount
                }).ToList();

                // Calcular uso total de almacenamiento
                var totalStorage = files.Sum(f => f.FileSize);

                return Ok(new
                {
                    success = true,
                    files = filesDto,
                    totalFiles = files.Count,
                    totalStorageUsed = totalStorage,
                    maxStorageAllowed = MaxTotalStoragePerUser,
                    storageUsagePercentage = (double)totalStorage / MaxTotalStoragePerUser * 100
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener archivos multimedia");
                return StatusCode(500, new { success = false, message = "Error al obtener archivos" });
            }
        }

        /// <summary>
        /// GET /api/timer/media/categories - Lista todas las categorías disponibles
        /// </summary>
        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                // Obtener categorías predefinidas + categorías personalizadas del usuario
                var userCategories = await _dbContext.TimerMediaFiles
                    .Where(f => f.ChannelName == username && !string.IsNullOrEmpty(f.Category))
                    .Select(f => f.Category)
                    .Distinct()
                    .ToListAsync();

                var allCategories = PredefinedCategories
                    .Union(userCategories!)
                    .Distinct()
                    .OrderBy(c => c)
                    .ToList();

                return Ok(new
                {
                    success = true,
                    predefined = PredefinedCategories,
                    custom = userCategories.Except(PredefinedCategories).ToList(),
                    all = allCategories
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener categorías");
                return StatusCode(500, new { success = false, message = "Error al obtener categorías" });
            }
        }

        #endregion

        #region POST Endpoints

        /// <summary>
        /// POST /api/timer/media/upload - Sube un archivo multimedia
        /// </summary>
        [HttpPost("upload")]
        [RequestSizeLimit(52428800)] // 50MB
        public async Task<IActionResult> UploadFile(
            [FromForm] IFormFile file,
            [FromForm] string fileType,
            [FromForm] string? category = null,
            [FromForm] double durationSeconds = 0)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                if (file == null || file.Length == 0)
                {
                    return BadRequest(new { success = false, message = "No se proporcionó ningún archivo" });
                }

                if (file.Length > MaxFileSize)
                {
                    return BadRequest(new { success = false, message = $"El archivo excede el tamaño máximo permitido ({MaxFileSize / 1024 / 1024}MB)" });
                }

                // Verificar cuota de almacenamiento
                var currentUsage = await GetUserTotalStorageUsageAsync(username);
                if (currentUsage + file.Length > MaxTotalStoragePerUser)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = $"Cuota de almacenamiento excedida. Usado: {currentUsage / 1024 / 1024}MB / {MaxTotalStoragePerUser / 1024 / 1024}MB"
                    });
                }

                // Validar categoría (usar "general" si no se proporciona)
                var finalCategory = string.IsNullOrWhiteSpace(category) ? "general" : category;
                if (!IsValidCategory(finalCategory))
                {
                    return BadRequest(new { success = false, message = "Categoría no válida" });
                }

                // Normalizar fileType (frontend puede enviar 'audio' en lugar de 'sound')
                if (fileType == "audio") fileType = "sound";

                // Validar extensión según tipo
                var extension = Path.GetExtension(file.FileName).ToLower();
                var validExtensions = new Dictionary<string, string[]>
                {
                    { "sound", new[] { ".mp3", ".wav", ".ogg", ".m4a", ".aac" } }, // Agregados formatos comunes
                    { "image", new[] { ".png", ".jpg", ".jpeg", ".webp", ".svg" } }, // Agregados webp y svg
                    { "gif", new[] { ".gif" } },
                    { "video", new[] { ".mp4", ".webm", ".mov", ".mkv" } } // Agregados mov y mkv
                };

                if (!validExtensions.ContainsKey(fileType))
                {
                    return BadRequest(new { success = false, message = $"Tipo de archivo no soportado: {fileType}" });
                }

                if (!validExtensions[fileType].Contains(extension))
                {
                    var allowed = string.Join(", ", validExtensions[fileType]);
                    return BadRequest(new { 
                        success = false, 
                        message = $"Extensión '{extension}' no válida para {fileType}. Permitidos: {allowed}" 
                    });
                }

                // Crear estructura de carpetas
                var userBasePath = GetUserMediaBasePath(username);
                var categoryPath = Path.Combine(userBasePath, finalCategory);
                Directory.CreateDirectory(categoryPath);

                // Generar nombre único (agrega UUID de 8 chars si existe duplicado)
                var originalFileName = Path.GetFileName(file.FileName);
                var uniqueFileName = GenerateUniqueFileName(categoryPath, originalFileName);
                var fullFilePath = Path.Combine(categoryPath, uniqueFileName);

                // Guardar archivo físico
                using (var stream = new FileStream(fullFilePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                _logger.LogInformation($"[MEDIA] Archivo subido: {uniqueFileName} para {username} en categoría {finalCategory}");

                // Guardar registro en BD
                var mediaFile = new TimerMediaFile
                {
                    ChannelName = username,
                    FileType = fileType,
                    FilePath = fullFilePath,
                    OriginalFileName = originalFileName,
                    FileName = uniqueFileName,
                    Category = finalCategory,
                    FileSize = file.Length,
                    DurationSeconds = durationSeconds > 0 ? durationSeconds : null,
                    UsageCount = 0,
                    UploadedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.TimerMediaFiles.Add(mediaFile);
                await _dbContext.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = "Archivo subido correctamente",
                    file = new
                    {
                        id = mediaFile.Id,
                        originalFileName = mediaFile.OriginalFileName,
                        fileName = mediaFile.FileName,
                        fileType = mediaFile.FileType,
                        category = mediaFile.Category,
                        fileUrl = $"/timerextensible/{username}/{finalCategory}/{uniqueFileName}",
                        fileSize = mediaFile.FileSize,
                        uploadedAt = mediaFile.UploadedAt,
                        duration = mediaFile.DurationSeconds,
                        usageCount = mediaFile.UsageCount
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al subir archivo");
                return StatusCode(500, new { success = false, message = "Error al subir archivo" });
            }
        }

        #endregion

        #region PUT/PATCH Endpoints

        /// <summary>
        /// PUT /api/timer/media/{id}/rename - Renombra un archivo
        /// </summary>
        [HttpPut("{id}/rename")]
        public async Task<IActionResult> RenameFile(int id, [FromBody] RenameFileRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var file = await _dbContext.TimerMediaFiles
                    .FirstOrDefaultAsync(f => f.Id == id && f.ChannelName == username);

                if (file == null)
                {
                    return NotFound(new { success = false, message = "Archivo no encontrado" });
                }

                if (string.IsNullOrWhiteSpace(request.NewName))
                {
                    return BadRequest(new { success = false, message = "El nuevo nombre no puede estar vacío" });
                }

                var extension = Path.GetExtension(file.FileName);
                var newNameWithExtension = request.NewName.EndsWith(extension)
                    ? request.NewName
                    : request.NewName + extension;

                var sanitizedNewName = SanitizeFileName(newNameWithExtension);

                // Verificar si ya existe un archivo con el nuevo nombre
                var categoryPath = Path.Combine(GetUserMediaBasePath(username), file.Category ?? "general");
                var newFilePath = Path.Combine(categoryPath, sanitizedNewName);

                if (System.IO.File.Exists(newFilePath) && newFilePath != file.FilePath)
                {
                    return BadRequest(new { success = false, message = "Ya existe un archivo con ese nombre" });
                }

                // Renombrar archivo físico
                if (System.IO.File.Exists(file.FilePath))
                {
                    System.IO.File.Move(file.FilePath, newFilePath);
                }

                // Actualizar BD
                file.OriginalFileName = sanitizedNewName;
                file.FileName = sanitizedNewName;
                file.FilePath = newFilePath;
                file.UpdatedAt = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"[MEDIA] Archivo renombrado: {file.FileName} → {sanitizedNewName} para {username}");

                return Ok(new
                {
                    success = true,
                    message = "Archivo renombrado correctamente",
                    file = new
                    {
                        id = file.Id,
                        originalFileName = file.OriginalFileName,
                        fileName = file.FileName,
                        fileUrl = $"/timerextensible/{username}/{file.Category}/{file.FileName}"
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al renombrar archivo");
                return StatusCode(500, new { success = false, message = "Error al renombrar archivo" });
            }
        }

        /// <summary>
        /// PUT /api/timer/media/{id}/move - Mueve un archivo a otra categoría
        /// </summary>
        [HttpPut("{id}/move")]
        public async Task<IActionResult> MoveFile(int id, [FromBody] MoveFileRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var file = await _dbContext.TimerMediaFiles
                    .FirstOrDefaultAsync(f => f.Id == id && f.ChannelName == username);

                if (file == null)
                {
                    return NotFound(new { success = false, message = "Archivo no encontrado" });
                }

                if (!IsValidCategory(request.NewCategory))
                {
                    return BadRequest(new { success = false, message = "Categoría destino no válida" });
                }

                // Crear carpeta de destino si no existe
                var userBasePath = GetUserMediaBasePath(username);
                var newCategoryPath = Path.Combine(userBasePath, request.NewCategory);
                Directory.CreateDirectory(newCategoryPath);

                var newFilePath = Path.Combine(newCategoryPath, file.FileName);

                // Mover archivo físico
                if (System.IO.File.Exists(file.FilePath))
                {
                    System.IO.File.Move(file.FilePath, newFilePath);
                }

                // Actualizar BD
                file.Category = request.NewCategory;
                file.FilePath = newFilePath;
                file.UpdatedAt = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"[MEDIA] Archivo movido: {file.FileName} a categoría {request.NewCategory} para {username}");

                return Ok(new
                {
                    success = true,
                    message = "Archivo movido correctamente",
                    file = new
                    {
                        id = file.Id,
                        fileName = file.FileName,
                        category = file.Category,
                        fileUrl = $"/timerextensible/{username}/{file.Category}/{file.FileName}"
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al mover archivo");
                return StatusCode(500, new { success = false, message = "Error al mover archivo" });
            }
        }

        #endregion

        #region DELETE Endpoints

        /// <summary>
        /// DELETE /api/timer/media/{id} - Elimina un archivo multimedia
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFile(int id, [FromQuery] bool force = false)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var file = await _dbContext.TimerMediaFiles
                    .FirstOrDefaultAsync(f => f.Id == id && f.ChannelName == username);

                if (file == null)
                {
                    return NotFound(new { success = false, message = "Archivo no encontrado" });
                }

                // Verificar si el archivo está en uso (a menos que se fuerce la eliminación)
                if (!force && file.UsageCount > 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = $"Este archivo se usa en {file.UsageCount} configuración(es). Usa force=true para eliminar de todas formas.",
                        usageCount = file.UsageCount
                    });
                }

                // Eliminar archivo físico
                if (System.IO.File.Exists(file.FilePath))
                {
                    System.IO.File.Delete(file.FilePath);
                    _logger.LogInformation($"[MEDIA] Archivo físico eliminado: {file.FilePath}");
                }

                // Eliminar thumbnail si existe
                if (!string.IsNullOrEmpty(file.ThumbnailPath))
                {
                    var thumbnailFullPath = Path.Combine(GetUserMediaBasePath(username), file.ThumbnailPath);
                    if (System.IO.File.Exists(thumbnailFullPath))
                    {
                        System.IO.File.Delete(thumbnailFullPath);
                    }
                }

                // Eliminar registro de BD
                _dbContext.TimerMediaFiles.Remove(file);
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"[MEDIA] Archivo eliminado: {file.FileName} para {username}");

                return Ok(new { success = true, message = "Archivo eliminado correctamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar archivo");
                return StatusCode(500, new { success = false, message = "Error al eliminar archivo" });
            }
        }

        #endregion
    }

    #region Request DTOs

    public class RenameFileRequest
    {
        public string NewName { get; set; } = string.Empty;
    }

    public class MoveFileRequest
    {
        public string NewCategory { get; set; } = string.Empty;
    }

    #endregion
}
