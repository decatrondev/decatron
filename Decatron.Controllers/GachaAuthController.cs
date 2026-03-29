using System.Security.Claims;
using Decatron.Core.Models;
using Decatron.Core.Settings;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MySql.Data.MySqlClient;

namespace Decatron.Controllers
{
    [ApiController]
    [Route("api/gacha-auth")]
    public class GachaAuthController : ControllerBase
    {
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, List<DateTime>> _loginAttempts = new();
        private readonly IConfiguration _configuration;
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<GachaAuthController> _logger;
        private readonly GachaSettings _gachaSettings;

        private bool IsRateLimited(string ip)
        {
            var now = DateTime.UtcNow;
            var attempts = _loginAttempts.GetOrAdd(ip, _ => new List<DateTime>());
            lock (attempts)
            {
                attempts.RemoveAll(t => (now - t).TotalMinutes > 1);
                if (attempts.Count >= 5) return true;
                attempts.Add(now);
                return false;
            }
        }

        public GachaAuthController(
            IConfiguration configuration,
            DecatronDbContext dbContext,
            ILogger<GachaAuthController> logger,
            IOptions<GachaSettings> gachaSettings)
        {
            _configuration = configuration;
            _dbContext = dbContext;
            _logger = logger;
            _gachaSettings = gachaSettings.Value;
        }

        /// <summary>
        /// Obtiene la configuración pública de Gacha (WebUrl, BotUsername)
        /// Este endpoint es público y no requiere autenticación
        /// </summary>
        [HttpGet("config")]
        [AllowAnonymous]
        public IActionResult GetConfig()
        {
            return Ok(new
            {
                success = true,
                webUrl = _gachaSettings.WebUrl,
                botUsername = _gachaSettings.BotUsername
            });
        }

