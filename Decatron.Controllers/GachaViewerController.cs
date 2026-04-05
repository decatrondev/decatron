using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Decatron.Core.Models.Gacha;
using Decatron.Data;
using Decatron.Services;
using System.Security.Claims;
using System.Text.Json;

namespace Decatron.Controllers
{
    /// <summary>
    /// Endpoints autenticados para viewers del gacha — perfil, privacidad, canje, colecciones
    /// </summary>
    [ApiController]
    [Route("api/gacha/viewer")]
    [Authorize]
    public class GachaViewerController : ControllerBase
    {
        private readonly DecatronDbContext _context;
        private readonly IGachaService _gachaService;
        private readonly ILogger<GachaViewerController> _logger;

        public GachaViewerController(DecatronDbContext context, IGachaService gachaService, ILogger<GachaViewerController> logger)
        {
            _context = context;
            _gachaService = gachaService;
            _logger = logger;
        }

        private (long userId, string username)? GetViewer()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("login")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !long.TryParse(userIdClaim, out var userId)) return null;
            return (userId, username?.ToLower() ?? "");
        }

        // ========================================================================
        // SETTINGS & TERMS
        // ========================================================================

        /// <summary>Obtener settings del viewer (o crearlas si no existen)</summary>
        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var settings = await GetOrCreateSettingsAsync(viewer.Value.userId, viewer.Value.username);
            return Ok(new
            {
                success = true,
                settings = new
                {
                    settings.TermsAccepted,
                    settings.TermsAcceptedAt,
                    settings.CollectionsPublic,
                    privateChannels = JsonSerializer.Deserialize<List<string>>(settings.PrivateChannelsJson ?? "[]"),
                    settings.TwitchUsername
                }
            });
        }

        /// <summary>Aceptar terminos del gacha</summary>
        [HttpPost("accept-terms")]
        public async Task<IActionResult> AcceptTerms()
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var settings = await GetOrCreateSettingsAsync(viewer.Value.userId, viewer.Value.username);
            settings.TermsAccepted = true;
            settings.TermsAcceptedAt = DateTime.UtcNow;
            settings.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("[GACHA] Viewer {User} accepted terms", viewer.Value.username);
            return Ok(new { success = true, message = "Terminos aceptados" });
        }

        // ========================================================================
        // PRIVACY
        // ========================================================================

        /// <summary>Toggle privacidad global o por canal</summary>
        [HttpPost("privacy")]
        public async Task<IActionResult> UpdatePrivacy([FromBody] PrivacyUpdateDto dto)
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var settings = await GetOrCreateSettingsAsync(viewer.Value.userId, viewer.Value.username);

            if (dto.Channel == null)
            {
                // Global toggle
                settings.CollectionsPublic = dto.IsPublic;
            }
            else
            {
                // Per-channel toggle
                var channels = JsonSerializer.Deserialize<List<string>>(settings.PrivateChannelsJson ?? "[]") ?? new();
                var channelLower = dto.Channel.ToLower();

                if (dto.IsPublic)
                    channels.Remove(channelLower);
                else if (!channels.Contains(channelLower))
                    channels.Add(channelLower);

                settings.PrivateChannelsJson = JsonSerializer.Serialize(channels);
            }

            settings.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }

        // ========================================================================
        // MY COLLECTIONS (multi-channel)
        // ========================================================================

        /// <summary>Todas las colecciones del viewer en todos los canales</summary>
        [HttpGet("collections")]
        public async Task<IActionResult> GetMyCollections()
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var settings = await GetOrCreateSettingsAsync(viewer.Value.userId, viewer.Value.username);
            if (!settings.TermsAccepted)
                return Ok(new { success = true, termsRequired = true, collections = Array.Empty<object>() });

            // Find all channels where this viewer has participated
            var participants = await _context.GachaParticipants
                .Where(p => p.Name == viewer.Value.username)
                .ToListAsync();

            var collections = new List<object>();
            foreach (var p in participants)
            {
                var inventory = await _context.GachaInventories
                    .Where(i => i.ParticipantId == p.Id)
                    .ToListAsync();

                var totalItems = await _context.GachaItems.CountAsync(i => i.ChannelName == p.ChannelName && i.Available);
                var banner = await _context.GachaBanners.Where(b => b.ChannelName == p.ChannelName && b.IsActive).Select(b => b.BannerUrl).FirstOrDefaultAsync();

                var privateChannels = JsonSerializer.Deserialize<List<string>>(settings.PrivateChannelsJson ?? "[]") ?? new();
                var isPrivate = !settings.CollectionsPublic || privateChannels.Contains(p.ChannelName);

                collections.Add(new
                {
                    channelName = p.ChannelName,
                    banner,
                    participantId = p.Id,
                    uniqueCards = inventory.Select(i => i.ItemId).Distinct().Count(),
                    totalCards = inventory.Sum(i => i.Quantity),
                    totalAvailable = totalItems,
                    pullsUsed = p.Pulls,
                    pullsAvailable = (int)p.EffectiveDonation,
                    totalDonated = p.DonationAmount,
                    isPrivate
                });
            }

            return Ok(new { success = true, termsRequired = false, collections });
        }

        // ========================================================================
        // REDEEM (from viewer profile)
        // ========================================================================

        /// <summary>Canjear item desde el perfil del viewer</summary>
        [HttpPost("redeem/{inventoryId:int}")]
        public async Task<IActionResult> RedeemItem(int inventoryId)
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            // Verify the inventory item belongs to this viewer
            var inv = await _context.GachaInventories
                .Include(i => i.Participant)
                .FirstOrDefaultAsync(i => i.Id == inventoryId);

            if (inv == null) return NotFound(new { success = false, message = "Item no encontrado" });
            if (inv.Participant == null || inv.Participant.Name != viewer.Value.username)
                return Forbid();

            try
            {
                await _gachaService.RedeemItemAsync(inventoryId, inv.ChannelName);
                return Ok(new { success = true, message = "Item canjeado" });
            }
            catch (InvalidOperationException ex) { return BadRequest(new { success = false, message = ex.Message }); }
        }

        // ========================================================================
        // COLLECTION DETAIL (for viewer's own channel view)
        // ========================================================================

        /// <summary>Detalle de coleccion de un canal específico (autenticado)</summary>
        [HttpGet("collection/{channelName}")]
        public async Task<IActionResult> GetCollectionDetail(string channelName)
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var participant = await _context.GachaParticipants
                .FirstOrDefaultAsync(p => p.ChannelName == channelName.ToLower() && p.Name == viewer.Value.username);

            if (participant == null)
                return Ok(new { success = true, inventory = Array.Empty<object>(), stats = new { uniqueCards = 0, totalCards = 0 } });

            var inventory = await _context.GachaInventories
                .Include(i => i.Item)
                .Where(i => i.ParticipantId == participant.Id)
                .OrderByDescending(i => i.LastWonAt)
                .Select(i => new
                {
                    i.Id, i.ItemId,
                    name = i.Item != null ? i.Item.Name : "",
                    rarity = i.Item != null ? i.Item.Rarity : "common",
                    image = i.Item != null ? i.Item.Image : null,
                    i.Quantity, i.IsRedeemed, i.LastWonAt
                })
                .ToListAsync();

            var logs = await _context.GachaPullLogs
                .Include(l => l.Item)
                .Where(l => l.ParticipantId == participant.Id && l.ChannelName == channelName.ToLower())
                .OrderByDescending(l => l.OccurredAt)
                .Take(50)
                .Select(l => new
                {
                    l.Id,
                    itemName = l.Item != null ? l.Item.Name : "",
                    rarity = l.Item != null ? l.Item.Rarity : "common",
                    image = l.Item != null ? l.Item.Image : null,
                    l.OccurredAt
                })
                .ToListAsync();

            return Ok(new
            {
                success = true,
                participant = new { participant.Name, participant.DonationAmount, participant.Pulls, participant.EffectiveDonation },
                inventory,
                logs
            });
        }

        // ========================================================================
        // INVENTORY (for showcase editor)
        // ========================================================================

        /// <summary>Inventario del viewer por participantId (para editor de vitrina)</summary>
        [HttpGet("inventory/{participantId:int}")]
        public async Task<IActionResult> GetViewerInventory(int participantId)
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var participant = await _context.GachaParticipants.FindAsync(participantId);
            if (participant == null) return NotFound(new { success = false });
            if (participant.Name != viewer.Value.username) return Forbid();

            var inventory = await _context.GachaInventories
                .Include(i => i.Item)
                .Where(i => i.ParticipantId == participantId)
                .Select(i => new
                {
                    i.Id, i.ItemId,
                    name = i.Item != null ? i.Item.Name : "",
                    rarity = i.Item != null ? i.Item.Rarity : "common",
                    image = i.Item != null ? i.Item.Image : null,
                    i.Quantity, i.IsRedeemed
                })
                .ToListAsync();

            return Ok(new { success = true, inventory });
        }

        // ========================================================================
        // WISHLIST AVAILABLE (items not owned)
        // ========================================================================

        /// <summary>Items disponibles para wishlist (items del canal que el viewer NO tiene)</summary>
        [HttpGet("wishlist/{participantId:int}/available")]
        public async Task<IActionResult> GetWishlistAvailable(int participantId)
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var participant = await _context.GachaParticipants.FindAsync(participantId);
            if (participant == null) return NotFound(new { success = false });
            if (participant.Name != viewer.Value.username) return Forbid();

            var ownedItemIds = await _context.GachaInventories
                .Where(i => i.ParticipantId == participantId)
                .Select(i => i.ItemId)
                .Distinct()
                .ToListAsync();

            var wishlistItemIds = await _context.GachaWishlists
                .Where(w => w.ParticipantId == participantId)
                .Select(w => w.ItemId)
                .ToListAsync();

            var available = await _context.GachaItems
                .Where(i => i.ChannelName == participant.ChannelName
                          && i.Available
                          && !ownedItemIds.Contains(i.Id)
                          && !wishlistItemIds.Contains(i.Id))
                .Select(i => new { i.Id, i.Name, i.Rarity, i.Image })
                .ToListAsync();

            return Ok(new { success = true, items = available });
        }

        // ========================================================================
        // ACHIEVEMENTS
        // ========================================================================

        /// <summary>Logros del participante (desbloqueados y pendientes)</summary>
        [HttpGet("achievements/{participantId:int}")]
        public async Task<IActionResult> GetAchievements(int participantId)
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var participant = await _context.GachaParticipants.FindAsync(participantId);
            if (participant == null) return NotFound(new { success = false, message = "Participante no encontrado" });
            if (participant.Name != viewer.Value.username) return Forbid();

            var achievements = await _gachaService.GetAchievementsForParticipantAsync(participantId);
            return Ok(new { success = true, achievements });
        }

        // ========================================================================
        // SHOWCASE
        // ========================================================================

        /// <summary>Obtener showcase del participante</summary>
        [HttpGet("showcase/{participantId:int}")]
        public async Task<IActionResult> GetShowcase(int participantId)
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var participant = await _context.GachaParticipants.FindAsync(participantId);
            if (participant == null) return NotFound(new { success = false, message = "Participante no encontrado" });
            if (participant.Name != viewer.Value.username) return Forbid();

            var showcase = await _gachaService.GetShowcaseAsync(participantId);
            return Ok(new
            {
                success = true,
                showcase = showcase.Select(s => new
                {
                    s.Id, s.ItemId, s.Position,
                    name = s.Item?.Name, rarity = s.Item?.Rarity, image = s.Item?.Image,
                    s.AddedAt
                })
            });
        }

        /// <summary>Establecer showcase (max 5 items)</summary>
        [HttpPost("showcase")]
        public async Task<IActionResult> SetShowcase([FromBody] SetShowcaseDto dto)
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var participant = await _context.GachaParticipants.FindAsync(dto.ParticipantId);
            if (participant == null) return NotFound(new { success = false, message = "Participante no encontrado" });
            if (participant.Name != viewer.Value.username) return Forbid();

            try
            {
                await _gachaService.SetShowcaseAsync(dto.ParticipantId, dto.ItemIds);
                return Ok(new { success = true, message = "Showcase actualizado" });
            }
            catch (Exception ex) when (ex is ArgumentException || ex is InvalidOperationException)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        // ========================================================================
        // WISHLIST
        // ========================================================================

        /// <summary>Obtener wishlist del participante</summary>
        [HttpGet("wishlist/{participantId:int}")]
        public async Task<IActionResult> GetWishlist(int participantId)
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var participant = await _context.GachaParticipants.FindAsync(participantId);
            if (participant == null) return NotFound(new { success = false, message = "Participante no encontrado" });
            if (participant.Name != viewer.Value.username) return Forbid();

            var wishlist = await _gachaService.GetWishlistAsync(participantId);
            return Ok(new
            {
                success = true,
                wishlist = wishlist.Select(w => new
                {
                    w.Id, w.ItemId,
                    name = w.Item?.Name, rarity = w.Item?.Rarity, image = w.Item?.Image,
                    w.AddedAt
                })
            });
        }

        /// <summary>Agregar item a wishlist</summary>
        [HttpPost("wishlist")]
        public async Task<IActionResult> AddToWishlist([FromBody] WishlistDto dto)
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var participant = await _context.GachaParticipants.FindAsync(dto.ParticipantId);
            if (participant == null) return NotFound(new { success = false, message = "Participante no encontrado" });
            if (participant.Name != viewer.Value.username) return Forbid();

            try
            {
                await _gachaService.AddToWishlistAsync(dto.ParticipantId, dto.ItemId);
                return Ok(new { success = true, message = "Item agregado a wishlist" });
            }
            catch (Exception ex) when (ex is InvalidOperationException || ex is KeyNotFoundException)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>Remover item de wishlist</summary>
        [HttpDelete("wishlist/{participantId:int}/{itemId:int}")]
        public async Task<IActionResult> RemoveFromWishlist(int participantId, int itemId)
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var participant = await _context.GachaParticipants.FindAsync(participantId);
            if (participant == null) return NotFound(new { success = false, message = "Participante no encontrado" });
            if (participant.Name != viewer.Value.username) return Forbid();

            try
            {
                await _gachaService.RemoveFromWishlistAsync(participantId, itemId);
                return Ok(new { success = true, message = "Item removido de wishlist" });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ========================================================================
        // ADVANCED STATS
        // ========================================================================

        /// <summary>Estadisticas avanzadas del participante</summary>
        [HttpGet("advanced-stats/{participantId:int}")]
        public async Task<IActionResult> GetAdvancedStats(int participantId)
        {
            var viewer = GetViewer();
            if (viewer == null) return Unauthorized();

            var participant = await _context.GachaParticipants.FindAsync(participantId);
            if (participant == null) return NotFound(new { success = false, message = "Participante no encontrado" });
            if (participant.Name != viewer.Value.username) return Forbid();

            try
            {
                var stats = await _gachaService.GetAdvancedStatsAsync(participant.ChannelName, participantId);
                return Ok(new { success = true, stats });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
        }

        // ========================================================================
        // HELPERS
        // ========================================================================

        private async Task<GachaViewerSettings> GetOrCreateSettingsAsync(long userId, string username)
        {
            var settings = await _context.GachaViewerSettings.FirstOrDefaultAsync(s => s.UserId == userId);
            if (settings == null)
            {
                settings = new GachaViewerSettings
                {
                    UserId = userId,
                    TwitchUsername = username,
                    CollectionsPublic = true
                };
                _context.GachaViewerSettings.Add(settings);
                await _context.SaveChangesAsync();
            }
            return settings;
        }
    }

    public class PrivacyUpdateDto
    {
        public string? Channel { get; set; }
        public bool IsPublic { get; set; } = true;
    }

    public class SetShowcaseDto
    {
        public int ParticipantId { get; set; }
        public List<int> ItemIds { get; set; } = new();
    }

    public class WishlistDto
    {
        public int ParticipantId { get; set; }
        public int ItemId { get; set; }
    }
}
