using System.Security.Claims;
using Decatron.Core.Helpers;
using Decatron.Data;
using Decatron.Services.ChatOverlay;
using Decatron.Services.Multiview;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Multi-view público (/multi): límites de casillas según el plan de quien mira y estado de los canales de Kick.
    /// Sin sesión se aplica el plan gratis. Plan: .dev/plans/MULTIVIEW_PLAN.md, Fase 1.
    /// </summary>
    [Route("api/public/multiview")]
    [ApiController]
    [AllowAnonymous]
    public class MultiviewController : ControllerBase
    {
        private const int MaxStatusChannels = 12;

        private readonly DecatronDbContext _db;
        private readonly MultiviewStatusService _status;
        private readonly MultiviewChatService _chat;
        private readonly EmoteCatalogService _emotes;
        private readonly ILogger<MultiviewController> _logger;

        public MultiviewController(DecatronDbContext db, MultiviewStatusService status, MultiviewChatService chat, EmoteCatalogService emotes, ILogger<MultiviewController> logger)
        {
            _db = db;
            _status = status;
            _chat = chat;
            _emotes = emotes;
            _logger = logger;
        }

        /// <summary>
        /// Los emotes de terceros (7TV, BTTV, FFZ) y de Decatron que se ven en un canal abierto, para autocompletar al
        /// escribir. <c>?key=twitch:canal</c> o <c>kick:canal</c>. Si el canal aún no se resolvió, ready=false y vacío.
        /// </summary>
        [HttpGet("emotes")]
        public async Task<IActionResult> GetEmotes([FromQuery] string? key, CancellationToken ct)
        {
            key = (key ?? "").Trim().ToLowerInvariant();
            if (!MultiviewChatService.TryParseKey(key, out var platform, out var channel)) return BadRequest(new { error = "key" });
            try
            {
                string? twitchId = null, kickId = null;
                if (platform == "twitch") twitchId = _chat.TryGetTwitchRoomId(channel);
                else kickId = (await _status.GetKickAsync(channel, ct))?.UserId?.ToString();
                if (twitchId == null && kickId == null) return Ok(new { ready = false, items = Array.Empty<object>() });

                var map = await _emotes.GetMapAsync(twitchId, kickId, EmoteProviders.All);
                var items = map.Values.Select(e => new { name = e.Name, url = e.Url, provider = e.Provider, animated = e.Animated }).ToList();
                return Ok(new { ready = true, items });
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "No se pudieron leer los emotes del Multi-view para {Key}", key);
                return Ok(new { ready = false, items = Array.Empty<object>() });
            }
        }

        /// <summary>Cuántas casillas puede abrir quien mira (anónimo = gratis).</summary>
        [HttpGet("limits")]
        public async Task<IActionResult> GetLimits()
        {
            try
            {
                var tier = "free";
                if (long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
                    tier = await TierResolver.GetEffectiveTierAsync(_db, userId);
                var limits = MultiviewTierLimits.ForTier(tier);
                return Ok(new { tier, maxSlots = limits.MaxSlots, maxLayouts = limits.MaxLayouts });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al leer los límites del Multi-view");
                return Ok(new { tier = "free", maxSlots = MultiviewTierLimits.ForTier("free").MaxSlots, maxLayouts = MultiviewTierLimits.ForTier("free").MaxLayouts });
            }
        }

        /// <summary>Estado de canales de Kick: ?kick=a,b,c (máximo 12). Los que fallan salen con known=false.</summary>
        [HttpGet("kick-status")]
        public async Task<IActionResult> GetKickStatus([FromQuery] string? kick, CancellationToken ct)
        {
            var slugs = (kick ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => s.ToLowerInvariant())
                .Where(MultiviewStatusService.IsValidSlug)
                .Distinct()
                .Take(MaxStatusChannels)
                .ToList();

            var items = await Task.WhenAll(slugs.Select(async s =>
            {
                var r = await _status.GetKickAsync(s, ct);
                return r == null
                    ? new { slug = s, known = false, exists = false, live = false, viewers = (int?)null, chatroomId = (long?)null, title = (string?)null }
                    : new { slug = s, known = true, exists = r.Exists, live = r.Live, viewers = r.Viewers, chatroomId = r.ChatroomId, title = r.Title };
            }));
            return Ok(new { items });
        }
    }
}
