using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Core.Services;
using Decatron.Core.Services.Moderation;
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
        // Severidad con la que arranca un filtro que el canal nunca configuró
        private static readonly Dictionary<string, string> DefaultSeverities = new()
        {
            [BotPhrasesFilter.FilterKey] = "severo",
        };

        private static string DefaultSeverity(string key) => DefaultSeverities.GetValueOrDefault(key, "leve");

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
                ModerationCache.Invalidate(username);

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
                ModerationCache.Invalidate(username);

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
                ModerationCache.Invalidate(username);

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
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.ChannelName == username)
                    ?? new ModerationConfig();

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
                        config.DeleteMessage,
                        config.TimeoutMessage,
                        config.BanMessage,
                        config.SeveroMessage,
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
                ModerationCache.Invalidate(username);

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

                var hits = await _moderationService.TestMessageAsync(username, request.Message);
                if (!string.IsNullOrEmpty(request.Filter))
                    hits = hits.Where(h => h.Hit.FilterKey == request.Filter).ToList();
                if (hits.Count == 0)
                    return Ok(new { success = true, hasMatch = false });

                var (hit, enabled) = hits[0];
                var config = await _moderationService.GetModerationConfigAsync(username) ?? new ModerationConfig();

                // Con escalamiento (VIP/sub) la severidad baja un nivel antes de decidir la acción
                var reduced = hit.Severity switch { "severo" => "medio", _ => "leve" };

                return Ok(new
                {
                    success = true,
                    hasMatch = true,
                    filter = hit.FilterKey,
                    filterEnabled = enabled,
                    matchedWord = hit.Detail,
                    severity = hit.Severity,
                    actionNormal = ModerationService.PreviewAction(config, hit.Severity, hit.MinimumAction),
                    actionEscalamiento = ModerationService.PreviewAction(config, reduced, hit.MinimumAction)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error probando mensaje: {ex.Message}");
                return StatusCode(500, new { success = false, message = "Error al probar mensaje" });
            }
        }

        /// <summary>
        /// GET /api/moderation/filters - Estado de cada filtro del canal (sin fila = apagado)
        /// </summary>
        [HttpGet("filters")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> GetFilters()
        {
            try
            {
                var username = await GetChannelUsernameAsync(GetChannelOwnerId());
                if (string.IsNullOrEmpty(username))
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var rows = await _dbContext.ModerationFilters
                    .AsNoTracking()
                    .Where(f => f.ChannelName == username)
                    .ToListAsync();

                var filters = _moderationService.FilterKeys.Select(key =>
                {
                    var row = rows.FirstOrDefault(r => r.FilterKey == key);
                    return new
                    {
                        key,
                        enabled = row?.Enabled ?? false,
                        severity = row?.Severity ?? DefaultSeverity(key),
                        settings = JsonDocument.Parse(row?.Settings ?? "{}").RootElement,
                        message = row?.Message
                    };
                });

                return Ok(new { success = true, filters, platform = await GetPlatformAsync(username) });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo filtros de moderación");
                return StatusCode(500, new { success = false, message = "Error al obtener filtros" });
            }
        }

        /// <summary>
        /// PUT /api/moderation/filters/{key} - Enciende/apaga un filtro o cambia su configuración.
        /// Solo se tocan los campos enviados.
        /// </summary>
        [HttpPut("filters/{key}")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> UpdateFilter(string key, [FromBody] UpdateModerationFilterRequest request)
        {
            try
            {
                if (!_moderationService.FilterKeys.Contains(key))
                    return NotFound(new { success = false, message = "Filtro desconocido" });

                if (request.Severity != null && request.Severity is not ("leve" or "medio" or "severo"))
                    return BadRequest(new { success = false, message = "Severidad inválida" });

                if (request.Message != null && request.Message.Length > 500)
                    return BadRequest(new { success = false, message = "El mensaje no puede pasar de 500 caracteres" });

                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);
                if (string.IsNullOrEmpty(username))
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var row = await _dbContext.ModerationFilters
                    .FirstOrDefaultAsync(f => f.ChannelName == username && f.FilterKey == key);

                if (row == null)
                {
                    row = new ModerationFilter { UserId = channelOwnerId, ChannelName = username, FilterKey = key, Severity = DefaultSeverity(key) };
                    _dbContext.ModerationFilters.Add(row);
                }

                if (request.Enabled.HasValue) row.Enabled = request.Enabled.Value;
                if (request.Severity != null) row.Severity = request.Severity;
                if (request.Settings.HasValue) row.Settings = request.Settings.Value.GetRawText();
                if (request.Message != null) row.Message = string.IsNullOrWhiteSpace(request.Message) ? null : request.Message.Trim();
                row.UpdatedAt = DateTime.Now;

                await _dbContext.SaveChangesAsync();
                ModerationCache.Invalidate(username);

                return Ok(new { success = true, enabled = row.Enabled });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando el filtro de moderación {Key}", key);
                return StatusCode(500, new { success = false, message = "Error al guardar el filtro" });
            }
        }

        /// <summary>
        /// GET /api/moderation/commands - Interruptor, rol mínimo y parámetros de los comandos de moderación
        /// </summary>
        [HttpGet("commands")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> GetCommands()
        {
            try
            {
                var username = await GetChannelUsernameAsync(GetChannelOwnerId());
                if (string.IsNullOrEmpty(username))
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var commands = await _moderationService.GetCommandConfigAsync(username);
                return Ok(new { success = true, commands, limits = new { nukeMaxWindowSeconds = ModerationCommandsConfig.NukeMaxWindowSeconds } });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo comandos de moderación");
                return StatusCode(500, new { success = false, message = "Error al obtener los comandos" });
            }
        }

        /// <summary>
        /// PUT /api/moderation/commands - Guarda la configuración de los comandos (lo inválido se corrige a los valores por defecto)
        /// </summary>
        [HttpPut("commands")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> UpdateCommands([FromBody] JsonElement body)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);
                if (string.IsNullOrEmpty(username))
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var commands = ModerationCommandsConfig.Parse(body.GetRawText());
                var json = ModerationCommandsConfig.Serialize(commands);

                await _dbContext.Database.ExecuteSqlInterpolatedAsync($@"
                    INSERT INTO moderation_command_configs (user_id, channel_name, settings, updated_at)
                    VALUES ({channelOwnerId}, {username}, CAST({json} AS jsonb), NOW())
                    ON CONFLICT (channel_name) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()");
                ModerationCache.Invalidate(username);

                return Ok(new { success = true, commands });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando comandos de moderación");
                return StatusCode(500, new { success = false, message = "Error al guardar los comandos" });
            }
        }

        /// <summary>
        /// GET /api/moderation/panic - Configuración y estado del modo pánico
        /// </summary>
        [HttpGet("panic")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> GetPanic([FromServices] Decatron.Services.Moderation.PanicModeService panic)
        {
            try
            {
                var username = await GetChannelUsernameAsync(GetChannelOwnerId());
                if (string.IsNullOrEmpty(username))
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var (settings, state) = await panic.GetAsync(username);
                var active = state.Active && state.EndsAt > DateTime.Now;
                return Ok(new
                {
                    success = true,
                    platform = await GetPlatformAsync(username),
                    settings,
                    state = new { active, state.StartedAt, state.EndsAt, state.TriggeredBy, state.Reason },
                    defaultBotPhrases = BotPhrasesFilter.DefaultPhrases
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo el modo pánico");
                return StatusCode(500, new { success = false, message = "Error al obtener el modo pánico" });
            }
        }

        /// <summary>
        /// PUT /api/moderation/panic - Guarda la configuración del modo pánico
        /// </summary>
        [HttpPut("panic")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> UpdatePanic([FromBody] JsonElement body, [FromServices] Decatron.Services.Moderation.PanicModeService panic)
        {
            try
            {
                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);
                if (string.IsNullOrEmpty(username))
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var settings = PanicSettings.Parse(body.GetRawText());
                await panic.SaveSettingsAsync(username, channelOwnerId, settings);
                ModerationCache.Invalidate(username);
                return Ok(new { success = true, settings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando el modo pánico");
                return StatusCode(500, new { success = false, message = "Error al guardar el modo pánico" });
            }
        }

        /// <summary>
        /// POST /api/moderation/panic/activate | deactivate - Botón del dashboard
        /// </summary>
        [HttpPost("panic/{mode}")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> TogglePanic(string mode, [FromServices] Decatron.Services.Moderation.PanicModeService panic)
        {
            try
            {
                if (mode is not ("activate" or "deactivate"))
                    return NotFound(new { success = false, message = "Acción desconocida" });

                var channelOwnerId = GetChannelOwnerId();
                var username = await GetChannelUsernameAsync(channelOwnerId);
                if (string.IsNullOrEmpty(username))
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                if (await GetPlatformAsync(username) == "kick")
                    return BadRequest(new { success = false, message = "El modo pánico no está disponible en Kick: Kick no permite que los bots cambien los modos del chat." });

                var by = User.FindFirst(ClaimTypes.Name)?.Value ?? "dashboard";
                if (mode == "activate")
                {
                    var endsAt = await panic.ActivateAsync(username, channelOwnerId, by, "activado desde el dashboard");
                    return Ok(new { success = true, active = true, endsAt });
                }

                await panic.DeactivateAsync(username, by);
                return Ok(new { success = true, active = false });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cambiando el modo pánico");
                return StatusCode(500, new { success = false, message = "Error al cambiar el modo pánico" });
            }
        }

        /// <summary>twitch | kick: en Kick no hay modo pánico ni cuentas nuevas (su API no lo permite)</summary>
        private async Task<string> GetPlatformAsync(string channelKey)
        {
            var user = await _dbContext.Users.AsNoTracking()
                .Where(u => u.Login == channelKey)
                .Select(u => new { u.Login, u.KickId })
                .FirstOrDefaultAsync();
            return user?.KickId != null && user.Login == $"kick_{user.KickId}" ? "kick" : "twitch";
        }

        private static bool LiftsSanction(string action) => action == "ban" || action.StartsWith("timeout_");

        /// <summary>
        /// Se puede deshacer si quitó a alguien del chat (timeout/ban) o le sumó un strike, y nadie la deshizo aún
        /// </summary>
        private static bool CanUndo(ModerationLog l) =>
            l.UndoneAt == null && l.Severity != "comando" && (LiftsSanction(l.ActionTaken) || l.StrikeLevel > 0);

        /// <summary>
        /// GET /api/moderation/history - Historial de sanciones y acciones de mods, del más nuevo al más viejo
        /// </summary>
        [HttpGet("history")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> GetHistory(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 25, [FromQuery] string? user = null,
            [FromQuery] string? filter = null, [FromQuery] string? kind = null,
            [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
        {
            try
            {
                var username = await GetChannelUsernameAsync(GetChannelOwnerId());
                if (string.IsNullOrEmpty(username))
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 10, 100);

                var query = _dbContext.ModerationLogs.AsNoTracking().Where(l => l.ChannelName == username);
                if (!string.IsNullOrWhiteSpace(user))
                {
                    var u = user.Trim().TrimStart('@').ToLower();
                    query = query.Where(l => l.Username.Contains(u) || (l.ExecutedBy != null && l.ExecutedBy.Contains(u)));
                }
                if (!string.IsNullOrWhiteSpace(filter)) query = query.Where(l => l.FilterKey == filter);
                if (kind == "sanctions") query = query.Where(l => l.Severity != "comando");
                else if (kind == "commands") query = query.Where(l => l.Severity == "comando");
                if (from.HasValue) query = query.Where(l => l.CreatedAt >= from.Value.Date);
                if (to.HasValue) query = query.Where(l => l.CreatedAt < to.Value.Date.AddDays(1));

                var total = await query.CountAsync();
                var rows = await query
                    .OrderByDescending(l => l.CreatedAt).ThenByDescending(l => l.Id)
                    .Skip((page - 1) * pageSize).Take(pageSize)
                    .ToListAsync();

                var items = rows.Select(l => new
                {
                    l.Id,
                    l.Username,
                    detail = l.DetectedWord,
                    l.Severity,
                    action = l.ActionTaken,
                    l.StrikeLevel,
                    message = l.FullMessage,
                    filter = l.FilterKey,
                    executedBy = l.ExecutedBy,
                    l.CreatedAt,
                    l.UndoneAt,
                    l.UndoneBy,
                    canUndo = CanUndo(l)
                });

                return Ok(new { success = true, items, total, page, pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo el historial de moderación");
                return StatusCode(500, new { success = false, message = "Error al obtener el historial" });
            }
        }

        /// <summary>
        /// POST /api/moderation/history/{id}/undo - Quita el timeout o ban en Twitch y devuelve el strike.
        /// Un mensaje borrado no se puede recuperar: en ese caso solo se devuelve el strike.
        /// </summary>
        [HttpPost("history/{id:long}/undo")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> UndoAction(long id, [FromServices] Decatron.Services.Moderation.ChatModeratorFactory moderators)
        {
            try
            {
                var username = await GetChannelUsernameAsync(GetChannelOwnerId());
                if (string.IsNullOrEmpty(username))
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var log = await _dbContext.ModerationLogs.FirstOrDefaultAsync(l => l.Id == id && l.ChannelName == username);
                if (log == null)
                    return NotFound(new { success = false, message = "Acción no encontrada" });
                if (!CanUndo(log))
                    return BadRequest(new { success = false, message = log.UndoneAt != null ? "Esta acción ya se deshizo" : "Esta acción no se puede deshacer" });

                bool? lifted = null;
                if (LiftsSanction(log.ActionTaken))
                {
                    var channel = await moderators.ResolveAsync(username);
                    if (channel == null)
                        return NotFound(new { success = false, message = "Canal no encontrado" });

                    lifted = await moderators.For(channel).UnbanAsync(new Decatron.Services.Moderation.ModerationTarget(log.Username, log.TargetUserId));
                    if (lifted == null)
                        return StatusCode(502, new
                        {
                            success = false,
                            message = channel.IsKick
                                ? "Kick no aceptó quitar la sanción. Si la sanción es anterior a la moderación en Kick, quítala desde Kick; si no, vuelve a conectar tu cuenta de Kick."
                                : "Twitch no aceptó quitar la sanción. Revisa que el bot siga siendo moderador del canal."
                        });
                }

                var strikeReturned = log.StrikeLevel > 0 && await _moderationService.ReturnStrikeAsync(username, log.Username);

                log.UndoneAt = DateTime.Now;
                log.UndoneBy = (User.FindFirst(ClaimTypes.Name)?.Value ?? "dashboard").ToLower();
                await _dbContext.SaveChangesAsync();

                return Ok(new { success = true, lifted, strikeReturned });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deshaciendo la acción de moderación {Id}", id);
                return StatusCode(500, new { success = false, message = "Error al deshacer" });
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

                // Las acciones de comandos (quitar strikes, agregar palabras...) no son detecciones
                var detectionsToday = await _dbContext.ModerationLogs
                    .CountAsync(l => l.ChannelName == username && l.CreatedAt >= today && l.Severity != "comando");

                var usersSanctionedToday = await _dbContext.ModerationLogs
                    .Where(l => l.ChannelName == username && l.CreatedAt >= today && l.Severity != "comando")
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

    public class UpdateModerationFilterRequest
    {
        public bool? Enabled { get; set; }
        public string? Severity { get; set; }
        public JsonElement? Settings { get; set; }
        /// <summary>Vacío = volver a los mensajes por acción</summary>
        public string? Message { get; set; }
    }

    public class TestMessageRequest
    {
        public string Message { get; set; } = "";
        /// <summary>Probar solo contra este filtro (null = todos)</summary>
        public string? Filter { get; set; }
    }
}
