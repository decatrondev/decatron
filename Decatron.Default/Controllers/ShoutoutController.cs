using System.Security.Claims;
using System.Text.Json;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ShoutoutController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<ShoutoutController> _logger;

        public ShoutoutController(
            DecatronDbContext dbContext,
            ILogger<ShoutoutController> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
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
                _logger.LogInformation($"[Shoutout] Using channel from session: {sessionId}");
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                _logger.LogInformation($"[Shoutout] Using channel from JWT claim: {channelOwnerId}");
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            var userId = GetUserId();
            _logger.LogInformation($"[Shoutout] Using user's own channel: {userId}");
            return userId;
        }

        /// <summary>
        /// Obtiene el username del propietario del canal
        /// </summary>
        private async Task<string?> GetChannelUsernameAsync(long channelOwnerId)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == channelOwnerId);
            return user?.Login?.ToLower();
        }

        /// <summary>
        /// Obtiene la configuración del shoutout del canal activo
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

                _logger.LogInformation($"Obteniendo configuración de shoutout para canal: {username} (ID: {channelOwnerId})");

                var config = await _dbContext.ShoutoutConfigs
                    .FirstOrDefaultAsync(c => c.Username == username);

                if (config == null)
                {
                    // Retornar configuración por defecto
                    return Ok(new
                    {
                        success = true,
                        config = GetDefaultConfiguration()
                    });
                }

                var response = new
                {
                    success = true,
                    config = new
                    {
                        duration = config.Duration,
                        cooldown = config.Cooldown,
                        showDebugTimer = config.ShowDebugTimer,
                        shoutoutText = config.ShoutoutText,
                        textLines = ParseJsonArray(config.TextLines),
                        styles = ParseJsonObject(config.Styles),
                        layout = ParseJsonObject(config.Layout),
                        animationType = config.AnimationType,
                        animationSpeed = config.AnimationSpeed,
                        textOutlineEnabled = config.TextOutlineEnabled,
                        textOutlineColor = config.TextOutlineColor,
                        textOutlineWidth = config.TextOutlineWidth,
                        containerBorderEnabled = config.ContainerBorderEnabled,
                        containerBorderColor = config.ContainerBorderColor,
                        containerBorderWidth = config.ContainerBorderWidth,
                        blacklist = ParseStringArray(config.Blacklist),
                        whitelist = ParseStringArray(config.Whitelist)
                    }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo configuración de shoutout");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Obtiene la configuración del shoutout para el overlay (público, sin autenticación)
        /// </summary>
        [AllowAnonymous]
        [HttpGet("config/overlay/{channel}")]
        public async Task<IActionResult> GetOverlayConfiguration(string channel)
        {
            try
            {
                channel = channel.ToLower();
                _logger.LogInformation($"Obteniendo configuración de overlay para: {channel}");

                var config = await _dbContext.ShoutoutConfigs
                    .FirstOrDefaultAsync(c => c.Username == channel);

                if (config == null)
                {
                    // Retornar configuración por defecto
                    return Ok(new
                    {
                        success = true,
                        config = GetDefaultConfiguration()
                    });
                }

                var response = new
                {
                    success = true,
                    config = new
                    {
                        duration = config.Duration,
                        showDebugTimer = config.ShowDebugTimer,
                        shoutoutText = config.ShoutoutText,
                        textLines = ParseJsonArray(config.TextLines),
                        styles = ParseJsonObject(config.Styles),
                        layout = ParseJsonObject(config.Layout),
                        animationType = config.AnimationType,
                        animationSpeed = config.AnimationSpeed,
                        textOutlineEnabled = config.TextOutlineEnabled,
                        textOutlineColor = config.TextOutlineColor,
                        textOutlineWidth = config.TextOutlineWidth,
                        containerBorderEnabled = config.ContainerBorderEnabled,
                        containerBorderColor = config.ContainerBorderColor,
                        containerBorderWidth = config.ContainerBorderWidth
                    }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo configuración de overlay para {channel}");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Guarda la configuración del shoutout del canal activo
        /// </summary>
        [HttpPost("config")]
        public async Task<IActionResult> SaveConfiguration([FromBody] ShoutoutConfigRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                _logger.LogInformation($"Guardando configuración de shoutout para canal: {username} (ID: {channelOwnerId})");

                // Validaciones
                if (request.Duration < 5 || request.Duration > 60)
                {
                    return BadRequest(new { success = false, message = "La duración debe estar entre 5 y 60 segundos" });
                }

                if (request.Cooldown < 0 || request.Cooldown > 300)
                {
                    return BadRequest(new { success = false, message = "El cooldown debe estar entre 0 y 300 segundos" });
                }

                var config = await _dbContext.ShoutoutConfigs
                    .FirstOrDefaultAsync(c => c.Username == username);

                if (config == null)
                {
                    config = new ShoutoutConfig
                    {
                        Username = username,
                        CreatedAt = DateTime.UtcNow
                    };
                    _dbContext.ShoutoutConfigs.Add(config);
                }

                config.Duration = request.Duration;
                config.Cooldown = request.Cooldown;
                config.ShowDebugTimer = request.ShowDebugTimer;
                config.ShoutoutText = request.ShoutoutText;
                config.TextLines = JsonSerializer.Serialize(request.TextLines ?? new List<object>());
                config.Styles = JsonSerializer.Serialize(request.Styles ?? new object());
                config.Layout = JsonSerializer.Serialize(request.Layout ?? new object());
                config.AnimationType = request.AnimationType ?? "none";
                config.AnimationSpeed = request.AnimationSpeed ?? "normal";
                config.TextOutlineEnabled = request.TextOutlineEnabled;
                config.TextOutlineColor = request.TextOutlineColor ?? "#000000";
                config.TextOutlineWidth = request.TextOutlineWidth;
                config.ContainerBorderEnabled = request.ContainerBorderEnabled;
                config.ContainerBorderColor = request.ContainerBorderColor ?? "#ffffff";
                config.ContainerBorderWidth = request.ContainerBorderWidth;
                config.Blacklist = JsonSerializer.Serialize(request.Blacklist ?? new List<string>());
                config.Whitelist = JsonSerializer.Serialize(request.Whitelist ?? new List<string>());
                config.UpdatedAt = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"✅ Configuración guardada para {username}");

                // Notificar al overlay para que recargue la configuración en tiempo real
                try
                {
                    var overlayNotificationService = HttpContext.RequestServices.GetRequiredService<OverlayNotificationService>();
                    await overlayNotificationService.NotifyConfigurationChangedAsync(username);
                    _logger.LogInformation($"📡 Notificación de cambio de configuración enviada a overlay de {username}");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error enviando notificación de cambio de configuración (no crítico)");
                }

                return Ok(new
                {
                    success = true,
                    message = "Configuración guardada correctamente"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando configuración de shoutout");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Envía un shoutout de prueba al overlay del canal activo
        /// </summary>
        [HttpPost("test")]
        public async Task<IActionResult> TestShoutout()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                _logger.LogInformation($"🧪 Shoutout de prueba solicitado para canal: {username} (ID: {channelOwnerId})");

                // Enviar al overlay vía SignalR
                var overlayNotificationService = HttpContext.RequestServices.GetRequiredService<OverlayNotificationService>();
                await overlayNotificationService.SendShoutoutAsync(username, new Services.ShoutoutData
                {
                    Username = username,
                    DisplayName = username.ToUpper(),
                    GameName = "Just Chatting",
                    ProfileImageUrl = "https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-300x300.png",
                    ClipUrl = "",
                    ClipId = ""
                }, null);

                return Ok(new
                {
                    success = true,
                    message = "Shoutout de prueba enviado al overlay"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando shoutout de prueba");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Obtiene el historial de shoutouts del canal activo
        /// </summary>
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] int limit = 50)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                _logger.LogInformation($"Obteniendo historial de shoutouts para canal: {username} (ID: {channelOwnerId})");

                var history = await _dbContext.ShoutoutHistories
                    .Where(h => h.ChannelName == username)
                    .OrderByDescending(h => h.ExecutedAt)
                    .Take(limit)
                    .Select(h => new
                    {
                        id = h.Id,
                        targetUser = h.TargetUser,
                        executedBy = h.ExecutedBy,
                        clipUrl = h.ClipUrl,
                        gameName = h.GameName,
                        executedAt = h.ExecutedAt
                    })
                    .ToListAsync();

                return Ok(new
                {
                    success = true,
                    history
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo historial de shoutouts");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        private object GetDefaultConfiguration()
        {
            return new
            {
                duration = 10,
                cooldown = 30,
                showDebugTimer = false,
                shoutoutText = "🔥 ¡Sigan a @username! 🔥",
                textLines = new[]
                {
                    new
                    {
                        text = "🔥 ¡Sigan a @username! 🔥",
                        fontSize = 32,
                        fontWeight = "bold",
                        enabled = true
                    },
                    new
                    {
                        text = "Jugando: @game",
                        fontSize = 24,
                        fontWeight = "600",
                        enabled = true
                    }
                },
                styles = new
                {
                    fontFamily = "Inter",
                    fontSize = 32,
                    textColor = "#ffffff",
                    textShadow = "normal",
                    backgroundType = "gradient",
                    gradientColor1 = "#667eea",
                    gradientColor2 = "#764ba2",
                    gradientAngle = 135,
                    solidColor = "#8b5cf6",
                    backgroundOpacity = 100
                },
                layout = new
                {
                    clip = new { x = 20, y = 20, width = 400, height = 260 },
                    text = new { x = 699, y = 82, align = "center" },
                    profile = new { x = 660, y = 173, size = 90 }
                },
                animationType = "none",
                animationSpeed = "normal",
                textOutlineEnabled = false,
                textOutlineColor = "#000000",
                textOutlineWidth = 2,
                containerBorderEnabled = false,
                containerBorderColor = "#ffffff",
                containerBorderWidth = 3,
                blacklist = new string[] { },
                whitelist = new string[] { }
            };
        }

        private object? ParseJsonObject(string json)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(json) || json == "{}")
                {
                    return new Dictionary<string, object>();
                }
                // Usar JsonDocument para mantener el JSON original y poder serializarlo correctamente
                using var doc = JsonDocument.Parse(json);
                return JsonSerializer.Deserialize<Dictionary<string, object>>(doc.RootElement.GetRawText());
            }
            catch
            {
                return new Dictionary<string, object>();
            }
        }

        private object? ParseJsonArray(string json)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(json) || json == "[]")
                {
                    return new List<object>();
                }
                // Usar JsonDocument para mantener el JSON original y poder serializarlo correctamente
                using var doc = JsonDocument.Parse(json);
                return JsonSerializer.Deserialize<List<Dictionary<string, object>>>(doc.RootElement.GetRawText());
            }
            catch
            {
                return new List<object>();
            }
        }

        private List<string> ParseStringArray(string json)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(json) || json == "[]")
                {
                    return new List<string>();
                }
                // Parsear array de strings
                using var doc = JsonDocument.Parse(json);
                return JsonSerializer.Deserialize<List<string>>(doc.RootElement.GetRawText()) ?? new List<string>();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"Error parseando array de strings: {json}");
                return new List<string>();
            }
        }
    }

    public class ShoutoutConfigRequest
    {
        public int Duration { get; set; }
        public int Cooldown { get; set; } = 30;
        public bool ShowDebugTimer { get; set; } = false;
        public string? ShoutoutText { get; set; }
        public List<object>? TextLines { get; set; }
        public object? Styles { get; set; }
        public object? Layout { get; set; }
        public string? AnimationType { get; set; } = "none";
        public string? AnimationSpeed { get; set; } = "normal";
        public bool TextOutlineEnabled { get; set; } = false;
        public string? TextOutlineColor { get; set; } = "#000000";
        public int TextOutlineWidth { get; set; } = 2;
        public bool ContainerBorderEnabled { get; set; } = false;
        public string? ContainerBorderColor { get; set; } = "#ffffff";
        public int ContainerBorderWidth { get; set; } = 3;
        public List<string>? Blacklist { get; set; }
        public List<string>? Whitelist { get; set; }
    }
}
