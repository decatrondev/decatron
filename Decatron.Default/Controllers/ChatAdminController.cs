using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Controllers
{
    [Authorize]
    [Route("api/admin/chat")]
    [ApiController]
    public class ChatAdminController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly ILogger<ChatAdminController> _logger;

        public ChatAdminController(
            DecatronDbContext dbContext,
            ILogger<ChatAdminController> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        private async Task<bool> IsOwnerAsync()
        {
            var username = User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(username)) return false;

            var admin = await _dbContext.SystemAdmins
                .FirstOrDefaultAsync(a => a.Username.ToLower() == username.ToLower() && a.Role == "owner");

            return admin != null;
        }

        // ==================== CONFIGURACIÓN ====================

        [HttpGet("config")]
        public async Task<IActionResult> GetConfig()
        {
            if (!await IsOwnerAsync())
                return Forbid();

            var config = await _dbContext.DecatronChatConfigs.FirstOrDefaultAsync();
            if (config == null)
            {
                config = new DecatronChatConfig();
                _dbContext.DecatronChatConfigs.Add(config);
                await _dbContext.SaveChangesAsync();
            }

            return Ok(new { success = true, config });
        }

        [HttpPost("config")]
        public async Task<IActionResult> UpdateConfig([FromBody] UpdateChatConfigRequest request)
        {
            if (!await IsOwnerAsync())
                return Forbid();

            var config = await _dbContext.DecatronChatConfigs.FirstOrDefaultAsync();
            if (config == null)
            {
                config = new DecatronChatConfig();
                _dbContext.DecatronChatConfigs.Add(config);
            }

            if (request.Enabled.HasValue)
                config.Enabled = request.Enabled.Value;
            if (!string.IsNullOrEmpty(request.AIProvider))
                config.AIProvider = request.AIProvider;
            if (request.FallbackEnabled.HasValue)
                config.FallbackEnabled = request.FallbackEnabled.Value;
            if (!string.IsNullOrEmpty(request.Model))
                config.Model = request.Model;
            if (!string.IsNullOrEmpty(request.OpenRouterModel))
                config.OpenRouterModel = request.OpenRouterModel;
            if (request.MaxTokens.HasValue)
                config.MaxTokens = request.MaxTokens.Value;
            if (request.SystemPrompt != null)
                config.SystemPrompt = request.SystemPrompt;
            if (request.MaxConversationsPerUser.HasValue)
                config.MaxConversationsPerUser = request.MaxConversationsPerUser.Value;
            if (request.MaxMessagesPerConversation.HasValue)
                config.MaxMessagesPerConversation = request.MaxMessagesPerConversation.Value;
            if (request.ContextMessages.HasValue)
                config.ContextMessages = request.ContextMessages.Value;

            config.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("✅ [CHAT-ADMIN] Configuración actualizada");
            return Ok(new { success = true, message = "Configuración actualizada" });
        }

        // ==================== PERMISOS ====================

        [HttpGet("permissions")]
        public async Task<IActionResult> GetPermissions()
        {
            if (!await IsOwnerAsync())
                return Forbid();

            var permissions = await _dbContext.DecatronChatPermissions
                .Include(p => p.User)
                .Select(p => new
                {
                    p.Id,
                    p.UserId,
                    Username = p.User.Login,
                    DisplayName = p.User.DisplayName,
                    p.CanView,
                    p.CanChat,
                    p.Notes,
                    p.CreatedAt,
                    p.UpdatedAt
                })
                .OrderBy(p => p.Username)
                .ToListAsync();

            return Ok(new { success = true, permissions });
        }

        [HttpPost("permissions")]
        public async Task<IActionResult> AddPermission([FromBody] AddChatPermissionRequest request)
        {
            if (!await IsOwnerAsync())
                return Forbid();

            if (request.UserId <= 0)
                return BadRequest(new { success = false, message = "ID de usuario inválido" });

            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == request.UserId);
            if (user == null)
                return NotFound(new { success = false, message = "Usuario no encontrado" });

            var currentUserId = long.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

            // Verificar si ya existe
            var existing = await _dbContext.DecatronChatPermissions
                .FirstOrDefaultAsync(p => p.UserId == request.UserId && p.ChannelOwnerId == currentUserId);

            if (existing != null)
                return BadRequest(new { success = false, message = "El usuario ya tiene permisos configurados" });

            var permission = new DecatronChatPermission
            {
                UserId = request.UserId,
                ChannelOwnerId = currentUserId,
                CanView = request.CanView ?? true,
                CanChat = request.CanChat ?? false,
                GrantedBy = currentUserId,
                Notes = request.Notes,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _dbContext.DecatronChatPermissions.Add(permission);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation($"✅ [CHAT-ADMIN] Permiso agregado para usuario {user.Login}");
            return Ok(new
            {
                success = true,
                message = "Permiso agregado",
                permission = new
                {
                    permission.Id,
                    permission.UserId,
                    Username = user.Login,
                    DisplayName = user.DisplayName,
                    permission.CanView,
                    permission.CanChat,
                    permission.Notes,
                    permission.CreatedAt
                }
            });
        }

        [HttpPut("permissions/{id}")]
        public async Task<IActionResult> UpdatePermission(long id, [FromBody] UpdateChatPermissionRequest request)
        {
            if (!await IsOwnerAsync())
                return Forbid();

            var permission = await _dbContext.DecatronChatPermissions.FirstOrDefaultAsync(p => p.Id == id);
            if (permission == null)
                return NotFound(new { success = false, message = "Permiso no encontrado" });

            if (request.CanView.HasValue)
                permission.CanView = request.CanView.Value;
            if (request.CanChat.HasValue)
                permission.CanChat = request.CanChat.Value;
            if (request.Notes != null)
                permission.Notes = request.Notes;

            permission.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation($"✅ [CHAT-ADMIN] Permiso {id} actualizado");
            return Ok(new { success = true, message = "Permiso actualizado" });
        }

        [HttpDelete("permissions/{id}")]
        public async Task<IActionResult> DeletePermission(long id)
        {
            if (!await IsOwnerAsync())
                return Forbid();

            var permission = await _dbContext.DecatronChatPermissions.FirstOrDefaultAsync(p => p.Id == id);
            if (permission == null)
                return NotFound(new { success = false, message = "Permiso no encontrado" });

            _dbContext.DecatronChatPermissions.Remove(permission);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation($"✅ [CHAT-ADMIN] Permiso {id} eliminado");
            return Ok(new { success = true, message = "Permiso eliminado" });
        }

        // ==================== ESTADÍSTICAS ====================

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            if (!await IsOwnerAsync())
                return Forbid();

            var today = DateTime.UtcNow.Date;
            var thisWeek = today.AddDays(-7);
            var thisMonth = today.AddDays(-30);

            var totalConversations = await _dbContext.DecatronChatConversations.CountAsync();
            var totalMessages = await _dbContext.DecatronChatMessages.CountAsync();

            var todayMessages = await _dbContext.DecatronChatMessages
                .CountAsync(m => m.CreatedAt >= today);

            var weekMessages = await _dbContext.DecatronChatMessages
                .CountAsync(m => m.CreatedAt >= thisWeek);

            var monthMessages = await _dbContext.DecatronChatMessages
                .CountAsync(m => m.CreatedAt >= thisMonth);

            var totalTokens = await _dbContext.DecatronChatMessages
                .Where(m => m.Role == "assistant")
                .SumAsync(m => m.TokensUsed);

            var avgResponseTime = await _dbContext.DecatronChatMessages
                .Where(m => m.Role == "assistant" && m.ResponseTimeMs > 0)
                .AverageAsync(m => (double?)m.ResponseTimeMs) ?? 0;

            var topUsers = await _dbContext.DecatronChatMessages
                .GroupBy(m => m.UserId)
                .Select(g => new
                {
                    UserId = g.Key,
                    MessageCount = g.Count()
                })
                .OrderByDescending(x => x.MessageCount)
                .Take(10)
                .ToListAsync();

            // Enriquecer con información de usuarios
            var userIds = topUsers.Select(u => u.UserId).ToList();
            var users = await _dbContext.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Login, u.DisplayName })
                .ToListAsync();

            var topUsersEnriched = topUsers.Select(tu =>
            {
                var user = users.FirstOrDefault(u => u.Id == tu.UserId);
                return new
                {
                    tu.UserId,
                    Username = user?.Login ?? "unknown",
                    DisplayName = user?.DisplayName,
                    tu.MessageCount
                };
            }).ToList();

            return Ok(new
            {
                success = true,
                stats = new
                {
                    totalConversations,
                    totalMessages,
                    todayMessages,
                    weekMessages,
                    monthMessages,
                    totalTokens,
                    avgResponseTime = Math.Round(avgResponseTime, 0),
                    topUsers = topUsersEnriched
                }
            });
        }

        // ==================== AUDITORÍA ====================

        [HttpGet("audit")]
        public async Task<IActionResult> GetAudit(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] long? userId = null,
            [FromQuery] Guid? conversationId = null)
        {
            if (!await IsOwnerAsync())
                return Forbid();

            var query = _dbContext.DecatronChatMessages.AsQueryable();

            if (userId.HasValue)
                query = query.Where(m => m.UserId == userId.Value);

            if (conversationId.HasValue)
                query = query.Where(m => m.ConversationId == conversationId.Value);

            var total = await query.CountAsync();

            var messages = await query
                .OrderByDescending(m => m.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(m => new
                {
                    m.Id,
                    m.ConversationId,
                    m.UserId,
                    m.Role,
                    m.Content,
                    m.TokensUsed,
                    m.ResponseTimeMs,
                    m.CreatedAt
                })
                .ToListAsync();

            // Enriquecer con información de usuarios
            var userIds = messages.Select(m => m.UserId).Distinct().ToList();
            var users = await _dbContext.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Login, u.DisplayName })
                .ToDictionaryAsync(u => u.Id);

            var enrichedMessages = messages.Select(m => new
            {
                m.Id,
                m.ConversationId,
                m.UserId,
                Username = users.ContainsKey(m.UserId) ? users[m.UserId].Login : "unknown",
                DisplayName = users.ContainsKey(m.UserId) ? users[m.UserId].DisplayName : null,
                m.Role,
                m.Content,
                m.TokensUsed,
                m.ResponseTimeMs,
                m.CreatedAt
            }).ToList();

            return Ok(new
            {
                success = true,
                total,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(total / (double)pageSize),
                messages = enrichedMessages
            });
        }

        [HttpGet("audit/conversations")]
        public async Task<IActionResult> GetAuditConversations(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] long? userId = null)
        {
            if (!await IsOwnerAsync())
                return Forbid();

            var query = _dbContext.DecatronChatConversations.AsQueryable();

            if (userId.HasValue)
                query = query.Where(c => c.UserId == userId.Value);

            var total = await query.CountAsync();

            var conversations = await query
                .OrderByDescending(c => c.UpdatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new
                {
                    c.Id,
                    c.UserId,
                    c.Title,
                    c.MessageCount,
                    c.CreatedAt,
                    c.UpdatedAt
                })
                .ToListAsync();

            // Enriquecer con información de usuarios
            var userIds = conversations.Select(c => c.UserId).Distinct().ToList();
            var users = await _dbContext.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Login, u.DisplayName })
                .ToDictionaryAsync(u => u.Id);

            var enrichedConversations = conversations.Select(c => new
            {
                c.Id,
                c.UserId,
                Username = users.ContainsKey(c.UserId) ? users[c.UserId].Login : "unknown",
                DisplayName = users.ContainsKey(c.UserId) ? users[c.UserId].DisplayName : null,
                c.Title,
                c.MessageCount,
                c.CreatedAt,
                c.UpdatedAt
            }).ToList();

            return Ok(new
            {
                success = true,
                total,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(total / (double)pageSize),
                conversations = enrichedConversations
            });
        }

        // ==================== USUARIOS DISPONIBLES ====================

        [HttpGet("available-users")]
        public async Task<IActionResult> GetAvailableUsers([FromQuery] string? search = null)
        {
            if (!await IsOwnerAsync())
                return Forbid();

            var query = _dbContext.Users.Where(u => u.IsActive);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(u =>
                    u.Login.ToLower().Contains(searchLower) ||
                    (u.DisplayName != null && u.DisplayName.ToLower().Contains(searchLower)));
            }

            var users = await query
                .Select(u => new
                {
                    u.Id,
                    u.Login,
                    u.DisplayName,
                    u.ProfileImageUrl
                })
                .OrderBy(u => u.Login)
                .Take(50)
                .ToListAsync();

            return Ok(new { success = true, users });
        }
    }

    // DTOs
    public class UpdateChatConfigRequest
    {
        public bool? Enabled { get; set; }
        public string? AIProvider { get; set; }
        public bool? FallbackEnabled { get; set; }
        public string? Model { get; set; }
        public string? OpenRouterModel { get; set; }
        public int? MaxTokens { get; set; }
        public string? SystemPrompt { get; set; }
        public int? MaxConversationsPerUser { get; set; }
        public int? MaxMessagesPerConversation { get; set; }
        public int? ContextMessages { get; set; }
    }

    public class AddChatPermissionRequest
    {
        public long UserId { get; set; }
        public bool? CanView { get; set; }
        public bool? CanChat { get; set; }
        public string? Notes { get; set; }
    }

    public class UpdateChatPermissionRequest
    {
        public bool? CanView { get; set; }
        public bool? CanChat { get; set; }
        public string? Notes { get; set; }
    }
}
