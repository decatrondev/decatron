using System.Security.Claims;
using System.Text.RegularExpressions;
using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.BotList;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Lista de bots: el catálogo global (lo mantiene el owner) y lo que cada canal cambia sobre él.
    /// Plan: .dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 0.
    /// </summary>
    [Authorize]
    [Route("api/botlist")]
    [ApiController]
    public class BotListController : ControllerBase
    {
        // Cantidad de bots propios por canal: un tope de seguridad, no un límite de uso
        private const int MaxCustomBotsPerChannel = 500;
        private static readonly Regex ValidUsername = new(@"^[a-z0-9_]{1,40}$", RegexOptions.Compiled);

        private readonly DecatronDbContext _db;
        private readonly IBotListService _botList;
        private readonly ILogger<BotListController> _logger;

        public BotListController(DecatronDbContext db, IBotListService botList, ILogger<BotListController> logger)
        {
            _db = db;
            _botList = botList;
            _logger = logger;
        }

        public record EffectsRequest(bool? HideOverlay, bool? SkipCounting, bool? SkipCommands, bool? SkipModeration, bool? SkipSpeech);
        public record UpdateEntryRequest(string Platform, string Username, bool? Enabled, bool? Reset,
            bool? HideOverlay, bool? SkipCounting, bool? SkipCommands, bool? SkipModeration, bool? SkipSpeech);
        public record CustomBotRequest(string Platform, string Username, string? DisplayName, string? Category);
        public record CategoryToggleRequest(bool Enabled, string? Platform);
        public record CatalogRequest(string Platform, string Username, string DisplayName, string Category, string? Notes);

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

        private async Task<bool> IsOwnerAsync()
        {
            var username = User.FindFirst("login")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(username)) return false;
            return await _db.SystemAdmins.AnyAsync(a => a.Username.ToLower() == username.ToLower() && a.Role == "owner");
        }

        private static object EffectsDto(BotEffects e) => new
        {
            hideOverlay = e.HideOverlay,
            skipCounting = e.SkipCounting,
            skipCommands = e.SkipCommands,
            skipModeration = e.SkipModeration,
            skipSpeech = e.SkipSpeech
        };

        // ═══════════════════════════════════════════════════════════════
        // CANAL
        // ═══════════════════════════════════════════════════════════════

        /// <summary>GET /api/botlist - El catálogo con lo que el canal cambió, y los bots propios del canal</summary>
        [HttpGet]
        [RequirePermission("moderation")]
        public async Task<IActionResult> Get()
        {
            try
            {
                var ownerId = GetChannelOwnerId();
                var owner = await _db.Users.AsNoTracking().Where(u => u.Id == ownerId)
                    .Select(u => new { u.TwitchId, u.KickId }).FirstOrDefaultAsync();
                if (owner == null)
                    return NotFound(new { success = false, message = "Canal no encontrado" });

                var catalog = await _db.BotCatalog.AsNoTracking().OrderBy(b => b.DisplayName).ToListAsync();
                var rows = await _db.ChannelBotEntries.AsNoTracking().Where(r => r.UserId == ownerId).ToListAsync();
                var byKey = rows.ToDictionary(r => BotListService.Key(r.Platform, r.Username));

                var bots = new List<object>();
                foreach (var c in catalog)
                {
                    byKey.TryGetValue(BotListService.Key(c.Platform, c.Username), out var row);
                    var d = BotCategories.DefaultsFor(c.Category);
                    bots.Add(new
                    {
                        id = row?.Id,
                        catalogId = c.Id,
                        platform = c.Platform,
                        username = c.Username,
                        displayName = c.DisplayName,
                        category = c.Category,
                        isCustom = false,
                        notes = c.Notes,
                        enabled = row?.Enabled ?? true,
                        effects = new
                        {
                            hideOverlay = row?.HideOverlay ?? d.HideOverlay,
                            skipCounting = row?.SkipCounting ?? d.SkipCounting,
                            skipCommands = row?.SkipCommands ?? d.SkipCommands,
                            skipModeration = row?.SkipModeration ?? d.SkipModeration,
                            skipSpeech = row?.SkipSpeech ?? d.SkipSpeech
                        },
                        defaults = new
                        {
                            hideOverlay = d.HideOverlay,
                            skipCounting = d.SkipCounting,
                            skipCommands = d.SkipCommands,
                            skipModeration = d.SkipModeration,
                            skipSpeech = d.SkipSpeech
                        },
                        customized = row != null && (row.HideOverlay != null || row.SkipCounting != null || row.SkipCommands != null
                                                     || row.SkipModeration != null || row.SkipSpeech != null)
                    });
                }

                foreach (var r in rows.Where(r => r.IsCustom).OrderBy(r => r.Username))
                {
                    var category = BotCategories.IsValidCategory(r.Category) ? r.Category! : "utilidad";
                    var d = BotCategories.DefaultsFor(category);
                    bots.Add(new
                    {
                        id = (long?)r.Id,
                        catalogId = (long?)null,
                        platform = r.Platform,
                        username = r.Username,
                        displayName = string.IsNullOrWhiteSpace(r.DisplayName) ? r.Username : r.DisplayName,
                        category,
                        isCustom = true,
                        enabled = r.Enabled,
                        effects = new
                        {
                            hideOverlay = r.HideOverlay ?? d.HideOverlay,
                            skipCounting = r.SkipCounting ?? d.SkipCounting,
                            skipCommands = r.SkipCommands ?? d.SkipCommands,
                            skipModeration = r.SkipModeration ?? d.SkipModeration,
                            skipSpeech = r.SkipSpeech ?? d.SkipSpeech
                        },
                        defaults = new
                        {
                            hideOverlay = d.HideOverlay,
                            skipCounting = d.SkipCounting,
                            skipCommands = d.SkipCommands,
                            skipModeration = d.SkipModeration,
                            skipSpeech = d.SkipSpeech
                        },
                        customized = r.HideOverlay != null || r.SkipCounting != null || r.SkipCommands != null
                                     || r.SkipModeration != null || r.SkipSpeech != null
                    });
                }

                return Ok(new
                {
                    success = true,
                    bots,
                    categories = BotCategories.All,
                    linked = new { twitch = !string.IsNullOrEmpty(owner.TwitchId), kick = !string.IsNullOrEmpty(owner.KickId) },
                    maxCustom = MaxCustomBotsPerChannel,
                    isOwner = await IsOwnerAsync()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo la lista de bots");
                return StatusCode(500, new { success = false, message = "Error al obtener la lista de bots" });
            }
        }

        /// <summary>PUT /api/botlist/entry - Enciende o apaga un bot del catálogo, o cambia sus efectos solo en este canal</summary>
        [HttpPut("entry")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> UpdateEntry([FromBody] UpdateEntryRequest request)
        {
            try
            {
                if (!BotCategories.IsValidPlatform(request.Platform))
                    return BadRequest(new { success = false, message = "Plataforma inválida" });
                var username = BotListService.NormalizeUsername(request.Platform, request.Username);

                var ownerId = GetChannelOwnerId();
                var row = await _db.ChannelBotEntries.FirstOrDefaultAsync(r =>
                    r.UserId == ownerId && r.Platform == request.Platform && r.Username == username);

                if (row == null)
                {
                    // Una fila nueva solo existe para un bot del catálogo; los propios se crean con POST custom
                    var inCatalog = await _db.BotCatalog.AnyAsync(b => b.Platform == request.Platform && b.Username == username);
                    if (!inCatalog)
                        return NotFound(new { success = false, message = "Bot no encontrado" });

                    row = new ChannelBotEntry { UserId = ownerId, Platform = request.Platform, Username = username };
                    _db.ChannelBotEntries.Add(row);
                }

                if (request.Reset == true)
                {
                    row.HideOverlay = row.SkipCounting = row.SkipCommands = row.SkipModeration = row.SkipSpeech = null;
                }
                else
                {
                    if (request.HideOverlay.HasValue) row.HideOverlay = request.HideOverlay;
                    if (request.SkipCounting.HasValue) row.SkipCounting = request.SkipCounting;
                    if (request.SkipCommands.HasValue) row.SkipCommands = request.SkipCommands;
                    if (request.SkipModeration.HasValue) row.SkipModeration = request.SkipModeration;
                    if (request.SkipSpeech.HasValue) row.SkipSpeech = request.SkipSpeech;
                }
                if (request.Enabled.HasValue) row.Enabled = request.Enabled.Value;
                row.UpdatedAt = DateTime.Now;

                await _db.SaveChangesAsync();
                _botList.InvalidateChannel(ownerId);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando un bot de la lista");
                return StatusCode(500, new { success = false, message = "Error al guardar el bot" });
            }
        }

        /// <summary>PUT /api/botlist/category/{category} - Enciende o apaga todos los bots de una categoría en este canal</summary>
        [HttpPut("category/{category}")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> ToggleCategory(string category, [FromBody] CategoryToggleRequest request)
        {
            try
            {
                if (!BotCategories.IsValidCategory(category))
                    return BadRequest(new { success = false, message = "Categoría inválida" });
                if (request.Platform != null && !BotCategories.IsValidPlatform(request.Platform))
                    return BadRequest(new { success = false, message = "Plataforma inválida" });

                var ownerId = GetChannelOwnerId();
                var catalog = await _db.BotCatalog.Where(b => b.Category == category
                    && (request.Platform == null || b.Platform == request.Platform)).ToListAsync();
                var rows = await _db.ChannelBotEntries.Where(r => r.UserId == ownerId && !r.IsCustom).ToListAsync();
                var byKey = rows.ToDictionary(r => BotListService.Key(r.Platform, r.Username));

                foreach (var c in catalog)
                {
                    if (byKey.TryGetValue(BotListService.Key(c.Platform, c.Username), out var row))
                    {
                        row.Enabled = request.Enabled;
                        row.UpdatedAt = DateTime.Now;
                    }
                    else if (!request.Enabled)
                    {
                        // Sin fila el bot ya está encendido: solo hace falta crearla para apagarlo
                        _db.ChannelBotEntries.Add(new ChannelBotEntry
                        {
                            UserId = ownerId, Platform = c.Platform, Username = c.Username, Enabled = false
                        });
                    }
                }

                // Los bots propios de esa categoría también siguen el interruptor
                foreach (var r in await _db.ChannelBotEntries.Where(r => r.UserId == ownerId && r.IsCustom && r.Category == category
                    && (request.Platform == null || r.Platform == request.Platform)).ToListAsync())
                {
                    r.Enabled = request.Enabled;
                    r.UpdatedAt = DateTime.Now;
                }

                await _db.SaveChangesAsync();
                _botList.InvalidateChannel(ownerId);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cambiando una categoría de bots");
                return StatusCode(500, new { success = false, message = "Error al guardar la categoría" });
            }
        }

        /// <summary>POST /api/botlist/custom - Agrega un bot propio del canal</summary>
        [HttpPost("custom")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> AddCustom([FromBody] CustomBotRequest request)
        {
            try
            {
                if (!BotCategories.IsValidPlatform(request.Platform))
                    return BadRequest(new { success = false, message = "Plataforma inválida" });

                var category = string.IsNullOrWhiteSpace(request.Category) ? "utilidad" : request.Category;
                if (!BotCategories.IsValidCategory(category))
                    return BadRequest(new { success = false, message = "Categoría inválida" });

                var username = BotListService.NormalizeUsername(request.Platform, request.Username);
                if (!ValidUsername.IsMatch(username))
                    return BadRequest(new { success = false, message = "El usuario solo puede tener letras, números y _" });

                var displayName = request.DisplayName?.Trim();
                if (displayName is { Length: > 100 })
                    return BadRequest(new { success = false, message = "El nombre no puede pasar de 100 caracteres" });

                var ownerId = GetChannelOwnerId();

                if (await _db.BotCatalog.AnyAsync(b => b.Platform == request.Platform && b.Username == username))
                    return Conflict(new { success = false, message = "Ese bot ya está en el catálogo: enciéndelo o apágalo desde ahí" });
                if (await _db.ChannelBotEntries.AnyAsync(r => r.UserId == ownerId && r.Platform == request.Platform && r.Username == username))
                    return Conflict(new { success = false, message = "Ese bot ya está en tu lista" });
                if (await _db.ChannelBotEntries.CountAsync(r => r.UserId == ownerId && r.IsCustom) >= MaxCustomBotsPerChannel)
                    return BadRequest(new { success = false, message = $"Llegaste al máximo de {MaxCustomBotsPerChannel} bots propios" });

                // Nadie puede agregarse a sí mismo ni al dueño del canal como bot (se quedaría sin comandos)
                var owner = await _db.Users.AsNoTracking().Where(u => u.Id == ownerId)
                    .Select(u => new { u.Login, u.KickUsername }).FirstOrDefaultAsync();
                if (owner != null && (BotListService.NormalizeUsername("twitch", owner.Login ?? "") == username
                                      || BotListService.NormalizeUsername("kick", owner.KickUsername ?? "") == username))
                    return BadRequest(new { success = false, message = "No puedes agregar al dueño del canal como bot" });

                var row = new ChannelBotEntry
                {
                    UserId = ownerId,
                    Platform = request.Platform,
                    Username = username,
                    DisplayName = string.IsNullOrEmpty(displayName) ? username : displayName,
                    Category = category,
                    IsCustom = true
                };
                _db.ChannelBotEntries.Add(row);
                await _db.SaveChangesAsync();
                _botList.InvalidateChannel(ownerId);
                return Ok(new { success = true, id = row.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error agregando un bot propio");
                return StatusCode(500, new { success = false, message = "Error al agregar el bot" });
            }
        }

        /// <summary>DELETE /api/botlist/custom/{id} - Quita un bot propio del canal</summary>
        [HttpDelete("custom/{id:long}")]
        [RequirePermission("moderation")]
        public async Task<IActionResult> DeleteCustom(long id)
        {
            try
            {
                var ownerId = GetChannelOwnerId();
                var row = await _db.ChannelBotEntries.FirstOrDefaultAsync(r => r.Id == id && r.UserId == ownerId && r.IsCustom);
                if (row == null)
                    return NotFound(new { success = false, message = "Bot no encontrado" });

                _db.ChannelBotEntries.Remove(row);
                await _db.SaveChangesAsync();
                _botList.InvalidateChannel(ownerId);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error quitando un bot propio");
                return StatusCode(500, new { success = false, message = "Error al quitar el bot" });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // CATÁLOGO GLOBAL (solo owner)
        // ═══════════════════════════════════════════════════════════════

        private async Task<IActionResult?> ValidateCatalogAsync(CatalogRequest r, long? exceptId)
        {
            if (!BotCategories.IsValidPlatform(r.Platform))
                return BadRequest(new { success = false, message = "Plataforma inválida" });
            if (!BotCategories.IsValidCategory(r.Category))
                return BadRequest(new { success = false, message = "Categoría inválida" });
            var username = BotListService.NormalizeUsername(r.Platform, r.Username);
            if (!ValidUsername.IsMatch(username))
                return BadRequest(new { success = false, message = "El usuario solo puede tener letras, números y _" });
            if (string.IsNullOrWhiteSpace(r.DisplayName) || r.DisplayName.Trim().Length > 100)
                return BadRequest(new { success = false, message = "El nombre es obligatorio (máximo 100 caracteres)" });
            if (r.Notes is { Length: > 300 })
                return BadRequest(new { success = false, message = "Las notas no pueden pasar de 300 caracteres" });
            if (await _db.BotCatalog.AnyAsync(b => b.Platform == r.Platform && b.Username == username && b.Id != exceptId))
                return Conflict(new { success = false, message = "Ese bot ya está en el catálogo" });
            return null;
        }

        /// <summary>POST /api/botlist/catalog - Agrega un bot al catálogo global</summary>
        [HttpPost("catalog")]
        public async Task<IActionResult> AddCatalog([FromBody] CatalogRequest request)
        {
            if (!await IsOwnerAsync()) return Forbid();
            try
            {
                var invalid = await ValidateCatalogAsync(request, null);
                if (invalid != null) return invalid;

                var row = new BotCatalogEntry
                {
                    Platform = request.Platform,
                    Username = BotListService.NormalizeUsername(request.Platform, request.Username),
                    DisplayName = request.DisplayName.Trim(),
                    Category = request.Category,
                    Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim()
                };
                _db.BotCatalog.Add(row);
                await _db.SaveChangesAsync();
                _botList.InvalidateCatalog();
                return Ok(new { success = true, id = row.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error agregando un bot al catálogo");
                return StatusCode(500, new { success = false, message = "Error al agregar el bot" });
            }
        }

        /// <summary>PUT /api/botlist/catalog/{id} - Edita un bot del catálogo global</summary>
        [HttpPut("catalog/{id:long}")]
        public async Task<IActionResult> UpdateCatalog(long id, [FromBody] CatalogRequest request)
        {
            if (!await IsOwnerAsync()) return Forbid();
            try
            {
                var row = await _db.BotCatalog.FirstOrDefaultAsync(b => b.Id == id);
                if (row == null) return NotFound(new { success = false, message = "Bot no encontrado" });

                var invalid = await ValidateCatalogAsync(request, id);
                if (invalid != null) return invalid;

                var newUsername = BotListService.NormalizeUsername(request.Platform, request.Username);
                if (row.Platform != request.Platform || row.Username != newUsername)
                {
                    // Los ajustes que los canales hicieron apuntan al usuario viejo: se dejan sin efecto, no se mueven
                    await _db.ChannelBotEntries.Where(r => !r.IsCustom && r.Platform == row.Platform && r.Username == row.Username)
                        .ExecuteDeleteAsync();
                }

                row.Platform = request.Platform;
                row.Username = newUsername;
                row.DisplayName = request.DisplayName.Trim();
                row.Category = request.Category;
                row.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
                row.UpdatedAt = DateTime.Now;
                await _db.SaveChangesAsync();
                _botList.InvalidateCatalog();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error editando un bot del catálogo");
                return StatusCode(500, new { success = false, message = "Error al guardar el bot" });
            }
        }

        /// <summary>DELETE /api/botlist/catalog/{id} - Quita un bot del catálogo global (y los ajustes de los canales sobre él)</summary>
        [HttpDelete("catalog/{id:long}")]
        public async Task<IActionResult> DeleteCatalog(long id)
        {
            if (!await IsOwnerAsync()) return Forbid();
            try
            {
                var row = await _db.BotCatalog.FirstOrDefaultAsync(b => b.Id == id);
                if (row == null) return NotFound(new { success = false, message = "Bot no encontrado" });

                await _db.ChannelBotEntries.Where(r => !r.IsCustom && r.Platform == row.Platform && r.Username == row.Username)
                    .ExecuteDeleteAsync();
                _db.BotCatalog.Remove(row);
                await _db.SaveChangesAsync();
                _botList.InvalidateCatalog();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error quitando un bot del catálogo");
                return StatusCode(500, new { success = false, message = "Error al quitar el bot" });
            }
        }
    }
}
