using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using Decatron.Attributes;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Hubs;
using Decatron.Services.Accounts;
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
        private readonly AccountChannelResolver _accounts;
        private readonly EmoteCatalogService _emotes;
        private readonly IHubContext<OverlayHub> _hub;
        private readonly ILogger<ChatOverlayController> _logger;

        public ChatOverlayController(DecatronDbContext db, ChatOverlayService chatOverlay, AccountChannelResolver accounts, EmoteCatalogService emotes,
            IHubContext<OverlayHub> hub, ILogger<ChatOverlayController> logger)
        {
            _db = db;
            _chatOverlay = chatOverlay;
            _accounts = accounts;
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

                // La config es una por cuenta: la de la fila principal, se entre por el canal que se entre
                var json = await _db.ChatOverlayConfigs.AsNoTracking().Where(c => c.UserId == channel.PrincipalUserId).Select(c => c.Config).FirstOrDefaultAsync();
                return Ok(new
                {
                    success = true,
                    config = json == null ? (JsonElement?)null : JsonDocument.Parse(json).RootElement,
                    channel = new
                    {
                        login = channel.Login,
                        hasTwitch = channel.HasTwitch,
                        hasKick = channel.HasKick
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

                var row = await _db.ChatOverlayConfigs.FirstOrDefaultAsync(c => c.UserId == channel.PrincipalUserId);
                if (row == null)
                {
                    row = new ChatOverlayConfig { UserId = channel.PrincipalUserId };
                    _db.ChatOverlayConfigs.Add(row);
                }
                row.Config = json;
                row.UpdatedAt = DateTime.Now;
                await _db.SaveChangesAsync();

                _chatOverlay.InvalidateConfig(channel.PrincipalUserId);
                await _hub.Clients.Group($"overlay_{channel.Login}").SendAsync("ConfigurationChanged");
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

        /// <summary>
        /// GET /api/chat-overlay/status - Qué fuentes de chat hay conectadas en OBS ahora, por variante, y si se pisan.
        /// "mixed" = hay un enlace Todo y otro de una sola plataforma (cada mensaje saldría dos veces);
        /// "repeated" = la misma variante conectada más de una vez (sirve si están en escenas distintas).
        /// </summary>
        [HttpGet("status")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> GetStatus()
        {
            try
            {
                var channel = await _chatOverlay.GetChannelAsync(GetChannelOwnerId());
                if (channel == null)
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var counts = OverlayHub.CountOverlayVariants(channel.Login, ChatOverlayService.OverlayType);
                var total = counts.Values.Sum();
                var warnings = new List<string>();
                if (counts["all"] > 0 && (counts["twitch"] > 0 || counts["kick"] > 0)) warnings.Add("mixed");
                if (counts.Values.Any(c => c > 1)) warnings.Add("repeated");
                return Ok(new { success = true, total, all = counts["all"], twitch = counts["twitch"], kick = counts["kick"], warnings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo el estado de las fuentes del overlay de chat");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>
        /// GET /api/chat-overlay/resolve/{channel} - A qué clave unirse y qué mostraba ese enlace antes (público, sin sesión).
        /// El overlay de OBS lo pregunta al cargar: el alias de la URL puede ser el login de Twitch, kick_&lt;id&gt; o el KickId,
        /// pero el servidor emite siempre al grupo de la fila principal de la cuenta.
        /// </summary>
        [AllowAnonymous]
        [HttpGet("resolve/{channel}")]
        public async Task<IActionResult> ResolveChannel(string channel)
        {
            try
            {
                var resolved = await _accounts.ResolveAliasAsync(channel);
                if (resolved == null)
                    return Ok(new { success = true, found = false });
                return Ok(new { success = true, found = true, overlayKey = resolved.Account.OverlayKey, variant = resolved.LegacyVariant });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resolviendo el canal del overlay de chat");
                return StatusCode(500, new { success = false, message = "Error interno del servidor" });
            }
        }

        /// <summary>GET /api/chat-overlay/config/overlay/{channel} - La que lee el overlay de OBS (público, sin sesión). Una por cuenta: la de la fila principal</summary>
        [AllowAnonymous]
        [HttpGet("config/overlay/{channel}")]
        public async Task<IActionResult> GetOverlayConfig(string channel)
        {
            try
            {
                var resolved = await _accounts.ResolveAliasAsync(channel);
                if (resolved == null)
                    return Ok(new { success = true, config = (object?)null });

                var userId = resolved.Account.Principal.UserId;
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

                var map = await _emotes.GetMapAsync(channel.TwitchId, channel.KickId, EmoteProviders.All);
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

                await _chatOverlay.RefreshEmotesAsync(channel.TwitchId, channel.KickId);
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
