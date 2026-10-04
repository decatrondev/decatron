using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using Decatron.Attributes;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Hubs;
using Decatron.Services.ChatOverlay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Overlay de chat: configuración por canal y emotes que ve el streamer.
    /// Plan: .dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 1.
    /// </summary>
    [Authorize]
    [Route("api/chat-overlay")]
    [ApiController]
    public class ChatOverlayController : ControllerBase
    {
        private const int MaxConfigBytes = 100_000;
        private const int MaxListItems = 500;
        private const int MaxItemLength = 100;

        private readonly DecatronDbContext _db;
        private readonly ChatOverlayService _chatOverlay;
        private readonly EmoteCatalogService _emotes;
        private readonly IHubContext<OverlayHub> _hub;
        private readonly ILogger<ChatOverlayController> _logger;

        public ChatOverlayController(DecatronDbContext db, ChatOverlayService chatOverlay, EmoteCatalogService emotes,
            IHubContext<OverlayHub> hub, ILogger<ChatOverlayController> logger)
        {
            _db = db;
            _chatOverlay = chatOverlay;
            _emotes = emotes;
            _hub = hub;
            _logger = logger;
        }

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(claim, out var id)) return id;
            throw new UnauthorizedAccessException("User not found");
        }

        /// <summary>El canal que se gestiona: el de la sesión tras un cambio de canal, el del JWT o el propio</summary>
        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                return sessionId;
            if (long.TryParse(User.FindFirst("ChannelOwnerId")?.Value, out var claimId))
                return claimId;
            return GetUserId();
        }

        /// <summary>GET /api/chat-overlay/config - La configuración guardada (null si nunca se guardó: el front usa los valores por defecto)</summary>
        [HttpGet("config")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                var ownerId = GetChannelOwnerId();
                var channel = await _chatOverlay.GetChannelAsync(ownerId);
                if (channel == null)
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var json = await _db.ChatOverlayConfigs.AsNoTracking().Where(c => c.UserId == ownerId).Select(c => c.Config).FirstOrDefaultAsync();
                return Ok(new
                {
                    success = true,
                    config = json == null ? (JsonElement?)null : JsonDocument.Parse(json).RootElement,
                    channel = new
                    {
                        login = channel.Value.Login,
                        hasTwitch = !string.IsNullOrEmpty(channel.Value.TwitchId),
                        hasKick = !string.IsNullOrEmpty(channel.Value.KickId)
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo la config del overlay de chat");
                return StatusCode(500, new { success = false, message = "Error al obtener la configuración" });
            }
        }

        /// <summary>PUT /api/chat-overlay/config - Guarda la configuración completa del overlay</summary>
        [HttpPut("config")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> SaveConfig([FromBody] JsonElement body)
        {
            try
            {
                if (body.ValueKind != JsonValueKind.Object)
                    return BadRequest(new { success = false, message = "Configuración inválida" });

                var node = JsonNode.Parse(body.GetRawText())!.AsObject();
                SanitizeList(node, "sharedChat", "hiddenChannels");
                SanitizeList(node, "filters", "blockedUsers");
                SanitizeList(node, "filters", "blockedWords");
                SanitizeList(node, "emotes", "hidden");

                var json = node.ToJsonString();
                if (System.Text.Encoding.UTF8.GetByteCount(json) > MaxConfigBytes)
                    return BadRequest(new { success = false, message = "La configuración es demasiado grande" });

                var ownerId = GetChannelOwnerId();
                var channel = await _chatOverlay.GetChannelAsync(ownerId);
                if (channel == null)
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var row = await _db.ChatOverlayConfigs.FirstOrDefaultAsync(c => c.UserId == ownerId);
                if (row == null)
                {
                    row = new ChatOverlayConfig { UserId = ownerId };
                    _db.ChatOverlayConfigs.Add(row);
                }
                row.Config = json;
                row.UpdatedAt = DateTime.Now;
                await _db.SaveChangesAsync();

                _chatOverlay.InvalidateConfig(ownerId);
                await _hub.Clients.Group($"overlay_{channel.Value.Login}").SendAsync("ConfigurationChanged");
                return Ok(new { success = true });
            }
            catch (JsonException)
            {
                return BadRequest(new { success = false, message = "Configuración inválida" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando la config del overlay de chat");
                return StatusCode(500, new { success = false, message = "Error al guardar la configuración" });
            }
        }

        /// <summary>GET /api/chat-overlay/config/overlay/{channel} - La que lee el overlay de OBS (público, sin sesión)</summary>
        [AllowAnonymous]
        [HttpGet("config/overlay/{channel}")]
        public async Task<IActionResult> GetOverlayConfig(string channel)
        {
            try
            {
                var login = channel.ToLowerInvariant();
                var userId = await _db.Users.AsNoTracking().Where(u => u.Login == login && u.IsActive).Select(u => (long?)u.Id).FirstOrDefaultAsync();
                if (userId == null)
                    return Ok(new { success = true, config = (object?)null });

                var json = await _db.ChatOverlayConfigs.AsNoTracking().Where(c => c.UserId == userId).Select(c => c.Config).FirstOrDefaultAsync();
                return Ok(new { success = true, config = json == null ? (JsonElement?)null : JsonDocument.Parse(json).RootElement });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo la config pública del overlay de chat");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        public record TestRequest(string? Text);

        /// <summary>POST /api/chat-overlay/test - Manda un mensaje de prueba al overlay de OBS del canal</summary>
        [HttpPost("test")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> SendTest([FromBody] TestRequest? request)
        {
            try
            {
                var text = string.IsNullOrWhiteSpace(request?.Text) ? "¡Mensaje de prueba! Si lo ves en OBS, el overlay funciona." : request!.Text!.Trim();
                if (text.Length > 200) text = text[..200];
                var delivered = await _chatOverlay.SendTestAsync(GetChannelOwnerId(), text);
                return Ok(new { success = true, delivered });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando el mensaje de prueba al overlay de chat");
                return StatusCode(500, new { success = false, message = "Error al enviar la prueba" });
            }
        }

        /// <summary>GET /api/chat-overlay/emotes - Los emotes externos del canal (globales y propios) para elegir cuáles ocultar</summary>
        [HttpGet("emotes")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> GetEmotes()
        {
            try
            {
                var ownerId = GetChannelOwnerId();
                var channel = await _chatOverlay.GetChannelAsync(ownerId);
                if (channel == null)
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var map = await _emotes.GetMapAsync(channel.Value.TwitchId, channel.Value.KickId, EmoteProviders.All);
                var emotes = map.Values
                    .OrderBy(e => e.Name, StringComparer.OrdinalIgnoreCase)
                    .Select(e => new { name = e.Name, url = e.Url, provider = e.Provider, animated = e.Animated });
                return Ok(new { success = true, emotes });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listando los emotes del canal");
                return StatusCode(500, new { success = false, message = "Error al obtener los emotes" });
            }
        }

        /// <summary>POST /api/chat-overlay/emotes/refresh - Vuelve a pedir los emotes del canal a 7TV, BTTV y FFZ</summary>
        [HttpPost("emotes/refresh")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> RefreshEmotes()
        {
            try
            {
                var channel = await _chatOverlay.GetChannelAsync(GetChannelOwnerId());
                if (channel == null)
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                await _chatOverlay.RefreshEmotesAsync(channel.Value.TwitchId, channel.Value.KickId);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando los emotes del canal");
                return StatusCode(500, new { success = false, message = "Error al actualizar los emotes" });
            }
        }

        /// <summary>Deja una lista como máximo de 500 textos cortos y sin vacíos; si no es una lista, la quita</summary>
        private static void SanitizeList(JsonObject root, string section, string name)
        {
            if (root[section] is not JsonObject sec) return;
            if (sec[name] is not JsonArray list)
            {
                sec.Remove(name);
                return;
            }

            var clean = new JsonArray();
            foreach (var item in list)
            {
                if (clean.Count >= MaxListItems) break;
                if (item is JsonValue v && v.TryGetValue<string>(out var s))
                {
                    s = s.Trim();
                    if (s.Length > 0) clean.Add(s.Length > MaxItemLength ? s[..MaxItemLength] : s);
                }
            }
            sec[name] = clean;
        }
    }
}
