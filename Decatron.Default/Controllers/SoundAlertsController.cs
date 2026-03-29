using System.Security.Claims;
using System.Text.Json;
using Decatron.Core.Settings;
using Decatron.Data;
using Decatron.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Default.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class SoundAlertsController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<SoundAlertsController> _logger;
        private readonly TwitchSettings _twitchSettings;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IHubContext<OverlayHub> _hubContext;
        private const string TwitchApiBaseUrl = "https://api.twitch.tv/helix";

        public SoundAlertsController(
            DecatronDbContext dbContext,
            ILogger<SoundAlertsController> logger,
            IOptions<TwitchSettings> twitchSettings,
            IHttpClientFactory httpClientFactory,
            IHubContext<OverlayHub> hubContext)
        {
            _dbContext = dbContext;
            _logger = logger;
            _twitchSettings = twitchSettings.Value;
            _httpClientFactory = httpClientFactory;
            _hubContext = hubContext;
        }

        /// <summary>
        /// Obtiene el ID del usuario autenticado
        /// </summary>
        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            throw new UnauthorizedAccessException("User not found");
        }

        /// <summary>
        /// Obtiene el ID del canal que se está gestionando (respeta jerarquía de permisos)
        /// </summary>
        private long GetChannelOwnerId()
        {
            // PRIORIDAD 1: Obtener canal activo desde la sesión (después de switch)
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            {
                _logger.LogInformation($"[SoundAlerts] Using channel from session: {sessionId}");
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                _logger.LogInformation($"[SoundAlerts] Using channel from JWT claim: {channelOwnerId}");
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            var userId = GetUserId();
            _logger.LogInformation($"[SoundAlerts] Using user's own channel: {userId}");
            return userId;
        }

        /// <summary>
        /// Obtiene las recompensas de puntos de canal desde Twitch
        /// </summary>
        [HttpGet("channel-points-rewards")]
        public async Task<IActionResult> GetChannelPointsRewards()
        {
            try
            {
                _logger.LogInformation("🎵 [SoundAlerts] Iniciando obtención de recompensas de puntos de canal");

                // Validar configuración
                if (string.IsNullOrEmpty(_twitchSettings?.ClientId))
                {
                    _logger.LogError("🎵 [SoundAlerts] ClientId de Twitch no configurado");
                    return StatusCode(500, new { success = false, message = "Configuración de Twitch no disponible" });
                }

                var channelOwnerId = GetChannelOwnerId();
                _logger.LogInformation($"🎵 [SoundAlerts] Canal activo: {channelOwnerId}");

                // Obtener información del usuario desde la BD
                var user = await _dbContext.Users
                    .FirstOrDefaultAsync(u => u.Id == channelOwnerId && u.IsActive);

                if (user == null)
                {
                    _logger.LogWarning($"🎵 [SoundAlerts] Usuario no encontrado: {channelOwnerId}");
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                _logger.LogInformation($"🎵 [SoundAlerts] Usuario encontrado: {user.Login} (TwitchId: {user.TwitchId})");

                // Verificar que tenga access token
                if (string.IsNullOrEmpty(user.AccessToken))
                {
                    _logger.LogWarning($"🎵 [SoundAlerts] Access token no disponible para usuario: {user.Login}");
                    return BadRequest(new { success = false, message = "Token de acceso no disponible. Por favor, vuelve a autenticarte." });
                }

                // Limpiar el token (remover "oauth:" si existe)
                var accessToken = user.AccessToken.StartsWith("oauth:")
                    ? user.AccessToken.Substring(6)
                    : user.AccessToken;

                _logger.LogInformation($"🎵 [SoundAlerts] Llamando a Twitch API para obtener recompensas...");

                // Crear HttpClient
                var httpClient = _httpClientFactory.CreateClient();

                // Llamar a la API de Twitch para obtener las recompensas
                var request = new HttpRequestMessage(HttpMethod.Get,
                    $"{TwitchApiBaseUrl}/channel_points/custom_rewards?broadcaster_id={user.TwitchId}");

                request.Headers.Add("Client-ID", _twitchSettings.ClientId);
                request.Headers.Add("Authorization", $"Bearer {accessToken}");

                var response = await httpClient.SendAsync(request);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"🎵 [SoundAlerts] Error obteniendo recompensas de puntos de canal: {response.StatusCode} - {errorContent}");

                    // Si es 401, el token probablemente expiró
                    if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    {
                        return StatusCode(401, new { success = false, message = "Token de acceso expirado. Por favor, vuelve a autenticarte." });
                    }

                    return StatusCode(500, new { success = false, message = "Error al obtener recompensas de Twitch" });
                }

                var json = await response.Content.ReadAsStringAsync();
                _logger.LogInformation($"🎵 [SoundAlerts] Respuesta de Twitch API recibida, parseando JSON...");

                var result = JsonSerializer.Deserialize<TwitchApiResponse>(json);

                _logger.LogInformation($"🎵 [SoundAlerts] ✅ Recompensas obtenidas para {user.Login}: {result?.data?.Count ?? 0} recompensas");

                return Ok(new
                {
                    success = true,
                    rewards = result?.data ?? new List<ChannelPointsReward>(),
                    channelName = user.Login,
                    channelDisplayName = user.DisplayName
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error en GetChannelPointsRewards");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Obtiene la configuración para el overlay público (sin autenticación)
        /// </summary>
        [AllowAnonymous]
        [HttpGet("config/overlay/{channel}")]
        public async Task<IActionResult> GetOverlayConfiguration(string channel)
        {
            try
            {
                if (string.IsNullOrEmpty(channel))
                {
                    return BadRequest(new { success = false, message = "Canal no especificado" });
                }

                var username = channel.ToLower();
                var config = await _dbContext.SoundAlertConfigs
                    .FirstOrDefaultAsync(c => c.Username == username);

                if (config == null)
                {
                    // Retornar configuración por defecto
                    return Ok(new
                    {
                        success = true,
                        config = new
                        {
                            globalVolume = 70,
                            globalEnabled = true,
                            duration = 10,
                            textLines = new[] {
                                new { text = "@redeemer canjeó @reward", fontSize = 24, fontWeight = "bold", enabled = false },
                                new { text = "¡Gracias por el apoyo!", fontSize = 18, fontWeight = "600", enabled = false }
                            },
                            styles = new {
                                fontFamily = "Inter",
                                textColor = "#ffffff",
                                textShadow = "normal",
                                backgroundType = "transparent",
                                gradientColor1 = "#667eea",
                                gradientColor2 = "#764ba2",
                                gradientAngle = 135,
                                solidColor = "#8b5cf6",
                                backgroundOpacity = 100
                            },
                            layout = new {
                                media = new { x = 0, y = 0, width = 400, height = 400 },
                                text = new { x = 200, y = 420, align = "center" }
                            },
                            animationType = "fade",
                            animationSpeed = "normal",
                            textOutlineEnabled = false,
                            textOutlineColor = "#000000",
                            textOutlineWidth = 2,
                            cooldownMs = 500
                        }
                    });
                }

                var textLinesJson = JsonSerializer.Deserialize<JsonElement>(config.TextLines);
                var stylesJson = JsonSerializer.Deserialize<JsonElement>(config.Styles);

                // Deserializar layout como DTO para forzar camelCase en la respuesta
                var layoutDto = JsonSerializer.Deserialize<LayoutDto>(config.Layout);

                return Ok(new
                {
                    success = true,
                    config = new
                    {
                        globalVolume = config.GlobalVolume,
                        globalEnabled = config.GlobalEnabled,
                        duration = config.Duration,
                        textLines = textLinesJson,
                        styles = stylesJson,
                        layout = layoutDto, // Ahora se serializa con camelCase
                        animationType = config.AnimationType,
                        animationSpeed = config.AnimationSpeed,
                        textOutlineEnabled = config.TextOutlineEnabled,
                        textOutlineColor = config.TextOutlineColor,
                        textOutlineWidth = config.TextOutlineWidth,
                        cooldownMs = config.CooldownMs
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error obteniendo configuración del overlay");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Obtiene la configuración global de Sound Alerts
        /// </summary>
        [HttpGet("config")]
        public async Task<IActionResult> GetConfiguration()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var config = await _dbContext.SoundAlertConfigs
                    .FirstOrDefaultAsync(c => c.Username == username);

                if (config == null)
                {
                    // Retornar configuración por defecto
                    return Ok(new
                    {
                        success = true,
                        config = new
                        {
                            globalVolume = 70,
                            globalEnabled = true,
                            duration = 10,
                            textLines = new[] {
                                new { text = "@redeemer canjeó @reward", fontSize = 24, fontWeight = "bold", enabled = false },
                                new { text = "¡Gracias por el apoyo!", fontSize = 18, fontWeight = "600", enabled = false }
                            },
                            styles = new {
                                fontFamily = "Inter",
                                fontSize = 24,
                                textColor = "#ffffff",
                                textShadow = "normal",
                                backgroundType = "transparent",
                                gradientColor1 = "#667eea",
                                gradientColor2 = "#764ba2",
                                gradientAngle = 135,
                                solidColor = "#8b5cf6",
                                backgroundOpacity = 100
                            },
                            layout = new {
                                media = new { x = 0, y = 0, width = 400, height = 400 },
                                text = new { x = 200, y = 420, align = "center" }
                            },
                            animationType = "fade",
                            animationSpeed = "normal",
                            textOutlineEnabled = false,
                            textOutlineColor = "#000000",
                            textOutlineWidth = 2,
                            cooldownMs = 500
                        }
                    });
                }

                var textLinesJson = JsonSerializer.Deserialize<JsonElement>(config.TextLines);
                var stylesJson = JsonSerializer.Deserialize<JsonElement>(config.Styles);

                // Deserializar layout como DTO para forzar camelCase en la respuesta
                var layoutDto = JsonSerializer.Deserialize<LayoutDto>(config.Layout);

                return Ok(new
                {
                    success = true,
                    config = new
                    {
                        globalVolume = config.GlobalVolume,
                        globalEnabled = config.GlobalEnabled,
                        duration = config.Duration,
                        textLines = textLinesJson,
                        styles = stylesJson,
                        layout = layoutDto, // Ahora se serializa con camelCase
                        animationType = config.AnimationType,
                        animationSpeed = config.AnimationSpeed,
                        textOutlineEnabled = config.TextOutlineEnabled,
                        textOutlineColor = config.TextOutlineColor,
                        textOutlineWidth = config.TextOutlineWidth,
                        cooldownMs = config.CooldownMs
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error obteniendo configuración");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Guarda la configuración global de Sound Alerts
        /// </summary>
        [HttpPost("config")]
        public async Task<IActionResult> SaveConfiguration([FromBody] SaveConfigRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                // Validaciones
                if (request.GlobalVolume < 0 || request.GlobalVolume > 100)
                {
                    return BadRequest(new { success = false, message = "El volumen debe estar entre 0 y 100" });
                }

                if (request.Duration < 3 || request.Duration > 30)
                {
                    return BadRequest(new { success = false, message = "La duración debe estar entre 3 y 30 segundos" });
                }

                if (request.CooldownMs < 0)
                {
                    return BadRequest(new { success = false, message = "El cooldown no puede ser negativo" });
                }

                var config = await _dbContext.SoundAlertConfigs
                    .FirstOrDefaultAsync(c => c.Username == username);

                var textLinesJson = JsonSerializer.Serialize(request.TextLines);
                var stylesJson = JsonSerializer.Serialize(request.Styles);
                var layoutJson = JsonSerializer.Serialize(request.Layout);

                _logger.LogInformation($"🎵 [DEBUG] Layout recibido del frontend: {layoutJson}");

                if (config == null)
                {
                    config = new Core.Models.SoundAlertConfig
                    {
                        Username = username,
                        GlobalVolume = request.GlobalVolume,
                        GlobalEnabled = request.GlobalEnabled,
                        Duration = request.Duration,
                        TextLines = textLinesJson,
                        Styles = stylesJson,
                        Layout = layoutJson,
                        AnimationType = request.AnimationType,
                        AnimationSpeed = request.AnimationSpeed,
                        TextOutlineEnabled = request.TextOutlineEnabled,
                        TextOutlineColor = request.TextOutlineColor,
                        TextOutlineWidth = request.TextOutlineWidth,
                        CooldownMs = request.CooldownMs,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _dbContext.SoundAlertConfigs.Add(config);
                }
                else
                {
                    config.GlobalVolume = request.GlobalVolume;
                    config.GlobalEnabled = request.GlobalEnabled;
                    config.Duration = request.Duration;
                    config.TextLines = textLinesJson;
                    config.Styles = stylesJson;
                    config.Layout = layoutJson;
                    config.AnimationType = request.AnimationType;
                    config.AnimationSpeed = request.AnimationSpeed;
                    config.TextOutlineEnabled = request.TextOutlineEnabled;
                    config.TextOutlineColor = request.TextOutlineColor;
                    config.TextOutlineWidth = request.TextOutlineWidth;
                    config.CooldownMs = request.CooldownMs;
                    config.UpdatedAt = DateTime.UtcNow;
                }

                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"🎵 [SoundAlerts] Configuración guardada para {username}");
                _logger.LogInformation($"🎵 [DEBUG] Layout guardado en BD: {config.Layout}");

                // Notificar al overlay que la configuración ha cambiado
                try
                {
                    await _hubContext.Clients.Group($"overlay_{username.ToLower()}")
                        .SendAsync("ConfigurationChanged");
                    _logger.LogInformation($"🎵 [SoundAlerts] Evento ConfigurationChanged enviado al overlay de {username}");
                }
                catch (Exception signalREx)
                {
                    _logger.LogWarning(signalREx, $"🎵 [SoundAlerts] No se pudo enviar ConfigurationChanged a overlay (puede estar desconectado)");
                }

                return Ok(new { success = true, message = "Configuración guardada exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error guardando configuración");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Obtiene los archivos asociados a recompensas
        /// </summary>
        [HttpGet("files")]
        public async Task<IActionResult> GetFiles()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var files = await _dbContext.SoundAlertFiles
                    .Where(f => f.Username == username)
                    .OrderByDescending(f => f.CreatedAt)
                    .ToListAsync();

                return Ok(new
                {
                    success = true,
                    files = files.Select(f => new
                    {
                        id = f.Id,
                        rewardId = f.RewardId,
                        rewardTitle = f.RewardTitle,
                        fileType = f.FileType,
                        fileName = f.FileName,
                        fileSize = f.FileSize,
                        durationSeconds = f.DurationSeconds,
                        volume = f.Volume,
                        enabled = f.Enabled,
                        playCount = f.PlayCount,
                        createdAt = f.CreatedAt
                    })
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error obteniendo archivos");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Sube un archivo (sonido/video/imagen) para una recompensa
        /// </summary>
        [HttpPost("upload")]
        public async Task<IActionResult> UploadFile([FromForm] UploadFileRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                // Sanitize username to prevent path traversal
                username = System.Text.RegularExpressions.Regex.Replace(username, @"[^a-zA-Z0-9_]", "");

                // Validar archivo
                if (request.File == null || request.File.Length == 0)
                {
                    return BadRequest(new { success = false, message = "No se proporcionó archivo" });
                }

                // Validar tipo y tamaño según el tipo de archivo
                var extension = Path.GetExtension(request.File.FileName).ToLowerInvariant();
                var fileType = request.FileType.ToLower();
                var maxSize = 0L;

                if (fileType == "sound")
                {
                    if (extension != ".mp3" && extension != ".wav" && extension != ".ogg")
                    {
                        return BadRequest(new { success = false, message = "Formato de audio no válido. Use MP3, WAV u OGG" });
                    }
                    maxSize = 10 * 1024 * 1024; // 10 MB
                }
                else if (fileType == "video")
                {
                    if (extension != ".mp4" && extension != ".webm")
                    {
                        return BadRequest(new { success = false, message = "Formato de video no válido. Use MP4 o WEBM" });
                    }
                    maxSize = 50 * 1024 * 1024; // 50 MB
                }
                else if (fileType == "image")
                {
                    if (extension != ".png" && extension != ".jpg" && extension != ".jpeg")
                    {
                        return BadRequest(new { success = false, message = "Formato de imagen no válido. Use PNG o JPG" });
                    }
                    maxSize = 5 * 1024 * 1024; // 5 MB
                }
                else
                {
                    return BadRequest(new { success = false, message = "Tipo de archivo no válido" });
                }

                if (request.File.Length > maxSize)
                {
                    var maxSizeMB = maxSize / 1024 / 1024;
                    return BadRequest(new { success = false, message = $"El archivo excede el tamaño máximo de {maxSizeMB}MB" });
                }

                // Validar duración (para audio/video)
                if (fileType == "sound" || fileType == "video")
                {
                    if (request.DurationSeconds > 30)
                    {
                        return BadRequest(new { success = false, message = "La duración máxima es de 30 segundos" });
                    }
                }

                // Crear directorio si no existe
                var uploadDir = Path.Combine("ClientApp", "public", "uploads", "soundalerts", username);
                if (!Directory.Exists(uploadDir))
                {
                    Directory.CreateDirectory(uploadDir);
                }

                // Generar nombre único
                var fileName = $"{Guid.NewGuid()}{extension}";
                var filePath = Path.Combine(uploadDir, fileName);

                // Guardar archivo
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await request.File.CopyToAsync(stream);
                }

                // Guardar imagen asociada (si se proporciona, principalmente para archivos de audio)
                string? imagePath = null;
                string? imageName = null;

                if (request.ImageFile != null && request.ImageFile.Length > 0)
                {
                    var imageExtension = Path.GetExtension(request.ImageFile.FileName).ToLowerInvariant();

                    // Validar formato de imagen
                    if (imageExtension != ".png" && imageExtension != ".jpg" && imageExtension != ".jpeg")
                    {
                        return BadRequest(new { success = false, message = "Formato de imagen no válido. Use PNG o JPG" });
                    }

                    // Validar tamaño (5MB máximo)
                    if (request.ImageFile.Length > 5 * 1024 * 1024)
                    {
                        return BadRequest(new { success = false, message = "La imagen excede el tamaño máximo de 5MB" });
                    }

                    // Generar nombre único para la imagen
                    imageName = request.ImageFile.FileName;
                    var imageFileName = $"{Guid.NewGuid()}{imageExtension}";
                    imagePath = Path.Combine(uploadDir, imageFileName);

                    // Guardar imagen
                    using (var imageStream = new FileStream(imagePath, FileMode.Create))
                    {
                        await request.ImageFile.CopyToAsync(imageStream);
                    }

                    _logger.LogInformation($"🎵 [SoundAlerts] Imagen asociada guardada: {imageName}");
                }

                // Verificar si ya existe un archivo para esta recompensa
                var existingFile = await _dbContext.SoundAlertFiles
                    .FirstOrDefaultAsync(f => f.Username == username && f.RewardId == request.RewardId);

                if (existingFile != null)
                {
                    // Eliminar archivo anterior
                    if (System.IO.File.Exists(existingFile.FilePath))
                    {
                        System.IO.File.Delete(existingFile.FilePath);
                    }

                    // Eliminar imagen anterior si existe
                    if (!string.IsNullOrEmpty(existingFile.ImagePath) && System.IO.File.Exists(existingFile.ImagePath))
                    {
                        System.IO.File.Delete(existingFile.ImagePath);
                    }

                    // Actualizar registro
                    existingFile.FileType = fileType;
                    existingFile.FilePath = filePath;
                    existingFile.FileName = request.File.FileName;
                    existingFile.FileSize = request.File.Length;
                    existingFile.DurationSeconds = request.DurationSeconds;
                    existingFile.RewardTitle = request.RewardTitle;
                    existingFile.ImagePath = imagePath;
                    existingFile.ImageName = imageName;
                    existingFile.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    // Crear nuevo registro
                    var soundAlertFile = new Core.Models.SoundAlertFile
                    {
                        Username = username,
                        RewardId = request.RewardId,
                        RewardTitle = request.RewardTitle,
                        FileType = fileType,
                        FilePath = filePath,
                        FileName = request.File.FileName,
                        FileSize = request.File.Length,
                        DurationSeconds = request.DurationSeconds,
                        ImagePath = imagePath,
                        ImageName = imageName,
                        Enabled = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _dbContext.SoundAlertFiles.Add(soundAlertFile);
                }

                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"🎵 [SoundAlerts] Archivo subido para {username}: {request.File.FileName} (Reward: {request.RewardTitle})");

                return Ok(new
                {
                    success = true,
                    message = "Archivo subido exitosamente",
                    file = new
                    {
                        rewardId = request.RewardId,
                        fileName = request.File.FileName,
                        fileType = fileType,
                        fileSize = request.File.Length,
                        durationSeconds = request.DurationSeconds
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error subiendo archivo");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Elimina un archivo asociado a una recompensa
        /// </summary>
        [HttpDelete("file/{rewardId}")]
        public async Task<IActionResult> DeleteFile(string rewardId)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var file = await _dbContext.SoundAlertFiles
                    .FirstOrDefaultAsync(f => f.Username == username && f.RewardId == rewardId);

                if (file == null)
                {
                    return NotFound(new { success = false, message = "Archivo no encontrado" });
                }

                // Eliminar archivo físico SOLO si NO es un archivo del sistema
                if (!file.IsSystemFile && System.IO.File.Exists(file.FilePath))
                {
                    System.IO.File.Delete(file.FilePath);
                    _logger.LogInformation($"🎵 [SoundAlerts] Archivo físico eliminado: {file.FilePath}");
                }
                else if (file.IsSystemFile)
                {
                    _logger.LogInformation($"🎵 [SoundAlerts] Archivo del sistema no se elimina físicamente: {file.FileName}");
                }

                // Eliminar registro de la BD
                _dbContext.SoundAlertFiles.Remove(file);
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"🎵 [SoundAlerts] Registro eliminado de BD para {username}: {file.FileName}");

                return Ok(new { success = true, message = "Archivo eliminado exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error eliminando archivo");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Actualiza el volumen de un archivo específico
        /// </summary>
        [HttpPatch("file/{rewardId}/volume")]
        public async Task<IActionResult> UpdateFileVolume(string rewardId, [FromBody] UpdateVolumeRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                if (request.Volume < 0 || request.Volume > 100)
                {
                    return BadRequest(new { success = false, message = "El volumen debe estar entre 0 y 100" });
                }

                var file = await _dbContext.SoundAlertFiles
                    .FirstOrDefaultAsync(f => f.Username == username && f.RewardId == rewardId);

                if (file == null)
                {
                    return NotFound(new { success = false, message = "Archivo no encontrado" });
                }

                file.Volume = request.Volume;
                file.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Volumen actualizado" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error actualizando volumen");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Activa/desactiva un archivo específico
        /// </summary>
        [HttpPatch("file/{rewardId}/toggle")]
        public async Task<IActionResult> ToggleFileEnabled(string rewardId)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var file = await _dbContext.SoundAlertFiles
                    .FirstOrDefaultAsync(f => f.Username == username && f.RewardId == rewardId);

                if (file == null)
                {
                    return NotFound(new { success = false, message = "Archivo no encontrado" });
                }

                file.Enabled = !file.Enabled;
                file.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, enabled = file.Enabled });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error alternando estado");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Lista todos los archivos del sistema disponibles
        /// </summary>
        [HttpGet("system-files")]
        public IActionResult GetSystemFiles()
        {
            try
            {
                var systemFilesPath = Path.Combine("ClientApp", "public", "system-files");
                var files = new List<SystemFileInfo>();

                // Escanear carpeta de sonidos
                var soundsPath = Path.Combine(systemFilesPath, "sounds");
                if (Directory.Exists(soundsPath))
                {
                    var soundFiles = Directory.GetFiles(soundsPath)
                        .Where(f => {
                            var ext = Path.GetExtension(f).ToLowerInvariant();
                            return ext == ".mp3" || ext == ".wav" || ext == ".ogg";
                        })
                        .Select(f => new SystemFileInfo
                        {
                            Name = Path.GetFileName(f),
                            Path = $"/system-files/sounds/{Path.GetFileName(f)}",
                            Type = "sound",
                            Size = new FileInfo(f).Length
                        });
                    files.AddRange(soundFiles);
                }

                // Escanear carpeta de videos
                var videosPath = Path.Combine(systemFilesPath, "videos");
                if (Directory.Exists(videosPath))
                {
                    var videoFiles = Directory.GetFiles(videosPath)
                        .Where(f => {
                            var ext = Path.GetExtension(f).ToLowerInvariant();
                            return ext == ".mp4" || ext == ".webm";
                        })
                        .Select(f => new SystemFileInfo
                        {
                            Name = Path.GetFileName(f),
                            Path = $"/system-files/videos/{Path.GetFileName(f)}",
                            Type = "video",
                            Size = new FileInfo(f).Length
                        });
                    files.AddRange(videoFiles);
                }

                // Escanear carpeta de imágenes
                var imagesPath = Path.Combine(systemFilesPath, "images");
                if (Directory.Exists(imagesPath))
                {
                    var imageFiles = Directory.GetFiles(imagesPath)
                        .Where(f => {
                            var ext = Path.GetExtension(f).ToLowerInvariant();
                            return ext == ".png" || ext == ".jpg" || ext == ".jpeg";
                        })
                        .Select(f => new SystemFileInfo
                        {
                            Name = Path.GetFileName(f),
                            Path = $"/system-files/images/{Path.GetFileName(f)}",
                            Type = "image",
                            Size = new FileInfo(f).Length
                        });
                    files.AddRange(imageFiles);
                }

                return Ok(new
                {
                    success = true,
                    files = files.OrderBy(f => f.Type).ThenBy(f => f.Name)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error listando archivos del sistema");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Asigna un archivo del sistema a una recompensa
        /// </summary>
        [HttpPost("assign-system-file")]
        public async Task<IActionResult> AssignSystemFile([FromBody] AssignSystemFileRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                // Validar que el archivo del sistema existe
                var fullPath = Path.Combine("ClientApp", "public", request.SystemFilePath.TrimStart('/'));
                _logger.LogInformation($"🎵 [DEBUG] Asignar archivo del sistema - SystemFilePath: {request.SystemFilePath}, FullPath: {fullPath}, Exists: {System.IO.File.Exists(fullPath)}");

                if (!System.IO.File.Exists(fullPath))
                {
                    return BadRequest(new { success = false, message = $"Archivo del sistema no encontrado: {fullPath}" });
                }

                // Verificar si ya existe un archivo para esta recompensa
                var existingFile = await _dbContext.SoundAlertFiles
                    .FirstOrDefaultAsync(f => f.Username == username && f.RewardId == request.RewardId);

                if (existingFile != null)
                {
                    // Eliminar archivo anterior solo si no es del sistema
                    if (!existingFile.IsSystemFile)
                    {
                        if (!string.IsNullOrEmpty(existingFile.FilePath) && System.IO.File.Exists(existingFile.FilePath))
                        {
                            System.IO.File.Delete(existingFile.FilePath);
                        }
                        if (!string.IsNullOrEmpty(existingFile.ImagePath) && System.IO.File.Exists(existingFile.ImagePath))
                        {
                            System.IO.File.Delete(existingFile.ImagePath);
                        }
                    }

                    // Actualizar a archivo del sistema
                    _logger.LogInformation($"🎵 [DEBUG] Actualizando archivo existente ID: {existingFile.Id} - Old IsSystemFile: {existingFile.IsSystemFile}, Old FilePath: {existingFile.FilePath}");
                    existingFile.IsSystemFile = true;
                    existingFile.FileType = request.FileType;
                    existingFile.FilePath = fullPath;
                    existingFile.FileName = request.SystemFileName;
                    existingFile.FileSize = new FileInfo(fullPath).Length;
                    existingFile.DurationSeconds = 0; // El frontend debería enviar la duración si la conoce
                    existingFile.RewardTitle = request.RewardTitle;
                    existingFile.ImagePath = null;
                    existingFile.ImageName = null;
                    existingFile.UpdatedAt = DateTime.UtcNow;
                    _logger.LogInformation($"🎵 [DEBUG] Archivo actualizado - New IsSystemFile: {existingFile.IsSystemFile}, New FilePath: {existingFile.FilePath}");
                }
                else
                {
                    // Crear nuevo registro con archivo del sistema
                    var soundAlertFile = new Core.Models.SoundAlertFile
                    {
                        Username = username,
                        RewardId = request.RewardId,
                        RewardTitle = request.RewardTitle,
                        FileType = request.FileType,
                        FilePath = fullPath,
                        FileName = request.SystemFileName,
                        FileSize = new FileInfo(fullPath).Length,
                        DurationSeconds = 0,
                        IsSystemFile = true,
                        Enabled = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _dbContext.SoundAlertFiles.Add(soundAlertFile);
                }

                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"🎵 [SoundAlerts] Archivo del sistema asignado para {username}: {request.SystemFileName} (Reward: {request.RewardTitle})");

                return Ok(new
                {
                    success = true,
                    message = "Archivo del sistema asignado exitosamente"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error asignando archivo del sistema");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Envía una alerta de prueba a través de SignalR
        /// </summary>
        [HttpPost("test")]
        public async Task<IActionResult> SendTestAlert()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                // Obtener configuración del canal
                var config = await _dbContext.SoundAlertConfigs
                    .FirstOrDefaultAsync(c => c.Username == username);

                // Valores por defecto si no hay configuración
                int globalVolume = config?.GlobalVolume ?? 70;
                int duration = config?.Duration ?? 10;
                string textLines = config?.TextLines ?? "[{\"text\":\"@redeemer canjeó @reward\",\"fontSize\":24,\"fontWeight\":\"bold\",\"enabled\":true},{\"text\":\"¡Gracias por el apoyo!\",\"fontSize\":18,\"fontWeight\":\"600\",\"enabled\":true}]";
                string styles = config?.Styles ?? "{\"fontFamily\":\"Inter\",\"textColor\":\"#ffffff\",\"textShadow\":\"normal\",\"backgroundType\":\"transparent\",\"gradientColor1\":\"#667eea\",\"gradientColor2\":\"#764ba2\",\"gradientAngle\":135,\"solidColor\":\"#8b5cf6\",\"backgroundOpacity\":100}";
                string layout = config?.Layout ?? "{\"media\":{\"x\":100,\"y\":20,\"width\":200,\"height\":200},\"text\":{\"x\":200,\"y\":300,\"align\":\"center\"}}";
                string animationType = config?.AnimationType ?? "fade";
                string animationSpeed = config?.AnimationSpeed ?? "normal";
                bool textOutlineEnabled = config?.TextOutlineEnabled ?? false;
                string textOutlineColor = config?.TextOutlineColor ?? "#000000";
                int textOutlineWidth = config?.TextOutlineWidth ?? 2;

                // Obtener el primer archivo disponible para testing, o null si no hay
                var file = await _dbContext.SoundAlertFiles
                    .Where(f => f.Username == username && f.Enabled)
                    .OrderByDescending(f => f.UpdatedAt)
                    .FirstOrDefaultAsync();

                string? fileUrl = null;
                string? imageUrl = null;
                string fileType = "sound";

                if (file != null)
                {
                    // Determinar la URL correcta según si es archivo del sistema o de usuario
                    if (file.IsSystemFile)
                    {
                        // Archivo del sistema: usar la ruta almacenada directamente
                        // FilePath es algo como "ClientApp/public/system-files/videos/fbi.mp4"
                        // Convertir a URL: "/system-files/videos/fbi.mp4"
                        var relativePath = file.FilePath.Replace("ClientApp/public", "").Replace("\\", "/");
                        if (!relativePath.StartsWith("/"))
                            relativePath = "/" + relativePath;
                        fileUrl = relativePath;

                        // Para archivos del sistema, ImagePath también sería un path del sistema si existe
                        if (!string.IsNullOrEmpty(file.ImagePath))
                        {
                            var relativeImagePath = file.ImagePath.Replace("ClientApp/public", "").Replace("\\", "/");
                            if (!relativeImagePath.StartsWith("/"))
                                relativeImagePath = "/" + relativeImagePath;
                            imageUrl = relativeImagePath;
                        }
                    }
                    else
                    {
                        // Archivo de usuario: construir URL con username
                        var fileName = Path.GetFileName(file.FilePath);
                        fileUrl = $"/uploads/soundalerts/{username}/{fileName}";

                        // Agregar imagen si está disponible (usar nombre físico del archivo)
                        if (!string.IsNullOrEmpty(file.ImagePath))
                        {
                            var physicalImageName = Path.GetFileName(file.ImagePath);
                            imageUrl = $"/uploads/soundalerts/{username}/{physicalImageName}";
                        }
                    }

                    fileType = file.FileType;
                }

                // Crear datos de la alerta de prueba
                var alertData = new
                {
                    type = "soundalert",
                    redeemer = "TestUser",
                    reward = "Alerta de Prueba",
                    fileUrl = fileUrl,
                    imageUrl = imageUrl,
                    fileType = fileType,
                    volume = globalVolume,
                    duration = duration,
                    textLines = textLines,
                    styles = styles,
                    layout = layout,
                    animation = new
                    {
                        type = animationType,
                        speed = animationSpeed
                    },
                    textOutline = new
                    {
                        enabled = textOutlineEnabled,
                        color = textOutlineColor,
                        width = textOutlineWidth
                    }
                };

                // Enviar a través de SignalR
                await _hubContext.Clients.Group($"overlay_{username}")
                    .SendAsync("ShowSoundAlert", alertData);

                _logger.LogInformation($"🎵 [SoundAlerts] Alerta de prueba enviada para {username}");

                return Ok(new
                {
                    success = true,
                    message = "Alerta de prueba enviada exitosamente",
                    hasFile = file != null
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error enviando alerta de prueba");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Obtiene el username del propietario del canal
        /// </summary>
        private async Task<string?> GetChannelUsernameAsync(long channelOwnerId)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == channelOwnerId);
            return user?.Login?.ToLower();
        }

        // DTOs para requests
        public class SaveConfigRequest
        {
            public int GlobalVolume { get; set; } = 70;
            public bool GlobalEnabled { get; set; } = true;
            public int Duration { get; set; } = 10;
            public List<TextLineDto> TextLines { get; set; } = new();
            public StylesDto Styles { get; set; } = new();
            public LayoutDto Layout { get; set; } = new();
            public string AnimationType { get; set; } = "fade";
            public string AnimationSpeed { get; set; } = "normal";
            public bool TextOutlineEnabled { get; set; } = false;
            public string TextOutlineColor { get; set; } = "#000000";
            public int TextOutlineWidth { get; set; } = 2;
            public int CooldownMs { get; set; } = 500;
        }

        public class TextLineDto
        {
            public string Text { get; set; } = "";
            public int FontSize { get; set; } = 32;
            public string FontWeight { get; set; } = "bold";
            public bool Enabled { get; set; } = true;
        }

        public class StylesDto
        {
            public string FontFamily { get; set; } = "Inter";
            public int FontSize { get; set; } = 32;
            public string TextColor { get; set; } = "#ffffff";
            public string TextShadow { get; set; } = "normal";
            public string BackgroundType { get; set; } = "gradient";
            public string GradientColor1 { get; set; } = "#667eea";
            public string GradientColor2 { get; set; } = "#764ba2";
            public int GradientAngle { get; set; } = 135;
            public string SolidColor { get; set; } = "#8b5cf6";
            public int BackgroundOpacity { get; set; } = 100;
        }

        public class LayoutDto
        {
            public MediaPositionDto Media { get; set; } = new();
            public TextPositionDto Text { get; set; } = new();
        }

        public class MediaPositionDto
        {
            public int X { get; set; } = 0;
            public int Y { get; set; } = 0;
            public int Width { get; set; } = 400;
            public int Height { get; set; } = 400;
        }

        public class TextPositionDto
        {
            public int X { get; set; } = 200;
            public int Y { get; set; } = 420;
            public string Align { get; set; } = "center";
        }

        public class UploadFileRequest
        {
            public IFormFile File { get; set; } = null!;
            public IFormFile? ImageFile { get; set; } // Imagen opcional para archivos de audio
            public string RewardId { get; set; } = "";
            public string RewardTitle { get; set; } = "";
            public string FileType { get; set; } = ""; // sound, video, image
            public decimal DurationSeconds { get; set; } = 0;
        }

        public class UpdateVolumeRequest
        {
            public int Volume { get; set; }
        }

        public class AssignSystemFileRequest
        {
            public string RewardId { get; set; } = "";
            public string RewardTitle { get; set; } = "";
            public string SystemFilePath { get; set; } = ""; // e.g. "/system-files/sounds/fbi.mp3"
            public string SystemFileName { get; set; } = ""; // e.g. "fbi.mp3"
            public string FileType { get; set; } = ""; // sound, video, image
        }

        public class SystemFileInfo
        {
            public string Name { get; set; } = "";
            public string Path { get; set; } = "";
            public string Type { get; set; } = ""; // sound, video, image
            public long Size { get; set; }
        }

        // DTOs para respuestas de Twitch API
        private class TwitchApiResponse
        {
            public List<ChannelPointsReward>? data { get; set; }
        }

        private class ChannelPointsReward
        {
            public string id { get; set; } = "";
            public string broadcaster_id { get; set; } = "";
            public string broadcaster_login { get; set; } = "";
            public string broadcaster_name { get; set; } = "";
            public string title { get; set; } = "";
            public string prompt { get; set; } = "";
            public int cost { get; set; }
            public bool is_enabled { get; set; }
            public bool is_paused { get; set; }
            public bool is_in_stock { get; set; }
            public string background_color { get; set; } = "";
            public bool should_redemptions_skip_request_queue { get; set; }
            public int? max_per_stream { get; set; }
            public int? max_per_user_per_stream { get; set; }
            public int? global_cooldown_seconds { get; set; }
            public bool is_user_input_required { get; set; }
        }
    }
}
