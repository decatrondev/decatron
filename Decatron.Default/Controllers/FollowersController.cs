using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Decatron.Core.Models;
using Decatron.Core.Services;
using Decatron.Data;
using Decatron.Core.Helpers;
using Decatron.Services;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Default.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class FollowersController : ControllerBase
    {
        private readonly DecatronDbContext _context;
        private readonly FollowersService _followersService;
        private readonly TwitchApiService _twitchApiService;
        private readonly IPermissionService _permissionService;
        private readonly ILogger<FollowersController> _logger;

        public FollowersController(
            DecatronDbContext context,
            FollowersService followersService,
            TwitchApiService twitchApiService,
            IPermissionService permissionService,
            ILogger<FollowersController> logger)
        {
            _context = context;
            _followersService = followersService;
            _twitchApiService = twitchApiService;
            _permissionService = permissionService;
            _logger = logger;
        }

        // Helper para obtener el canal activo del contexto
        private async Task<(long channelOwnerId, string broadcasterId)?> GetActiveChannelContext()
        {
            try
            {
                long channelOwnerId;

                // PRIORIDAD 1: Obtener canal activo desde la sesión (después de switch)
                var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
                if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                {
                    channelOwnerId = sessionId;
                }
                // PRIORIDAD 2: Usar el claim del JWT si existe
                else
                {
                    var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
                    if (!string.IsNullOrEmpty(channelOwnerIdClaim) && long.TryParse(channelOwnerIdClaim, out var claimId))
                    {
                        channelOwnerId = claimId;
                    }
                    // PRIORIDAD 3: Por defecto, usar el propio canal del usuario
                    else
                    {
                        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                        if (!long.TryParse(userIdClaim, out var userId))
                        {
                            return null;
                        }
                        channelOwnerId = userId;
                    }
                }

                // Obtener el TwitchId (broadcaster_id) del usuario
                var user = await _context.Users
                    .Where(u => u.Id == channelOwnerId && u.IsActive)
                    .Select(u => new { u.TwitchId })
                    .FirstOrDefaultAsync();

                if (user == null)
                {
                    _logger.LogWarning($"No se encontró canal con ID {channelOwnerId}");
                    return null;
                }

                return (channelOwnerId, user.TwitchId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo contexto del canal activo");
                return null;
            }
        }

        // GET: api/followers
        [HttpGet]
        public async Task<ActionResult> GetFollowers(
            [FromQuery] int? isFollowing = null,
            [FromQuery] string? searchName = null,
            [FromQuery] DateTime? followDateFrom = null,
            [FromQuery] DateTime? followDateTo = null,
            [FromQuery] DateTime? createDateFrom = null,
            [FromQuery] DateTime? createDateTo = null,
            [FromQuery] string? orderBy = null,
            [FromQuery] string? orderDirection = "asc",
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, broadcasterId) = channelContext.Value;

                // Obtener userId y verificar permisos
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(userIdClaim, out var userId))
                {
                    return BadRequest(new { message = "No se pudo obtener el ID del usuario." });
                }

                var hasAccess = await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands");
                if (!hasAccess)
                {
                    return Forbid();
                }

                // Obtener todos los followers con filtros
                var followers = await _followersService.GetFollowersAsync(
                    broadcasterId,
                    isFollowing,
                    searchName,
                    followDateFrom,
                    followDateTo,
                    createDateFrom,
                    createDateTo
                );

                _logger.LogInformation($"📊 Obtenidos {followers.Count} followers de la BD para broadcaster {broadcasterId}");
                if (followers.Any())
                {
                    var first = followers.First();
                    _logger.LogDebug($"🔍 Primer follower: Id={first.Id}, UserName={first.UserName}, UserLogin={first.UserLogin}, FollowedAt={first.FollowedAt}");
                }

                // Aplicar ordenamiento
                if (!string.IsNullOrEmpty(orderBy))
                {
                    var isDescending = orderDirection?.ToLower() == "desc";

                    followers = orderBy.ToLower() switch
                    {
                        "username" => isDescending
                            ? followers.OrderByDescending(f => f.UserName).ToList()
                            : followers.OrderBy(f => f.UserName).ToList(),
                        "followedat" => isDescending
                            ? followers.OrderByDescending(f => f.FollowedAt).ToList()
                            : followers.OrderBy(f => f.FollowedAt).ToList(),
                        "isfollowing" => isDescending
                            ? followers.OrderByDescending(f => f.IsFollowing).ToList()
                            : followers.OrderBy(f => f.IsFollowing).ToList(),
                        _ => followers
                    };
                }

                // Obtener estadísticas
                var stats = await _followersService.GetFollowerStatsAsync(broadcasterId);

                // Paginación
                var totalCount = followers.Count;
                var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
                var pagedFollowers = followers
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();

                // Obtener historial para cada follower en la página
                var followersWithHistory = new List<object>();
                foreach (var follower in pagedFollowers)
                {
                    var history = await _followersService.GetFollowerHistoryAsync(broadcasterId, follower.UserId);
                    followersWithHistory.Add(new
                    {
                        follower.Id,
                        follower.UserId,
                        follower.UserName,
                        follower.UserLogin,
                        follower.FollowedAt,
                        follower.AccountCreatedAt,
                        follower.IsFollowing,
                        follower.UnfollowedAt,
                        follower.IsBlocked,
                        follower.WasBlocked,
                        History = history.Select(h => new
                        {
                            h.Action,
                            h.ActionTimestamp
                        }).ToList()
                    });
                }

                return Ok(new
                {
                    success = true,
                    followers = followersWithHistory,
                    stats = new
                    {
                        stats.TotalFollowers,
                        stats.ActiveFollowers,
                        stats.UnfollowedCount,
                        stats.BlockedCount,
                        stats.ReturnedCount
                    },
                    pagination = new
                    {
                        currentPage = page,
                        pageSize,
                        totalPages,
                        totalCount
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener followers");
                return StatusCode(500, new { success = false, message = "Error al obtener seguidores." });
            }
        }

        // GET: api/followers/{userId}/history
        [HttpGet("{userId}/history")]
        public async Task<ActionResult> GetFollowerHistory(string userId)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, broadcasterId) = channelContext.Value;

                // Obtener userId actual y verificar permisos
                var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(currentUserIdClaim, out var currentUserId))
                {
                    return BadRequest(new { message = "No se pudo obtener el ID del usuario." });
                }

                var hasAccess = await _permissionService.CanAccessAsync(currentUserId, channelOwnerId, "commands");
                if (!hasAccess)
                {
                    return Forbid();
                }

                var history = await _followersService.GetFollowerHistoryAsync(broadcasterId, userId);

                return Ok(new
                {
                    success = true,
                    history = history.Select(h => new
                    {
                        h.Action,
                        h.ActionTimestamp
                    }).ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al obtener historial para user {userId}");
                return StatusCode(500, new { success = false, message = "Error al obtener historial." });
            }
        }

        // POST: api/followers/{userId}/block
        [HttpPost("{userId}/block")]
        public async Task<ActionResult> BlockFollower(string userId)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, broadcasterId) = channelContext.Value;

                // Obtener userId actual y verificar permisos de moderación
                var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(currentUserIdClaim, out var currentUserId))
                {
                    return BadRequest(new { message = "No se pudo obtener el ID del usuario." });
                }

                var hasAccess = await _permissionService.HasPermissionLevelAsync(currentUserId, channelOwnerId, "moderation");
                if (!hasAccess)
                {
                    return Forbid();
                }

                // Actualizar estado de bloqueo
                await _followersService.UpdateBlockStatusAsync(broadcasterId, userId, true);

                return Ok(new
                {
                    success = true,
                    message = "Usuario bloqueado correctamente"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al bloquear user {userId}");
                return StatusCode(500, new { success = false, message = "Error al bloquear usuario." });
            }
        }

        // POST: api/followers/{userId}/unblock
        [HttpPost("{userId}/unblock")]
        public async Task<ActionResult> UnblockFollower(string userId)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, broadcasterId) = channelContext.Value;

                // Obtener userId actual y verificar permisos de moderación
                var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(currentUserIdClaim, out var currentUserId))
                {
                    return BadRequest(new { message = "No se pudo obtener el ID del usuario." });
                }

                var hasAccess = await _permissionService.HasPermissionLevelAsync(currentUserId, channelOwnerId, "moderation");
                if (!hasAccess)
                {
                    return Forbid();
                }

                // Actualizar estado de bloqueo
                await _followersService.UpdateBlockStatusAsync(broadcasterId, userId, false);

                return Ok(new
                {
                    success = true,
                    message = "Usuario desbloqueado correctamente"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error al desbloquear user {userId}");
                return StatusCode(500, new { success = false, message = "Error al desbloquear usuario." });
            }
        }

        // GET: api/followers/stats
        [HttpGet("stats")]
        public async Task<ActionResult> GetStats()
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, broadcasterId) = channelContext.Value;

                // Obtener userId y verificar permisos
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(userIdClaim, out var userId))
                {
                    return BadRequest(new { message = "No se pudo obtener el ID del usuario." });
                }

                var hasAccess = await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands");
                if (!hasAccess)
                {
                    return Forbid();
                }

                var stats = await _followersService.GetFollowerStatsAsync(broadcasterId);

                return Ok(new
                {
                    success = true,
                    stats
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener estadísticas");
                return StatusCode(500, new { success = false, message = "Error al obtener estadísticas." });
            }
        }

        // POST: api/followers/sync
        [HttpPost("sync")]
        public async Task<ActionResult> SyncFollowers()
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                {
                    return BadRequest(new { message = "No se pudo obtener el canal activo." });
                }

                var (channelOwnerId, broadcasterId) = channelContext.Value;

                // Obtener userId y verificar permisos
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(userIdClaim, out var userId))
                {
                    return BadRequest(new { message = "No se pudo obtener el ID del usuario." });
                }

                var hasAccess = await _permissionService.CanAccessAsync(userId, channelOwnerId, "commands");
                if (!hasAccess)
                {
                    return Forbid();
                }

                _logger.LogInformation($"🔄 Iniciando sincronización de followers para broadcaster {broadcasterId}");

                // 1. Obtener followers de Twitch API
                _logger.LogInformation($"📡 Llamando a Twitch API para obtener followers del broadcaster {broadcasterId}");
                var twitchFollowers = await _twitchApiService.GetChannelFollowersAsync(broadcasterId);

                if (twitchFollowers == null || !twitchFollowers.Any())
                {
                    _logger.LogWarning($"⚠️ No se obtuvieron followers de Twitch API para broadcaster {broadcasterId}");
                    return Ok(new
                    {
                        success = true,
                        message = "No se encontraron followers en Twitch",
                        stats = new
                        {
                            processed = 0,
                            newFollowers = 0,
                            returned = 0,
                            unfollowed = 0
                        }
                    });
                }

                _logger.LogInformation($"✅ Obtenidos {twitchFollowers.Count} followers de Twitch API");

                // Obtener el broadcaster name
                var user = await _context.Users.FirstOrDefaultAsync(u => u.TwitchId == broadcasterId);
                var broadcasterName = user?.DisplayName ?? "Unknown";

                // 2. Crear un HashSet de user_ids de Twitch para búsqueda rápida
                var twitchUserIds = new HashSet<string>(twitchFollowers.Select(f => f.user_id));

                int newFollowers = 0;
                int returnedFollowers = 0;
                int unfollowedCount = 0;

                // 3. Procesar cada follower de Twitch
                foreach (var twitchFollower in twitchFollowers)
                {
                    // Buscar si existe en BD
                    var existing = await _context.ChannelFollowers
                        .FirstOrDefaultAsync(f => f.BroadcasterId == broadcasterId && f.UserId == twitchFollower.user_id);

                    if (existing == null)
                    {
                        // NUEVO SEGUIDOR
                        var followedAtParsed = DateTime.Parse(twitchFollower.followed_at);
                        _logger.LogDebug($"📅 Nuevo follower {twitchFollower.user_name}: followed_at (Twitch)='{twitchFollower.followed_at}' → parsed={followedAtParsed}");

                        var newFollower = new ChannelFollower
                        {
                            BroadcasterId = broadcasterId,
                            BroadcasterName = broadcasterName,
                            UserId = twitchFollower.user_id,
                            UserName = twitchFollower.user_name,
                            UserLogin = twitchFollower.user_login,
                            FollowedAt = followedAtParsed,
                            IsFollowing = 0, // activo
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };

                        await _followersService.UpsertFollowerAsync(newFollower);
                        await _followersService.AddHistoryEntryAsync(broadcasterId, twitchFollower.user_id, 0, followedAtParsed); // Action 0 = Follow con fecha real
                        newFollowers++;
                    }
                    else if (existing.IsFollowing == 1)
                    {
                        // RETORNADO (estaba unfollowed, ahora volvió)
                        existing.IsFollowing = 0;
                        existing.UpdatedAt = DateTime.UtcNow;
                        await _followersService.UpsertFollowerAsync(existing);
                        await _followersService.AddHistoryEntryAsync(broadcasterId, twitchFollower.user_id, 0); // Action 0 = Follow (usa DateTime.UtcNow porque es re-follow)
                        returnedFollowers++;
                    }
                    // Si IsFollowing == 0, no hacer nada (ya está activo)
                }

                // 4. Detectar unfollows (están en BD como activos pero NO están en Twitch)
                var dbActiveFollowers = await _context.ChannelFollowers
                    .Where(f => f.BroadcasterId == broadcasterId && f.IsFollowing == 0)
                    .ToListAsync();

                foreach (var dbFollower in dbActiveFollowers)
                {
                    if (!twitchUserIds.Contains(dbFollower.UserId))
                    {
                        // HIZO UNFOLLOW
                        dbFollower.IsFollowing = 1;
                        dbFollower.UnfollowedAt = DateTime.UtcNow;
                        dbFollower.UpdatedAt = DateTime.UtcNow;
                        await _followersService.UpsertFollowerAsync(dbFollower);
                        await _followersService.AddHistoryEntryAsync(broadcasterId, dbFollower.UserId, 1); // Action 1 = Unfollow
                        unfollowedCount++;
                    }
                }

                _logger.LogInformation($"✅ Sincronización completada: {newFollowers} nuevos, {returnedFollowers} retornados, {unfollowedCount} unfollowed");

                // Obtener estadísticas actualizadas
                var stats = await _followersService.GetFollowerStatsAsync(broadcasterId);

                return Ok(new
                {
                    success = true,
                    message = "Sincronización completada exitosamente",
                    stats = new
                    {
                        processed = twitchFollowers.Count,
                        newFollowers,
                        returned = returnedFollowers,
                        unfollowed = unfollowedCount,
                        current = stats
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al sincronizar followers");
                return StatusCode(500, new { success = false, message = "Error al sincronizar seguidores" });
            }
        }
    }
}
