using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Default.Controllers
{
    [Authorize]
    [Route("api/chat")]
    [ApiController]
    public class ChatController : ControllerBase
    {
        private readonly DecatronDbContext _dbContext;
        private readonly AIProviderService _aiProviderService;
        private readonly ILogger<ChatController> _logger;
        private readonly IPermissionService _permissionService;

        public ChatController(
            DecatronDbContext dbContext,
            AIProviderService aiProviderService,
            ILogger<ChatController> logger,
            IPermissionService permissionService)
        {
            _dbContext = dbContext;
            _aiProviderService = aiProviderService;
            _logger = logger;
            _permissionService = permissionService;
        }

        private long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            throw new UnauthorizedAccessException("User not found");
        }

        private long GetChannelOwnerId()
        {
            // PRIORIDAD 1: Obtener canal activo desde la sesión (después de switch)
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            {
                _logger.LogDebug($"[Chat] Using channel from session: {sessionId}");
                return sessionId;
            }

            // PRIORIDAD 2: Usar el claim del JWT si existe
            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                _logger.LogDebug($"[Chat] Using channel from JWT claim: {channelOwnerId}");
                return channelOwnerId;
            }

            // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
            var userId = GetUserId();
            _logger.LogDebug($"[Chat] Using user's own channel: {userId}");
            return userId;
        }

        // ==================== VERIFICAR ACCESO ====================

        [HttpGet("check-access")]
        public async Task<IActionResult> CheckAccess()
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                _logger.LogInformation($"[Chat] CheckAccess: userId={userId}, channelOwnerId={channelOwnerId}");

                // Verificar si el sistema está habilitado
                var config = await _dbContext.DecatronChatConfigs.FirstOrDefaultAsync();
                if (config == null || !config.Enabled)
                {
                    return Ok(new
                    {
                        success = true,
                        canView = false,
                        canChat = false,
                        reason = "system_disabled"
                    });
                }

                // El owner siempre tiene acceso total
                if (userId == channelOwnerId)
                {
                    return Ok(new
                    {
                        success = true,
                        canView = true,
                        canChat = true,
                        isOwner = true
                    });
                }

                // Verificar permisos del usuario
                var permission = await _dbContext.DecatronChatPermissions
                    .FirstOrDefaultAsync(p => p.UserId == userId && p.ChannelOwnerId == channelOwnerId);

                if (permission == null)
                {
                    return Ok(new
                    {
                        success = true,
                        canView = false,
                        canChat = false,
                        reason = "no_permission"
                    });
                }

                return Ok(new
                {
                    success = true,
                    canView = permission.CanView,
                    canChat = permission.CanChat,
                    isOwner = false
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Chat] Error checking access");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        // ==================== CONVERSACIONES ====================

        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations()
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                // Verificar acceso
                if (userId != channelOwnerId)
                {
                    var permission = await _dbContext.DecatronChatPermissions
                        .FirstOrDefaultAsync(p => p.UserId == userId && p.ChannelOwnerId == channelOwnerId);

                    if (permission == null || !permission.CanView)
                    {
                        return Forbid();
                    }
                }

                var conversations = await _dbContext.DecatronChatConversations
                    .Where(c => c.UserId == userId && c.ChannelOwnerId == channelOwnerId)
                    .OrderByDescending(c => c.UpdatedAt)
                    .Select(c => new
                    {
                        c.Id,
                        c.Title,
                        c.MessageCount,
                        c.CreatedAt,
                        c.UpdatedAt
                    })
                    .ToListAsync();

                return Ok(new { success = true, conversations });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Chat] Error getting conversations");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpPost("conversations")]
        public async Task<IActionResult> CreateConversation([FromBody] CreateConversationRequest request)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                // Verificar acceso (solo los que pueden chatear pueden crear conversaciones)
                if (userId != channelOwnerId)
                {
                    var permission = await _dbContext.DecatronChatPermissions
                        .FirstOrDefaultAsync(p => p.UserId == userId && p.ChannelOwnerId == channelOwnerId);

                    if (permission == null || !permission.CanChat)
                    {
                        return Forbid();
                    }
                }

                // Verificar límite de conversaciones
                var config = await _dbContext.DecatronChatConfigs.FirstOrDefaultAsync();
                var maxConversations = config?.MaxConversationsPerUser ?? 50;

                var conversationCount = await _dbContext.DecatronChatConversations
                    .CountAsync(c => c.UserId == userId && c.ChannelOwnerId == channelOwnerId);

                if (conversationCount >= maxConversations)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = $"Límite de conversaciones alcanzado ({maxConversations}). Elimina conversaciones antiguas."
                    });
                }

                // Crear conversación
                var conversation = new DecatronChatConversation
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    ChannelOwnerId = channelOwnerId,
                    Title = string.IsNullOrWhiteSpace(request.Title) ? "Nueva conversación" : request.Title,
                    MessageCount = 0,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _dbContext.DecatronChatConversations.Add(conversation);
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"[Chat] Conversation created: {conversation.Id} by user {userId}");

                return Ok(new
                {
                    success = true,
                    conversation = new
                    {
                        conversation.Id,
                        conversation.Title,
                        conversation.MessageCount,
                        conversation.CreatedAt,
                        conversation.UpdatedAt
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Chat] Error creating conversation");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpGet("conversations/{id}")]
        public async Task<IActionResult> GetConversation(Guid id)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                var conversation = await _dbContext.DecatronChatConversations
                    .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId && c.ChannelOwnerId == channelOwnerId);

                if (conversation == null)
                {
                    return NotFound(new { success = false, message = "Conversación no encontrada" });
                }

                // Verificar acceso
                if (userId != channelOwnerId)
                {
                    var permission = await _dbContext.DecatronChatPermissions
                        .FirstOrDefaultAsync(p => p.UserId == userId && p.ChannelOwnerId == channelOwnerId);

                    if (permission == null || !permission.CanView)
                    {
                        return Forbid();
                    }
                }

                // Obtener mensajes
                var messages = await _dbContext.DecatronChatMessages
                    .Where(m => m.ConversationId == id)
                    .OrderBy(m => m.CreatedAt)
                    .Select(m => new
                    {
                        m.Id,
                        m.Role,
                        m.Content,
                        m.TokensUsed,
                        m.ResponseTimeMs,
                        m.CreatedAt
                    })
                    .ToListAsync();

                return Ok(new
                {
                    success = true,
                    conversation = new
                    {
                        conversation.Id,
                        conversation.Title,
                        conversation.MessageCount,
                        conversation.CreatedAt,
                        conversation.UpdatedAt
                    },
                    messages
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Chat] Error getting conversation {id}");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpPost("conversations/{id}/messages")]
        public async Task<IActionResult> SendMessage(Guid id, [FromBody] SendMessageRequest request)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();
                var startTime = DateTime.UtcNow;

                _logger.LogInformation($"[Chat] SendMessage: conversationId={id}, userId={userId}");

                // Verificar conversación existe y pertenece al usuario
                var conversation = await _dbContext.DecatronChatConversations
                    .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId && c.ChannelOwnerId == channelOwnerId);

                if (conversation == null)
                {
                    return NotFound(new { success = false, message = "Conversación no encontrada" });
                }

                // Verificar permiso de chat
                if (userId != channelOwnerId)
                {
                    var permission = await _dbContext.DecatronChatPermissions
                        .FirstOrDefaultAsync(p => p.UserId == userId && p.ChannelOwnerId == channelOwnerId);

                    if (permission == null || !permission.CanChat)
                    {
                        return Forbid();
                    }
                }

                // Validar contenido
                if (string.IsNullOrWhiteSpace(request.Content))
                {
                    return BadRequest(new { success = false, message = "El mensaje no puede estar vacío" });
                }

                // Verificar límite de mensajes por conversación
                var config = await _dbContext.DecatronChatConfigs.FirstOrDefaultAsync();
                if (config == null || !config.Enabled)
                {
                    return BadRequest(new { success = false, message = "El sistema de chat está deshabilitado" });
                }

                var messageCount = await _dbContext.DecatronChatMessages
                    .CountAsync(m => m.ConversationId == id);

                if (messageCount >= config.MaxMessagesPerConversation)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = $"Límite de mensajes alcanzado ({config.MaxMessagesPerConversation}). Crea una nueva conversación."
                    });
                }

                // Guardar mensaje del usuario
                var userMessage = new DecatronChatMessage
                {
                    ConversationId = id,
                    UserId = userId,
                    Role = "user",
                    Content = request.Content,
                    TokensUsed = 0,
                    ResponseTimeMs = 0,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.DecatronChatMessages.Add(userMessage);

                // Obtener contexto (últimos N mensajes)
                var contextMessages = await _dbContext.DecatronChatMessages
                    .Where(m => m.ConversationId == id)
                    .OrderByDescending(m => m.CreatedAt)
                    .Take(config.ContextMessages)
                    .OrderBy(m => m.CreatedAt)
                    .Select(m => new { m.Role, m.Content })
                    .ToListAsync();

                // Construir prompt con contexto
                var promptWithContext = request.Content;
                if (contextMessages.Any())
                {
                    var contextText = string.Join("\n", contextMessages.Select(m => $"{m.Role}: {m.Content}"));
                    promptWithContext = $"Contexto de conversación previa:\n{contextText}\n\nNuevo mensaje del usuario:\n{request.Content}";
                }

                // Llamar a la IA (usando config de chat, no de Twitch IA)
                var aiConfig = new DecatronAIGlobalConfig
                {
                    AIProvider = config.AIProvider,
                    FallbackEnabled = config.FallbackEnabled,
                    Model = config.Model,
                    OpenRouterModel = config.OpenRouterModel,
                    MaxTokens = config.MaxTokens
                };

                var aiResponse = await _aiProviderService.GenerateResponseAsync(
                    promptWithContext,
                    config.SystemPrompt,
                    aiConfig,
                    truncateForTwitch: false  // No truncar para chat privado
                );

                var responseTime = (int)(DateTime.UtcNow - startTime).TotalMilliseconds;

                // Guardar respuesta de la IA
                var assistantMessage = new DecatronChatMessage
                {
                    ConversationId = id,
                    UserId = userId,
                    Role = "assistant",
                    Content = aiResponse.Text ?? "Lo siento, no pude generar una respuesta.",
                    TokensUsed = aiResponse.TokensUsed,
                    ResponseTimeMs = responseTime,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.DecatronChatMessages.Add(assistantMessage);

                // Actualizar conversación
                conversation.MessageCount += 2; // user + assistant
                conversation.UpdatedAt = DateTime.UtcNow;

                // Actualizar título si es el primer mensaje
                if (conversation.MessageCount == 2 && conversation.Title == "Nueva conversación")
                {
                    var titlePrompt = request.Content.Length > 50
                        ? request.Content.Substring(0, 50) + "..."
                        : request.Content;
                    conversation.Title = titlePrompt;
                }

                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"[Chat] Message sent and response received in {responseTime}ms");

                return Ok(new
                {
                    success = true,
                    userMessage = new
                    {
                        userMessage.Id,
                        userMessage.Role,
                        userMessage.Content,
                        userMessage.CreatedAt
                    },
                    assistantMessage = new
                    {
                        assistantMessage.Id,
                        assistantMessage.Role,
                        assistantMessage.Content,
                        assistantMessage.TokensUsed,
                        assistantMessage.ResponseTimeMs,
                        assistantMessage.CreatedAt
                    },
                    conversation = new
                    {
                        conversation.Id,
                        conversation.Title,
                        conversation.MessageCount,
                        conversation.UpdatedAt
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Chat] Error sending message to conversation {id}");
                return StatusCode(500, new { success = false, message = "Error procesando mensaje" });
            }
        }

        [HttpDelete("conversations/{id}")]
        public async Task<IActionResult> DeleteConversation(Guid id)
        {
            try
            {
                var userId = GetUserId();
                var channelOwnerId = GetChannelOwnerId();

                var conversation = await _dbContext.DecatronChatConversations
                    .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId && c.ChannelOwnerId == channelOwnerId);

                if (conversation == null)
                {
                    return NotFound(new { success = false, message = "Conversación no encontrada" });
                }

                // Los mensajes se eliminarán en cascada por la FK
                _dbContext.DecatronChatConversations.Remove(conversation);
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation($"[Chat] Conversation {id} deleted by user {userId}");

                return Ok(new { success = true, message = "Conversación eliminada" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Chat] Error deleting conversation {id}");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }
    }

    // DTOs
    public class CreateConversationRequest
    {
        public string? Title { get; set; }
    }

    public class SendMessageRequest
    {
        public string Content { get; set; } = string.Empty;
    }
}