        /// <summary>
        /// Valida credenciales de usuario Gacha contra la base de datos MySQL
        /// Este endpoint es público y no requiere autenticación
        /// </summary>
        [HttpPost("validate")]
        [AllowAnonymous]
        public async Task<IActionResult> ValidateCredentials([FromBody] GachaValidateRequest request)
        {
            try
            {
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                if (IsRateLimited(ip))
                {
                    _logger.LogWarning("Rate limit exceeded for Gacha login from IP: {Ip}", ip);
                    return StatusCode(429, new { success = false, message = "Too many login attempts. Please wait 1 minute." });
                }

                if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                {
                    return BadRequest(new { success = false, message = "Usuario y contraseña son requeridos" });
                }

                _logger.LogInformation($"Validando credenciales de Gacha para usuario: {request.Username}");

                // Validar contra MySQL de GachaVerse
                var gachaUser = await ValidateAgainstGachaDatabase(request.Username, request.Password);

                if (gachaUser == null)
                {
                    _logger.LogWarning($"❌ Credenciales inválidas para: {request.Username}");
                    return Unauthorized(new { success = false, message = "Usuario o contraseña incorrectos" });
                }

                _logger.LogInformation($"✅ Credenciales válidas para Gacha user ID: {gachaUser.Id}");

                // Verificar si ya existe vinculación activa
                var existingLink = await _dbContext.GachaLinkedAccounts
                    .FirstOrDefaultAsync(g => g.GachaUserId == gachaUser.Id && g.IsActive);

                return Ok(new
                {
                    success = true,
                    gachaUserId = gachaUser.Id,
                    gachaUsername = gachaUser.Username,
                    isLinked = existingLink != null,
                    twitchUsername = existingLink?.TwitchUsername
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validando credenciales de Gacha");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Vincula una cuenta de Gacha con la cuenta de Twitch del usuario autenticado
        /// </summary>
        [HttpPost("link")]
        [Authorize]
        public async Task<IActionResult> LinkAccounts([FromBody] GachaLinkRequest request)
        {
            try
            {
                // Obtener usuario de Twitch autenticado
                var twitchUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var twitchUsernameClaim = User.FindFirst(ClaimTypes.Name)?.Value;
                var twitchId = User.FindFirst("TwitchId")?.Value; // ID de Twitch (no el ID interno de DB)

                if (string.IsNullOrEmpty(twitchUserIdClaim) || string.IsNullOrEmpty(twitchUsernameClaim))
                {
                    return Unauthorized(new { success = false, message = "Usuario no autenticado" });
                }

                if (!long.TryParse(twitchUserIdClaim, out var twitchUserId))
                {
                    return BadRequest(new { success = false, message = "ID de usuario inválido" });
                }

                _logger.LogInformation($"Vinculando Gacha user {request.GachaUserId} con Twitch user {twitchUserId}");

                // Verificar que el usuario de Gacha existe y las credenciales son válidas
                var gachaUser = await GetGachaUserById(request.GachaUserId);
                if (gachaUser == null)
                {
                    return BadRequest(new { success = false, message = "Usuario de Gacha no encontrado" });
                }

                // Verificar si ya existe vinculación activa para este usuario de Gacha
                var existingGachaLink = await _dbContext.GachaLinkedAccounts
                    .FirstOrDefaultAsync(g => g.GachaUserId == request.GachaUserId && g.IsActive);

                if (existingGachaLink != null)
                {
                    // Desactivar vinculación anterior
                    existingGachaLink.IsActive = false;
                    existingGachaLink.UpdatedAt = DateTime.UtcNow;
                }

                // Verificar si ya existe vinculación activa para este usuario de Twitch
                var existingTwitchLink = await _dbContext.GachaLinkedAccounts
                    .FirstOrDefaultAsync(g => g.TwitchUserId == twitchUserId && g.IsActive);

                if (existingTwitchLink != null)
                {
                    // Desactivar vinculación anterior
                    existingTwitchLink.IsActive = false;
                    existingTwitchLink.UpdatedAt = DateTime.UtcNow;
                }

                // Crear nueva vinculación
                var newLink = new GachaLinkedAccount
                {
                    GachaUserId = request.GachaUserId,
                    GachaUsername = gachaUser.Username,
                    TwitchUserId = twitchUserId,
                    TwitchUsername = twitchUsernameClaim.ToLower(),
                    LinkedAt = DateTime.UtcNow,
                    IsActive = true,
                    LastUsedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _dbContext.GachaLinkedAccounts.Add(newLink);
                await _dbContext.SaveChangesAsync();

                // Actualizar tabla MySQL de GachaVerse con datos de Twitch
                await UpdateGachaUserWithTwitchData(request.GachaUserId, twitchId, twitchUsernameClaim);

                _logger.LogInformation($"✅ Cuenta vinculada exitosamente: Gacha {request.GachaUserId} → Twitch {twitchUserId}");

                return Ok(new
                {
                    success = true,
                    message = "Cuentas vinculadas exitosamente",
                    gachaUsername = gachaUser.Username,
                    twitchUsername = twitchUsernameClaim,
                    linkedAt = newLink.LinkedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error vinculando cuentas");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Verifica el estado de vinculación del usuario autenticado
        /// </summary>
        [HttpGet("status")]
        [Authorize]
        public async Task<IActionResult> GetLinkStatus()
        {
            try
            {
                var twitchUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(twitchUserIdClaim, out var twitchUserId))
                {
                    return Unauthorized(new { success = false, message = "Usuario no autenticado" });
                }

                var link = await _dbContext.GachaLinkedAccounts
                    .FirstOrDefaultAsync(g => g.TwitchUserId == twitchUserId && g.IsActive);

                return Ok(new
                {
                    success = true,
                    isLinked = link != null,
                    gachaUsername = link?.GachaUsername,
                    linkedAt = link?.LinkedAt,
                    lastUsedAt = link?.LastUsedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo estado de vinculación");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Desvincula la cuenta de Gacha del usuario autenticado
        /// </summary>
        [HttpPost("unlink")]
        [Authorize]
        public async Task<IActionResult> UnlinkAccount()
        {
            try
            {
                var twitchUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(twitchUserIdClaim, out var twitchUserId))
                {
                    return Unauthorized(new { success = false, message = "Usuario no autenticado" });
                }

                var link = await _dbContext.GachaLinkedAccounts
                    .FirstOrDefaultAsync(g => g.TwitchUserId == twitchUserId && g.IsActive);

                if (link == null)
                {
                    return NotFound(new { success = false, message = "No hay cuenta vinculada" });
                }

                link.IsActive = false;
                link.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"🔓 Cuenta desvinculada: Gacha {link.GachaUserId} → Twitch {twitchUserId}");

                return Ok(new { success = true, message = "Cuenta desvinculada exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error desvinculando cuenta");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// Valida credenciales contra la base de datos MySQL de GachaVerse
        /// </summary>
        private async Task<GachaUserDto?> ValidateAgainstGachaDatabase(string username, string password)
        {
            var connectionString = _configuration.GetConnectionString("GachaConnection");
            if (string.IsNullOrEmpty(connectionString))
            {
                _logger.LogError("❌ Conexión GachaConnection no configurada");
                return null;
            }

            try
            {
                using var connection = new MySqlConnection(connectionString);
                await connection.OpenAsync();

                var query = "SELECT id, username, password FROM users WHERE username = @username LIMIT 1";
                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@username", username);

                using var reader = await command.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    _logger.LogWarning($"❌ Usuario no encontrado en MySQL: {username}");
                    return null; // Usuario no encontrado
                }

                // MySQL.Data requiere usar índices de columna, no nombres
                var id = reader.GetInt32(0);              // Columna 0: id
                var dbUsername = reader.GetString(1);     // Columna 1: username
                var dbPasswordHash = reader.GetString(2); // Columna 2: password

                // Verificar contraseña con BCrypt
                var isValid = BCrypt.Net.BCrypt.Verify(password, dbPasswordHash);

                if (!isValid)
                {
                    _logger.LogWarning($"❌ Contraseña incorrecta para usuario: {username}");
                    return null; // Contraseña incorrecta
                }

                return new GachaUserDto
                {
                    Id = id,
                    Username = dbUsername
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando base de datos MySQL de Gacha");
                return null;
            }
        }

        /// <summary>
        /// Obtiene información de un usuario de Gacha por ID
        /// </summary>
        private async Task<GachaUserDto?> GetGachaUserById(int gachaUserId)
        {
            var connectionString = _configuration.GetConnectionString("GachaConnection");
            if (string.IsNullOrEmpty(connectionString))
            {
                return null;
            }

            try
            {
                using var connection = new MySqlConnection(connectionString);
                await connection.OpenAsync();

                var query = "SELECT id, username FROM users WHERE id = @id LIMIT 1";
                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@id", gachaUserId);

                using var reader = await command.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    return null;
                }

                // MySQL.Data requiere usar índices de columna, no nombres
                return new GachaUserDto
                {
                    Id = reader.GetInt32(0),      // Columna 0: id
                    Username = reader.GetString(1) // Columna 1: username
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error obteniendo usuario de Gacha ID: {gachaUserId}");
                return null;
            }
        }

        /// <summary>
        /// Actualiza la tabla MySQL de GachaVerse con los datos de Twitch
        /// </summary>
        private async Task UpdateGachaUserWithTwitchData(int gachaUserId, string? twitchId, string twitchUsername)
        {
            var connectionString = _configuration.GetConnectionString("GachaConnection");
            if (string.IsNullOrEmpty(connectionString))
            {
                _logger.LogWarning("⚠️ No se pudo actualizar MySQL: connectionString vacío");
                return;
            }

            try
            {
                using var connection = new MySqlConnection(connectionString);
                await connection.OpenAsync();

                var query = @"UPDATE users
                             SET twitch_id = @twitchId,
                                 twitch_username = @twitchUsername,
                                 is_twitch_connected = 1,
                                 updated_at = NOW()
                             WHERE id = @userId";

                using var command = new MySqlCommand(query, connection);
                command.Parameters.AddWithValue("@twitchId", twitchId ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@twitchUsername", twitchUsername);
                command.Parameters.AddWithValue("@userId", gachaUserId);

                var rowsAffected = await command.ExecuteNonQueryAsync();

                if (rowsAffected > 0)
                {
                    _logger.LogInformation($"✅ MySQL actualizado: Gacha user {gachaUserId} ahora tiene twitch_id={twitchId}, twitch_username={twitchUsername}");
                }
                else
                {
                    _logger.LogWarning($"⚠️ No se actualizó ninguna fila en MySQL para Gacha user {gachaUserId}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"💥 Error actualizando MySQL para Gacha user {gachaUserId}");
                // No lanzamos excepción para que no falle la vinculación en PostgreSQL
            }
        }
    }

    // DTOs
    public class GachaValidateRequest
    {
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
    }

    public class GachaLinkRequest
    {
        public int GachaUserId { get; set; }
    }

    public class GachaUserDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = "";
    }
}
