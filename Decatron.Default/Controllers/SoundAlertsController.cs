using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
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
        private readonly IKickApiService _kickApiService;
        private const string TwitchApiBaseUrl = "https://api.twitch.tv/helix";

        public SoundAlertsController(
            DecatronDbContext dbContext,
            ILogger<SoundAlertsController> logger,
            IOptions<TwitchSettings> twitchSettings,
            IHttpClientFactory httpClientFactory,
            IHubContext<OverlayHub> hubContext,
            IKickApiService kickApiService)
        {
            _dbContext = dbContext;
            _logger = logger;
            _twitchSettings = twitchSettings.Value;
            _httpClientFactory = httpClientFactory;
            _hubContext = hubContext;
            _kickApiService = kickApiService;
        }

        /// <summary>
        /// Kick no expone is_enabled/is_paused/is_in_stock/background_color en
        /// channel rewards — se completan con los defaults que el frontend ya
        /// entiende (mismo shape que ChannelPointsReward de Twitch, para no
        /// tocar el picker de rewards del lado del cliente).
        /// </summary>
        private async Task<IActionResult> GetKickChannelRewardsAsync(Decatron.Core.Models.User user)
        {
            if (string.IsNullOrEmpty(user.KickAccessToken))
            {
                _logger.LogWarning($"🎵 [SoundAlerts] Access token de Kick no disponible para: {user.KickUsername}");
                return BadRequest(new { success = false, message = "Token de acceso de Kick no disponible. Por favor, vuelve a autenticarte." });
            }

            var kickRewards = await _kickApiService.GetChannelRewardsAsync(user.KickAccessToken);
            _logger.LogInformation($"🎵 [SoundAlerts] ✅ Recompensas de Kick obtenidas para {user.KickUsername}: {kickRewards.Count} recompensas");

            var rewards = kickRewards.Select(r => new ChannelPointsReward
            {
                id = r.Id,
                title = r.Title,
                cost = r.Cost,
                prompt = r.Description,
                is_enabled = true,
                background_color = "",
                is_paused = false,
                is_in_stock = true,
            });

            return Ok(new
            {
                success = true,
                rewards,
                // El nombre visible de Kick puede coincidir con un login de
                // Twitch de otra cuenta (o de la propia, si vinculaste ambas) —
                // channelName es lo que arma la URL del overlay en OBS, tiene
                // que ser el kick_id numerico para no pisar esa config. Ver
                // GetOverlayConfiguration, que ya resuelve por ese mismo campo.
                // La config de overlay (posicion/tamaño) es independiente por
                // plataforma a proposito — solo los archivos de media se comparten.
                channelName = user.KickId,
                channelDisplayName = user.KickUsername
            });
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
        /// Obtiene las recompensas de puntos de canal desde Twitch, o desde Kick
        /// si el canal activo es de Kick (channel rewards — plan seccion 8, item 3).
        /// </summary>
        [HttpGet("channel-points-rewards")]
        public async Task<IActionResult> GetChannelPointsRewards()
        {
            try
            {
                _logger.LogInformation("🎵 [SoundAlerts] Iniciando obtención de recompensas de puntos de canal");

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

                if (user.KickId != null)
                    return await GetKickChannelRewardsAsync(user);

                // Validar configuración
                if (string.IsNullOrEmpty(_twitchSettings?.ClientId))
                {
                    _logger.LogError("🎵 [SoundAlerts] ClientId de Twitch no configurado");
                    return StatusCode(500, new { success = false, message = "Configuración de Twitch no disponible" });
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

                // ResolveChannelInfoAsync prueba login de Twitch primero y, si no
                // matchea, kick_id numerico — a diferencia de ResolveUserIdAsync
                // (solo Twitch), esto evita que un canal de Kick con el mismo
                // nombre visible que un login de Twitch pise su configuracion. La
                // config de overlay es independiente por plataforma (fila) a
                // propósito — solo la galería de media es compartida entre Twitch
                // y Kick de la misma persona.
                var username = channel.ToLower();
                var channelInfo = await ChannelResolver.ResolveChannelInfoAsync(_dbContext, channel);
                var config = await _dbContext.SoundAlertConfigs
                    .FirstOrDefaultAsync(c => channelInfo != null ? c.UserId == channelInfo.UserId : c.Username == username);

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
                var layoutDto = JsonSerializer.Deserialize<LayoutDto>(config.Layout, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

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
                var username = await GetPlatformUsernameAsync(channelOwnerId);

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
                var layoutDto = JsonSerializer.Deserialize<LayoutDto>(config.Layout, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

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
                var username = await GetPlatformUsernameAsync(channelOwnerId);

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

                var camelCaseOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
                var textLinesJson = JsonSerializer.Serialize(request.TextLines, camelCaseOptions);
                var stylesJson = JsonSerializer.Serialize(request.Styles, camelCaseOptions);
                var layoutJson = JsonSerializer.Serialize(request.Layout, camelCaseOptions);

                _logger.LogInformation($"🎵 [DEBUG] Layout recibido del frontend: {layoutJson}");

                if (config == null)
                {
                    config = new Core.Models.SoundAlertConfig
                    {
                        Username = username,
                        UserId = channelOwnerId,
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

                var mappings = await _dbContext.SoundAlertRewardFiles
                    .Include(m => m.MediaFile)
                    .Where(m => m.UserId == channelOwnerId)
                    .OrderByDescending(m => m.CreatedAt)
                    .ToListAsync();

                return Ok(new
                {
                    success = true,
                    files = mappings.Select(m => new
                    {
                        id = m.Id,
                        rewardId = m.RewardId,
                        rewardTitle = m.RewardTitle,
                        fileType = m.MediaFile?.FileType ?? InferSystemFileType(m.SystemFilePath ?? ""),
                        fileName = m.MediaFile?.FileName ?? Path.GetFileName(m.SystemFilePath ?? ""),
                        fileUrl = ToPublicPath(m.MediaFile?.FilePath ?? m.SystemFilePath ?? ""),
                        fileSize = m.MediaFile?.FileSize ?? 0,
                        durationSeconds = m.MediaFile?.DurationSeconds ?? 0,
                        volume = m.Volume,
                        enabled = m.Enabled,
                        playCount = m.MediaFile?.UsageCount ?? 0,
                        createdAt = m.CreatedAt,
                        showImage = m.ShowImage,
                        imageUrl = m.ImageUrl,
                        imageSource = m.ImageSource,
                        imagePath = m.ImagePath,
                        imagePublicUrl = string.IsNullOrEmpty(m.ImagePath) ? null : ToPublicPath(m.ImagePath)
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
                    if (imageExtension != ".png" && imageExtension != ".jpg" && imageExtension != ".jpeg" && imageExtension != ".gif")
                    {
                        return BadRequest(new { success = false, message = "Formato de imagen no válido. Use PNG, JPG, JPEG o GIF" });
                    }

                    // Validar tamaño (10MB máximo)
                    if (request.ImageFile.Length > 10 * 1024 * 1024)
                    {
                        return BadRequest(new { success = false, message = "La imagen excede el tamaño máximo de 10MB" });
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

                // Verificar si ya existe un mapeo para esta recompensa
                var existingMapping = await _dbContext.SoundAlertRewardFiles
                    .Include(m => m.MediaFile)
                    .FirstOrDefaultAsync(m => m.UserId == channelOwnerId && m.RewardId == request.RewardId);

                // Si el mapeo anterior era un archivo de la galeria (no de
                // sistema) y nadie mas lo referencia, se borra junto con el
                // fisico — mismo criterio que antes, aplicado al nuevo esquema.
                if (existingMapping?.MediaFile != null)
                {
                    var oldMediaFile = existingMapping.MediaFile;
                    var stillReferenced = await _dbContext.SoundAlertRewardFiles
                        .AnyAsync(m => m.MediaFileId == oldMediaFile.Id && m.Id != existingMapping.Id);

                    if (!stillReferenced)
                    {
                        var oldFullPath = Path.Combine(Directory.GetCurrentDirectory(), oldMediaFile.FilePath);
                        if (System.IO.File.Exists(oldFullPath))
                            System.IO.File.Delete(oldFullPath);
                        _dbContext.TimerMediaFiles.Remove(oldMediaFile);
                    }
                }

                if (!string.IsNullOrEmpty(existingMapping?.ImagePath) && System.IO.File.Exists(Path.Combine(Directory.GetCurrentDirectory(), existingMapping.ImagePath.TrimStart('/'))))
                {
                    System.IO.File.Delete(Path.Combine(Directory.GetCurrentDirectory(), existingMapping.ImagePath.TrimStart('/')));
                }

                var newMediaFile = new Core.Models.TimerMediaFile
                {
                    ChannelName = username,
                    UserId = channelOwnerId,
                    FileType = fileType,
                    FilePath = filePath,
                    OriginalFileName = request.File.FileName,
                    FileName = Path.GetFileName(filePath),
                    Category = "sound-alerts",
                    FileSize = request.File.Length,
                    DurationSeconds = (double)request.DurationSeconds,
                    UsageCount = 1,
                    UploadedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };
                _dbContext.TimerMediaFiles.Add(newMediaFile);

                if (existingMapping != null)
                {
                    existingMapping.RewardTitle = request.RewardTitle;
                    existingMapping.MediaFile = newMediaFile;
                    existingMapping.SystemFilePath = null;
                    existingMapping.ImagePath = imagePath;
                    existingMapping.ImageName = imageName;
                    existingMapping.ShowImage = request.ShowImage;
                    existingMapping.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();
                    existingMapping.ImageSource = request.ImageSource ?? "upload";
                    existingMapping.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _dbContext.SoundAlertRewardFiles.Add(new Core.Models.SoundAlertRewardFile
                    {
                        UserId = channelOwnerId,
                        RewardId = request.RewardId,
                        RewardTitle = request.RewardTitle,
                        MediaFile = newMediaFile,
                        ImagePath = imagePath,
                        ImageName = imageName,
                        ShowImage = request.ShowImage,
                        ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim(),
                        ImageSource = request.ImageSource ?? "upload",
                        Enabled = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
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

                var mapping = await _dbContext.SoundAlertRewardFiles
                    .Include(m => m.MediaFile)
                    .FirstOrDefaultAsync(m => m.UserId == channelOwnerId && m.RewardId == rewardId);

                if (mapping == null)
                {
                    return NotFound(new { success = false, message = "Archivo no encontrado" });
                }

                // Eliminar archivo físico SOLO si es de la galería (no de
                // sistema) y ningún otro mapeo lo sigue usando.
                if (mapping.MediaFile != null)
                {
                    var stillReferenced = await _dbContext.SoundAlertRewardFiles
                        .AnyAsync(m => m.MediaFileId == mapping.MediaFileId && m.Id != mapping.Id);

                    if (!stillReferenced)
                    {
                        var fullPath = Path.Combine(Directory.GetCurrentDirectory(), mapping.MediaFile.FilePath);
                        if (System.IO.File.Exists(fullPath))
                        {
                            System.IO.File.Delete(fullPath);
                            _logger.LogInformation($"🎵 [SoundAlerts] Archivo físico eliminado: {fullPath}");
                        }
                        _dbContext.TimerMediaFiles.Remove(mapping.MediaFile);
                    }
                }
                else
                {
                    _logger.LogInformation($"🎵 [SoundAlerts] Archivo del sistema no se elimina físicamente: {mapping.SystemFilePath}");
                }

                // Eliminar registro de la BD
                _dbContext.SoundAlertRewardFiles.Remove(mapping);
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"🎵 [SoundAlerts] Registro eliminado de BD para {username}: reward {rewardId}");

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

                var mapping = await _dbContext.SoundAlertRewardFiles
                    .FirstOrDefaultAsync(m => m.UserId == channelOwnerId && m.RewardId == rewardId);

                if (mapping == null)
                {
                    return NotFound(new { success = false, message = "Archivo no encontrado" });
                }

                mapping.Volume = request.Volume;
                mapping.UpdatedAt = DateTime.UtcNow;
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

                var mapping = await _dbContext.SoundAlertRewardFiles
                    .FirstOrDefaultAsync(m => m.UserId == channelOwnerId && m.RewardId == rewardId);

                if (mapping == null)
                {
                    return NotFound(new { success = false, message = "Archivo no encontrado" });
                }

                mapping.Enabled = !mapping.Enabled;
                mapping.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, enabled = mapping.Enabled });
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

                // Verificar si ya existe un mapeo para esta recompensa
                var existingMapping = await _dbContext.SoundAlertRewardFiles
                    .Include(m => m.MediaFile)
                    .FirstOrDefaultAsync(m => m.UserId == channelOwnerId && m.RewardId == request.RewardId);

                if (existingMapping != null)
                {
                    // Si tenia un archivo de la galeria (no de sistema) y nadie
                    // mas lo referencia, se borra junto con el fisico.
                    if (existingMapping.MediaFile != null)
                    {
                        var stillReferenced = await _dbContext.SoundAlertRewardFiles
                            .AnyAsync(m => m.MediaFileId == existingMapping.MediaFileId && m.Id != existingMapping.Id);

                        if (!stillReferenced)
                        {
                            var oldFullPath = Path.Combine(Directory.GetCurrentDirectory(), existingMapping.MediaFile.FilePath);
                            if (System.IO.File.Exists(oldFullPath))
                                System.IO.File.Delete(oldFullPath);
                            _dbContext.TimerMediaFiles.Remove(existingMapping.MediaFile);
                        }
                    }
                    if (!string.IsNullOrEmpty(existingMapping.ImagePath) && System.IO.File.Exists(Path.Combine(Directory.GetCurrentDirectory(), existingMapping.ImagePath.TrimStart('/'))))
                    {
                        System.IO.File.Delete(Path.Combine(Directory.GetCurrentDirectory(), existingMapping.ImagePath.TrimStart('/')));
                    }

                    _logger.LogInformation($"🎵 [DEBUG] Actualizando mapeo existente ID: {existingMapping.Id} a archivo de sistema: {fullPath}");
                    existingMapping.MediaFile = null;
                    existingMapping.MediaFileId = null;
                    existingMapping.SystemFilePath = fullPath;
                    existingMapping.RewardTitle = request.RewardTitle;
                    existingMapping.ImagePath = null;
                    existingMapping.ImageName = null;
                    existingMapping.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    // Crear nuevo mapeo apuntando al archivo de sistema
                    _dbContext.SoundAlertRewardFiles.Add(new Core.Models.SoundAlertRewardFile
                    {
                        UserId = channelOwnerId,
                        RewardId = request.RewardId,
                        RewardTitle = request.RewardTitle,
                        SystemFilePath = fullPath,
                        Enabled = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
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
        /// Asigna a una recompensa un archivo que ya existe en la galería
        /// compartida (subido antes para Sound Alerts, o para Timer/Event
        /// Alerts/Goals/Discord) — en vez de subir uno nuevo. Ver plan de
        /// unificación de galería de medios (8 ago 2026).
        /// </summary>
        [HttpPost("assign-media-file")]
        public async Task<IActionResult> AssignMediaFile([FromBody] AssignMediaFileRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                // Igual que GetMediaFiles: se busca por ChannelName (nombre canónico
                // de la persona), no por UserId numérico — el archivo pudo haberse
                // subido con otra fila/plataforma vinculada del mismo canal.
                var mediaFile = await _dbContext.TimerMediaFiles
                    .FirstOrDefaultAsync(f => f.Id == request.MediaFileId && f.ChannelName == username);

                if (mediaFile == null)
                    return NotFound(new { success = false, message = "Archivo no encontrado en tu galería" });

                var existingMapping = await _dbContext.SoundAlertRewardFiles
                    .Include(m => m.MediaFile)
                    .FirstOrDefaultAsync(m => m.UserId == channelOwnerId && m.RewardId == request.RewardId);

                if (existingMapping != null)
                {
                    // Si tenia otro archivo de la galeria y nadie mas lo
                    // referencia, se borra junto con el fisico (mismo criterio
                    // que UploadFile/AssignSystemFile).
                    if (existingMapping.MediaFile != null && existingMapping.MediaFileId != mediaFile.Id)
                    {
                        var stillReferenced = await _dbContext.SoundAlertRewardFiles
                            .AnyAsync(m => m.MediaFileId == existingMapping.MediaFileId && m.Id != existingMapping.Id);

                        if (!stillReferenced)
                        {
                            var oldFullPath = Path.Combine(Directory.GetCurrentDirectory(), existingMapping.MediaFile.FilePath);
                            if (System.IO.File.Exists(oldFullPath))
                                System.IO.File.Delete(oldFullPath);
                            _dbContext.TimerMediaFiles.Remove(existingMapping.MediaFile);
                        }
                    }

                    existingMapping.MediaFile = mediaFile;
                    existingMapping.SystemFilePath = null;
                    existingMapping.RewardTitle = request.RewardTitle;
                    existingMapping.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _dbContext.SoundAlertRewardFiles.Add(new Core.Models.SoundAlertRewardFile
                    {
                        UserId = channelOwnerId,
                        RewardId = request.RewardId,
                        RewardTitle = request.RewardTitle,
                        MediaFile = mediaFile,
                        Enabled = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }

                mediaFile.UsageCount += 1;
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"🎵 [SoundAlerts] Archivo de galería {mediaFile.Id} asignado para {username} (Reward: {request.RewardTitle})");

                return Ok(new { success = true, message = "Archivo asignado exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error asignando archivo de galería");
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
                var username = await GetPlatformUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                // Obtener configuración del canal
                var config = await _dbContext.SoundAlertConfigs
                    .FirstOrDefaultAsync(c => c.UserId == channelOwnerId);

                // Valores por defecto si no hay configuración
                int globalVolume = config?.GlobalVolume ?? 70;
                int duration = config?.Duration ?? 10;
                string textLines = config?.TextLines ?? "[{\"text\":\"@redeemer canjeó @reward\",\"fontSize\":24,\"fontWeight\":\"bold\",\"enabled\":true},{\"text\":\"¡Gracias por el apoyo!\",\"fontSize\":18,\"fontWeight\":\"600\",\"enabled\":true}]";
                string styles = config?.Styles ?? "{\"fontFamily\":\"Inter\",\"textColor\":\"#ffffff\",\"textShadow\":\"normal\",\"backgroundType\":\"transparent\",\"gradientColor1\":\"#667eea\",\"gradientColor2\":\"#764ba2\",\"gradientAngle\":135,\"solidColor\":\"#8b5cf6\",\"backgroundOpacity\":100}";
                string layout = config?.Layout ?? "{\"media\":{\"x\":260,\"y\":40,\"width\":1400,\"height\":700},\"text\":{\"x\":460,\"y\":780,\"width\":1000,\"height\":240,\"align\":\"center\"}}";
                string animationType = config?.AnimationType ?? "fade";
                string animationSpeed = config?.AnimationSpeed ?? "normal";
                bool textOutlineEnabled = config?.TextOutlineEnabled ?? false;
                string textOutlineColor = config?.TextOutlineColor ?? "#000000";
                int textOutlineWidth = config?.TextOutlineWidth ?? 2;

                // Obtener el primer mapeo disponible para testing, o null si no hay
                var mapping = await _dbContext.SoundAlertRewardFiles
                    .Include(m => m.MediaFile)
                    .Where(m => m.UserId == channelOwnerId && m.Enabled)
                    .OrderByDescending(m => m.UpdatedAt)
                    .FirstOrDefaultAsync();

                string? fileUrl = null;
                string? imageUrl = null;
                string fileType = "sound";

                if (mapping != null)
                {
                    fileUrl = mapping.MediaFile != null
                        ? ToPublicPath(mapping.MediaFile.FilePath)
                        : ToPublicPath(mapping.SystemFilePath!);

                    fileType = mapping.MediaFile?.FileType ?? InferSystemFileType(mapping.SystemFilePath ?? "");

                    if (mapping.ShowImage)
                    {
                        if (mapping.ImageSource == "url" && !string.IsNullOrEmpty(mapping.ImageUrl))
                        {
                            imageUrl = mapping.ImageUrl;
                        }
                        else if (!string.IsNullOrEmpty(mapping.ImagePath))
                        {
                            imageUrl = ToPublicPath(mapping.ImagePath);
                        }
                    }
                }

                bool showImageFlag = mapping?.ShowImage ?? true;

                // Crear datos de la alerta de prueba
                var alertData = new
                {
                    type = "soundalert",
                    redeemer = "TestUser",
                    reward = "Alerta de Prueba",
                    fileUrl = fileUrl,
                    imageUrl = imageUrl,
                    showImage = showImageFlag,
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
                    hasFile = mapping != null
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "🎵 [SoundAlerts] ❌ Error enviando alerta de prueba");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Edita imagen, volumen y opciones de visualización de un archivo existente
        /// </summary>
        [Authorize]
        [HttpPatch("file/{rewardId}/edit")]
        public async Task<IActionResult> EditFile(string rewardId, [FromForm] EditFileRequest request)
        {
            var channelOwnerId = GetChannelOwnerId();
            var username = await GetChannelUsernameAsync(channelOwnerId);
            if (string.IsNullOrEmpty(username))
                return Unauthorized();

            var mapping = await _dbContext.SoundAlertRewardFiles
                .FirstOrDefaultAsync(m => m.RewardId == rewardId && m.UserId == channelOwnerId);

            if (mapping == null)
                return NotFound(new { error = "Archivo no encontrado" });

            if (request.ImageFile != null && request.ImageFile.Length > 0)
            {
                var imageExt = Path.GetExtension(request.ImageFile.FileName).ToLower();
                var allowedImageExts = new[] { ".png", ".jpg", ".jpeg", ".gif" };
                if (!allowedImageExts.Contains(imageExt))
                    return BadRequest(new { error = "Formato de imagen no soportado. Usa PNG, JPG, JPEG o GIF." });

                if (request.ImageFile.Length > 10 * 1024 * 1024)
                    return BadRequest(new { error = "La imagen no puede superar los 10MB." });

                if (!string.IsNullOrEmpty(mapping.ImagePath))
                {
                    var oldImageFullPath = Path.Combine(Directory.GetCurrentDirectory(), "ClientApp", "public", mapping.ImagePath.TrimStart('/'));
                    if (System.IO.File.Exists(oldImageFullPath))
                        System.IO.File.Delete(oldImageFullPath);
                }

                var sanitizedUsername = string.Concat(username.Where(c => char.IsLetterOrDigit(c) || c == '_'));
                var uploadDir = Path.Combine(Directory.GetCurrentDirectory(), "ClientApp", "public", "uploads", "soundalerts", sanitizedUsername);
                Directory.CreateDirectory(uploadDir);

                var imageFileName = $"{Guid.NewGuid()}{imageExt}";
                var imageFilePath = Path.Combine(uploadDir, imageFileName);
                using (var stream = new FileStream(imageFilePath, FileMode.Create))
                    await request.ImageFile.CopyToAsync(stream);

                mapping.ImagePath = $"/uploads/soundalerts/{sanitizedUsername}/{imageFileName}";
                mapping.ImageName = request.ImageFile.FileName;
            }

            mapping.ShowImage = request.ShowImage;
            mapping.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();
            mapping.ImageSource = request.ImageSource ?? "upload";
            if (request.Volume.HasValue)
                mapping.Volume = Math.Clamp(request.Volume.Value, 0, 100);
            mapping.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // Delegan al helper compartido (Decatron.Core.Helpers.MediaPathHelpers)
        // que también usa la API pública de Decatron — antes esta lógica
        // estaba duplicada ahí.
        private static string ToPublicPath(string filePath) => MediaPathHelpers.ToPublicPath(filePath);

        private static string InferSystemFileType(string systemFilePath) => MediaPathHelpers.InferSystemFileType(systemFilePath);

        /// <summary>
        /// Obtiene el username del propietario del canal
        /// </summary>
        /// <summary>
        /// Resuelve el nombre de canal bajo el que se guarda/busca la media. Es UN
        /// SOLO nombre por persona (AccountId), sin importar con qué plataforma
        /// vinculada esté activa la sesión ahora — si no, la media queda "invisible"
        /// al entrar con Kick porque se guardó bajo el nombre de Twitch (o viceversa).
        /// Se prioriza el Login real de Twitch; el Login de una fila Kick-only es un
        /// placeholder ("kick_{id}"), no un nombre real, por eso se usa KickUsername.
        /// </summary>
        private async Task<string?> GetChannelUsernameAsync(long channelOwnerId)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == channelOwnerId);
            if (user == null)
                return null;

            var linkedUsers = user.AccountId != null
                ? await _dbContext.Users.Where(u => u.AccountId == user.AccountId).ToListAsync()
                : new List<Decatron.Core.Models.User> { user };

            var twitchRow = linkedUsers.FirstOrDefault(u => u.TwitchId != null);
            if (twitchRow != null)
                return twitchRow.Login?.ToLower();

            var kickRow = linkedUsers.FirstOrDefault(u => u.KickUsername != null);
            if (kickRow != null)
                return kickRow.KickUsername?.ToLower();

            return user.Login?.ToLower();
        }

        /// <summary>
        /// Clave de la fila/plataforma ACTIVA (no unificada por AccountId) — a
        /// propósito distinto de GetChannelUsernameAsync. La config de overlay
        /// (posición, tamaño, colores) es independiente entre Twitch y Kick; solo
        /// la galería de archivos de media se comparte entre plataformas.
        /// </summary>
        private async Task<string?> GetPlatformUsernameAsync(long channelOwnerId)
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
            public int X { get; set; }
            public int Y { get; set; }
            public int Width { get; set; }
            public int Height { get; set; }
        }

        public class TextPositionDto
        {
            public int X { get; set; }
            public int Y { get; set; }
            public int? Width { get; set; }
            public int? Height { get; set; }
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
            public bool ShowImage { get; set; } = true;
            public string? ImageUrl { get; set; }
            public string ImageSource { get; set; } = "upload";
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

        public class AssignMediaFileRequest
        {
            public string RewardId { get; set; } = "";
            public string RewardTitle { get; set; } = "";
            public int MediaFileId { get; set; }
        }

        public class EditFileRequest
        {
            public IFormFile? ImageFile { get; set; }
            public bool ShowImage { get; set; } = true;
            public string? ImageUrl { get; set; }
            public string ImageSource { get; set; } = "upload";
            public int? Volume { get; set; }
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
