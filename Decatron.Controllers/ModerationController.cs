using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Core.Services;
using Decatron.Data;
using Decatron.Attributes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ModerationController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ModerationService _moderationService;
        private readonly ILogger<ModerationController> _logger;

        public ModerationController(
            DecatronDbContext dbContext,
            ModerationService moderationService,
            ILogger<ModerationController> logger)
        {
            _dbContext = dbContext;
            _moderationService = moderationService;
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
                _logger.LogInformation($"[Moderation] Using channel from session: {sessionId}");
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                _logger.LogInformation($"[Moderation] Using channel from JWT claim: {channelOwnerId}");
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            var userId = GetUserId();
            _logger.LogInformation($"[Moderation] Using user's own channel: {userId}");
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
        /// GET /api/moderation/banned-words - Lista todas las palabras prohibidas del canal
        /// </summary>
        [HttpGet("banned-words")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> GetBannedWords()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var words = await _dbContext.BannedWords
                    .Where(w => w.ChannelName == username)
                    .OrderByDescending(w => w.CreatedAt)
                    .Select(w => new
                    {
                        w.Id,
                        w.Word,
                        w.Severity,
                        w.Detections,
                        w.CreatedAt
                    })
                    .ToListAsync();

                return Ok(new { success = true, words });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error obteniendo palabras prohibidas: {ex.Message}");
                return StatusCode(500, new { success = false, message = "Error al obtener palabras prohibidas" });
            }
        }

        /// <summary>
        /// POST /api/moderation/banned-words - Agrega una nueva palabra prohibida
        /// </summary>
        [HttpPost("banned-words")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> AddBannedWord([FromBody] AddBannedWordRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                // Verificar límite de 500 palabras
                var currentCount = await _dbContext.BannedWords
                    .CountAsync(w => w.ChannelName == username);

                if (currentCount >= 500)
                {
                    return BadRequest(new { success = false, message = "Has alcanzado el límite de 500 palabras prohibidas" });
                }

                // Verificar que la palabra no exista ya
                var exists = await _dbContext.BannedWords
                    .AnyAsync(w => w.ChannelName == username && w.Word.ToLower() == request.Word.ToLower());

                if (exists)
                {
                    return BadRequest(new { success = false, message = "Esta palabra ya está en la lista" });
                }

                var bannedWord = new BannedWord
                {
                    UserId = channelOwnerId,
                    ChannelName = username,
                    Word = request.Word.Trim(),
                    Severity = request.Severity ?? "leve",
                    Detections = 0,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _dbContext.BannedWords.Add(bannedWord);
                await _dbContext.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = "Palabra agregada exitosamente",
                    word = new
                    {
                        bannedWord.Id,
                        bannedWord.Word,
                        bannedWord.Severity,
                        bannedWord.Detections,
                        bannedWord.CreatedAt
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error agregando palabra prohibida: {ex.Message}");
                return StatusCode(500, new { success = false, message = "Error al agregar palabra" });
            }
        }

        /// <summary>
        /// DELETE /api/moderation/banned-words/:id - Elimina una palabra prohibida
        /// </summary>
        [HttpDelete("banned-words/{id}")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> DeleteBannedWord(long id)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var word = await _dbContext.BannedWords
                    .FirstOrDefaultAsync(w => w.Id == id && w.ChannelName == username);

                if (word == null)
                {
                    return NotFound(new { success = false, message = "Palabra no encontrada" });
                }

                _dbContext.BannedWords.Remove(word);
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Palabra eliminada exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error eliminando palabra prohibida: {ex.Message}");
                return StatusCode(500, new { success = false, message = "Error al eliminar palabra" });
            }
        }

        /// <summary>
        /// POST /api/moderation/banned-words/import - Importar palabras desde JSON
        /// </summary>
        [HttpPost("banned-words/import")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> ImportBannedWords([FromBody] ImportBannedWordsRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var currentCount = await _dbContext.BannedWords
                    .CountAsync(w => w.ChannelName == username);

                if (currentCount + request.Words.Count > 500)
                {
                    return BadRequest(new { success = false, message = $"La importación excede el límite de 500 palabras (actualmente tienes {currentCount})" });
                }

                var imported = 0;
                var skipped = 0;

                foreach (var item in request.Words)
                {
                    var exists = await _dbContext.BannedWords
                        .AnyAsync(w => w.ChannelName == username && w.Word.ToLower() == item.Word.ToLower());

                    if (exists)
                    {
                        skipped++;
                        continue;
                    }

                    var bannedWord = new BannedWord
                    {
                        UserId = channelOwnerId,
                        ChannelName = username,
                        Word = item.Word.Trim(),
                        Severity = item.Severity ?? "leve",
                        Detections = 0,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _dbContext.BannedWords.Add(bannedWord);
                    imported++;
                }

                await _dbContext.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = $"Importación completada: {imported} agregadas, {skipped} omitidas por duplicado",
                    imported,
                    skipped
                });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error importando palabras: {ex.Message}");
                return StatusCode(500, new { success = false, message = "Error al importar palabras" });
            }
        }

        /// <summary>
        /// GET /api/moderation/config - Obtiene la configuración de moderación del canal
        /// </summary>
        [HttpGet("config")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var config = await _dbContext.ModerationConfigs
                    .FirstOrDefaultAsync(c => c.ChannelName == username);

                if (config == null)
                {
                    // Retornar configuración por defecto
                    return Ok(new
                    {
                        success = true,
                        config = new
                        {
                            vipImmunity = "escalamiento",
                            subImmunity = "escalamiento",
                            whitelistUsers = new List<string>(),
                            warningMessage = "⚠️ $(user), evita usar ese lenguaje. Strike $(strike)/5",
                            strikeExpiration = "15min",
                            strike1Action = "warning",
                            strike2Action = "timeout_1m",
                            strike3Action = "timeout_5m",
                            strike4Action = "timeout_10m",
                            strike5Action = "ban"
                        }
                    });
                }

                var whitelistUsers = JsonSerializer.Deserialize<List<string>>(config.WhitelistUsers) ?? new List<string>();

                return Ok(new
                {
                    success = true,
                    config = new
                    {
                        config.VipImmunity,
                        config.SubImmunity,
                        whitelistUsers,
                        config.WarningMessage,
                        config.StrikeExpiration,
                        config.Strike1Action,
                        config.Strike2Action,
                        config.Strike3Action,
                        config.Strike4Action,
                        config.Strike5Action
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error obteniendo configuración: {ex.Message}");
                return StatusCode(500, new { success = false, message = "Error al obtener configuración" });
            }
        }

        /// <summary>
        /// POST /api/moderation/config - Actualiza la configuración de moderación
        /// </summary>
        [HttpPost("config")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> UpdateConfig([FromBody] UpdateModerationConfigRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var config = await _dbContext.ModerationConfigs
                    .FirstOrDefaultAsync(c => c.ChannelName == username);

                var whitelistJson = JsonSerializer.Serialize(request.WhitelistUsers ?? new List<string>());

                if (config == null)
                {
                    config = new ModerationConfig
                    {
                        UserId = channelOwnerId,
                        ChannelName = username,
                        VipImmunity = request.VipImmunity ?? "escalamiento",
                        SubImmunity = request.SubImmunity ?? "escalamiento",
                        WhitelistUsers = whitelistJson,
                        WarningMessage = request.WarningMessage ?? "⚠️ $(user), evita usar ese lenguaje. Strike $(strike)/5",
                        DeleteMessage = request.DeleteMessage ?? "🗑️ $(user), mensaje borrado por lenguaje inapropiado. Strike $(strike)/5",
                        TimeoutMessage = request.TimeoutMessage ?? "⏱️ $(user), timeout aplicado por lenguaje inapropiado. Strike $(strike)/5",
                        BanMessage = request.BanMessage ?? "🔨 $(user), has sido baneado por lenguaje inapropiado. Strike $(strike)/5",
                        SeveroMessage = request.SeveroMessage ?? "🔨 $(user), has sido baneado por usar: $(word)",
                        StrikeExpiration = request.StrikeExpiration ?? "15min",
                        Strike1Action = request.Strike1Action ?? "warning",
                        Strike2Action = request.Strike2Action ?? "timeout_1m",
                        Strike3Action = request.Strike3Action ?? "timeout_5m",
                        Strike4Action = request.Strike4Action ?? "timeout_10m",
                        Strike5Action = request.Strike5Action ?? "ban",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _dbContext.ModerationConfigs.Add(config);
                }
                else
                {
                    config.VipImmunity = request.VipImmunity ?? config.VipImmunity;
                    config.SubImmunity = request.SubImmunity ?? config.SubImmunity;
                    config.WhitelistUsers = whitelistJson;
                    config.WarningMessage = request.WarningMessage ?? config.WarningMessage;
                    config.DeleteMessage = request.DeleteMessage ?? config.DeleteMessage;
                    config.TimeoutMessage = request.TimeoutMessage ?? config.TimeoutMessage;
                    config.BanMessage = request.BanMessage ?? config.BanMessage;
                    config.SeveroMessage = request.SeveroMessage ?? config.SeveroMessage;
                    config.StrikeExpiration = request.StrikeExpiration ?? config.StrikeExpiration;
                    config.Strike1Action = request.Strike1Action ?? config.Strike1Action;
                    config.Strike2Action = request.Strike2Action ?? config.Strike2Action;
                    config.Strike3Action = request.Strike3Action ?? config.Strike3Action;
                    config.Strike4Action = request.Strike4Action ?? config.Strike4Action;
                    config.Strike5Action = request.Strike5Action ?? config.Strike5Action;
                    config.UpdatedAt = DateTime.UtcNow;
                }

                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, message = "Configuración guardada exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error guardando configuración: {ex.Message}");
                return StatusCode(500, new { success = false, message = "Error al guardar configuración" });
            }
        }

        /// <summary>
        /// POST /api/moderation/test-message - Prueba un mensaje contra las palabras prohibidas
        /// </summary>
        [HttpPost("test-message")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> TestMessage([FromBody] TestMessageRequest request)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var (hasMatch, matchedWord) = await _moderationService.DetectBannedWordAsync(username, request.Message);

                if (!hasMatch || matchedWord == null)
                {
                    return Ok(new
                    {
                        success = true,
                        hasMatch = false
                    });
                }

                var config = await _moderationService.GetModerationConfigAsync(username);

                // Determinar acción para usuario normal (escalamiento)
                string actionNormal;
                if (matchedWord.Severity == "severo")
                {
                    actionNormal = "Ban directo";
                }
                else if (matchedWord.Severity == "medio")
                {
                    actionNormal = "Timeout 10m directo";
                }
                else
                {
                    actionNormal = $"Escalamiento (Strike 1: {config?.Strike1Action ?? "warning"})";
                }

                // Acción para usuario con inmunidad
                string actionWithImmunity = "Sin sanción (inmunidad total)";
                if (matchedWord.Severity == "severo" || matchedWord.Severity == "medio")
                {
                    actionWithImmunity = actionNormal; // Severidad alta ignora inmunidad parcial
                }

                return Ok(new
                {
                    success = true,
                    hasMatch = true,
                    matchedWord = matchedWord.Word,
                    severity = matchedWord.Severity,
                    actionNormal,
                    actionWithImmunity
                });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error probando mensaje: {ex.Message}");
                return StatusCode(500, new { success = false, message = "Error al probar mensaje" });
            }
        }

        /// <summary>
        /// GET /api/moderation/stats - Obtiene estadísticas de moderación
        /// </summary>
        [HttpGet("stats")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> GetStats()
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);

                if (string.IsNullOrEmpty(username))
                {
                    return NotFound(new { success = false, message = "Canal no encontrado" });
                }

                var today = DateTime.UtcNow.Date;

                var totalWords = await _dbContext.BannedWords
                    .CountAsync(w => w.ChannelName == username);

                var detectionsToday = await _dbContext.ModerationLogs
                    .CountAsync(l => l.ChannelName == username && l.CreatedAt >= today);

                var usersSanctionedToday = await _dbContext.ModerationLogs
                    .Where(l => l.ChannelName == username && l.CreatedAt >= today)
                    .Select(l => l.Username)
                    .Distinct()
                    .CountAsync();

                return Ok(new
                {
                    success = true,
                    stats = new
                    {
                        totalWords,
                        detectionsToday,
                        usersSanctionedToday
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error obteniendo estadísticas: {ex.Message}");
                return StatusCode(500, new { success = false, message = "Error al obtener estadísticas" });
            }
        }
    }

    // Request DTOs
    public class AddBannedWordRequest
    {
        public string Word { get; set; } = "";
        public string? Severity { get; set; }
    }

    public class ImportBannedWordsRequest
    {
        public List<ImportWordItem> Words { get; set; } = new();
    }

    public class ImportWordItem
    {
        public string Word { get; set; } = "";
        public string? Severity { get; set; }
    }

    public class UpdateModerationConfigRequest
    {
        public string? VipImmunity { get; set; }
        public string? SubImmunity { get; set; }
        public List<string>? WhitelistUsers { get; set; }
        public string? WarningMessage { get; set; }
        public string? DeleteMessage { get; set; }
        public string? TimeoutMessage { get; set; }
        public string? BanMessage { get; set; }
        public string? SeveroMessage { get; set; }
        public string? StrikeExpiration { get; set; }
        public string? Strike1Action { get; set; }
        public string? Strike2Action { get; set; }
        public string? Strike3Action { get; set; }
        public string? Strike4Action { get; set; }
        public string? Strike5Action { get; set; }
    }

    public class TestMessageRequest
    {
        public string Message { get; set; } = "";
    }
}
