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
    [Decatron.Core.Interfaces.RequiresModule("module.followers")]
    public class FollowersController : ControllerBase
    {
        private readonly DecatronDbContext _context;
        private readonly FollowersService _followersService;
        private readonly FollowersSyncService _followersSyncService;
        private readonly Decatron.Services.Accounts.AccountChannelResolver _accounts;
        private readonly TwitchApiService _twitchApiService;
        private readonly IPermissionService _permissionService;
        private readonly ILogger<FollowersController> _logger;

        public FollowersController(
            DecatronDbContext context,
            FollowersService followersService,
            FollowersSyncService followersSyncService,
            Decatron.Services.Accounts.AccountChannelResolver accounts,
            TwitchApiService twitchApiService,
            IPermissionService permissionService,
            ILogger<FollowersController> logger)
        {
            _context = context;
            _followersService = followersService;
            _followersSyncService = followersSyncService;
            _accounts = accounts;
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

        /// <summary>Un canal de la cuenta donde se buscan seguidores: plataforma + id del canal en esa plataforma.</summary>
        private record FollowerTarget(string Platform, string BroadcasterId);

        /// <summary>
        /// Canales de la cuenta del dueño (Twitch y/o Kick) según el filtro: «twitch», «kick» o «all».
        /// Sin filtro, el canal de Twitch si la cuenta lo tiene y si no el de Kick (el comportamiento de siempre para quien tiene Twitch).
        /// </summary>
        private async Task<(List<FollowerTarget> Targets, bool HasTwitch, bool HasKick)> ResolveTargetsAsync(long channelOwnerId, string? platform)
        {
            var account = await _accounts.ResolveByUserIdAsync(channelOwnerId);
            var twitchId = account?.TwitchId;
            var kickId = account?.KickId;

            var wanted = platform?.Trim().ToLowerInvariant();
            var targets = new List<FollowerTarget>();
            if (wanted is "all" or "twitch" || (wanted != "kick" && !string.IsNullOrEmpty(twitchId)))
                if (!string.IsNullOrEmpty(twitchId)) targets.Add(new(FollowerPlatforms.Twitch, twitchId));
            if (wanted is "all" or "kick" || (wanted != "twitch" && string.IsNullOrEmpty(twitchId)))
                if (!string.IsNullOrEmpty(kickId)) targets.Add(new(FollowerPlatforms.Kick, kickId));
            return (targets, !string.IsNullOrEmpty(twitchId), !string.IsNullOrEmpty(kickId));
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
            [FromQuery] int pageSize = 20,
            [FromQuery] string? platform = null)
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

                // Canales de la cuenta (Twitch y/o Kick) según el filtro de plataforma
                var (targets, hasTwitch, hasKick) = await ResolveTargetsAsync(channelOwnerId, platform);

                // Obtener todos los followers con filtros
                var followers = new List<ChannelFollower>();
                foreach (var target in targets)
                {
                    followers.AddRange(await _followersService.GetFollowersAsync(
                        target.BroadcasterId,
                        isFollowing,
                        searchName,
                        followDateFrom,
                        followDateTo,
                        createDateFrom,
                        createDateTo,
                        target.Platform
                    ));
                }
                followers = followers.OrderByDescending(f => f.FollowedAt).ToList();
                var broadcasterByPlatform = targets.ToDictionary(t => t.Platform, t => t.BroadcasterId);

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

                // Obtener estadísticas (suma de las plataformas elegidas)
                var stats = new FollowerStats();
                foreach (var target in targets)
                {
                    var st = await _followersService.GetFollowerStatsAsync(target.BroadcasterId, target.Platform);
                    stats.TotalFollowers += st.TotalFollowers;
                    stats.ActiveFollowers += st.ActiveFollowers;
                    stats.UnfollowedCount += st.UnfollowedCount;
                    stats.BlockedCount += st.BlockedCount;
                    stats.ReturnedCount += st.ReturnedCount;
                }

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
                    var history = await _followersService.GetFollowerHistoryAsync(broadcasterByPlatform[follower.Platform], follower.UserId, follower.Platform);
                    followersWithHistory.Add(new
                    {
                        follower.Id,
                        follower.UserId,
                        follower.Platform,
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
                    availablePlatforms = new { twitch = hasTwitch, kick = hasKick },
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
        public async Task<ActionResult> GetFollowerHistory(string userId, [FromQuery] string? platform = null)
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

                var (histTargets, _, _) = await ResolveTargetsAsync(channelOwnerId, platform);
                var histTarget = histTargets.FirstOrDefault();
                if (histTarget == null) return Ok(new { success = true, history = Array.Empty<object>() });
                var history = await _followersService.GetFollowerHistoryAsync(histTarget.BroadcasterId, userId, histTarget.Platform);

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
        public async Task<ActionResult> BlockFollower(string userId, [FromQuery] string? platform = null)
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
                var (blockTargets, _, _) = await ResolveTargetsAsync(channelOwnerId, platform);
                var blockTarget = blockTargets.FirstOrDefault();
                if (blockTarget == null) return BadRequest(new { message = "No se pudo obtener el canal de esa plataforma." });
                await _followersService.UpdateBlockStatusAsync(blockTarget.BroadcasterId, userId, true, blockTarget.Platform);

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
        public async Task<ActionResult> UnblockFollower(string userId, [FromQuery] string? platform = null)
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
                var (unblockTargets, _, _) = await ResolveTargetsAsync(channelOwnerId, platform);
                var unblockTarget = unblockTargets.FirstOrDefault();
                if (unblockTarget == null) return BadRequest(new { message = "No se pudo obtener el canal de esa plataforma." });
                await _followersService.UpdateBlockStatusAsync(unblockTarget.BroadcasterId, userId, false, unblockTarget.Platform);

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
        public async Task<ActionResult> GetStats([FromQuery] string? platform = null)
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

                var (statTargets, _, _) = await ResolveTargetsAsync(channelOwnerId, platform);
                var stats = new FollowerStats();
                foreach (var target in statTargets)
                {
                    var st = await _followersService.GetFollowerStatsAsync(target.BroadcasterId, target.Platform);
                    stats.TotalFollowers += st.TotalFollowers;
                    stats.ActiveFollowers += st.ActiveFollowers;
                    stats.UnfollowedCount += st.UnfollowedCount;
                    stats.BlockedCount += st.BlockedCount;
                    stats.ReturnedCount += st.ReturnedCount;
                }

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

        // GET: api/followers/lookup?query=
        // Ayuda cuando alguien «no aparece»: lo busca por nombre actual, nombre viejo (chat) o id,
        // pregunta a Twitch en directo si lo sigue hoy y junta lo que Decatron sabe de esa persona.
        [HttpGet("lookup")]
        public async Task<ActionResult> LookupFollower([FromQuery] string? query)
        {
            try
            {
                var channelContext = await GetActiveChannelContext();
                if (!channelContext.HasValue)
                    return BadRequest(new { message = "No se pudo obtener el canal activo." });
                var (channelOwnerId, broadcasterId) = channelContext.Value;

                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!long.TryParse(userIdClaim, out var currentUserId))
                    return BadRequest(new { message = "No se pudo obtener el ID del usuario." });
                if (!await _permissionService.CanAccessAsync(currentUserId, channelOwnerId, "commands"))
                    return Forbid();

                var twitchTarget = (await ResolveTargetsAsync(channelOwnerId, "twitch")).Targets.FirstOrDefault(t => t.Platform == FollowerPlatforms.Twitch);
                if (twitchTarget == null)
                    return Ok(new { found = false, noTwitch = true });
                broadcasterId = twitchTarget.BroadcasterId;

                var q = (query ?? "").Trim().TrimStart('@').ToLowerInvariant();
                if (q.Length < 2 || q.Length > 100)
                    return BadRequest(new { message = "Escribe al menos 2 caracteres." });

                var channelLogin = (await _context.Users.Where(u => u.Id == channelOwnerId).Select(u => u.Login).FirstOrDefaultAsync() ?? "").ToLowerInvariant();

                // 1. Resolver a un id de Twitch: id numérico, fila guardada, chat de este canal (sirve con nombres viejos) o Twitch.
                string? userId = null;
                string resolvedBy = "";
                if (q.All(char.IsDigit)) { userId = q; resolvedBy = "id"; }
                if (userId == null)
                {
                    userId = await _context.ChannelFollowers
                        .Where(f => f.BroadcasterId == broadcasterId && f.Platform == FollowerPlatforms.Twitch && (f.UserLogin.ToLower() == q || f.UserName.ToLower() == q))
                        .Select(f => f.UserId).FirstOrDefaultAsync();
                    if (userId != null) resolvedBy = "database";
                }
                if (userId == null && channelLogin != "")
                {
                    userId = await _context.ChatMessages
                        .Where(m => m.Channel == channelLogin && m.Username == q && m.UserId != null && m.UserId != "")
                        .OrderByDescending(m => m.Timestamp).Select(m => m.UserId).FirstOrDefaultAsync();
                    if (userId != null) resolvedBy = "chat";
                }
                if (userId == null)
                {
                    var tw = await _twitchApiService.GetUserByLoginAsync(q);
                    if (tw != null) { userId = tw.id; resolvedBy = "twitch"; }
                }
                if (userId == null)
                    return Ok(new { found = false });

                // 2. Lo que Decatron tiene guardado de esa persona en este canal
                var row = await _context.ChannelFollowers
                    .Where(f => f.BroadcasterId == broadcasterId && f.Platform == FollowerPlatforms.Twitch && f.UserId == userId)
                    .Select(f => new { f.UserName, f.UserLogin, f.FollowedAt, f.IsFollowing, f.UnfollowedAt })
                    .FirstOrDefaultAsync();

                // 3. Twitch en directo: ¿lo sigue hoy?
                var check = await _twitchApiService.CheckUserFollowsChannelAsync(broadcasterId, userId);

                // 4. Evidencia del chat de este canal (solo estimación; no es la fecha del follow)
                object? chat = null;
                List<string> namesSeen = new();
                if (channelLogin != "")
                {
                    var msgs = _context.ChatMessages.Where(m => m.Channel == channelLogin && m.UserId == userId);
                    var count = await msgs.CountAsync();
                    if (count > 0)
                    {
                        chat = new
                        {
                            count,
                            first = await msgs.MinAsync(m => m.Timestamp),
                            last = await msgs.MaxAsync(m => m.Timestamp)
                        };
                        namesSeen = await msgs.Select(m => m.Username).Distinct().Take(10).ToListAsync();
                    }
                }

                return Ok(new
                {
                    found = true,
                    userId,
                    resolvedBy,
                    namesSeen,
                    saved = row,
                    twitch = new { follows = check.Follows, followedAt = check.FollowedAt, failure = check.Failure },
                    chat
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en lookup de seguidor");
                return StatusCode(500, new { message = "Error al buscar el seguidor" });
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

                var twitchTarget = (await ResolveTargetsAsync(channelOwnerId, "twitch")).Targets.FirstOrDefault(t => t.Platform == FollowerPlatforms.Twitch);
                if (twitchTarget == null)
                    return Ok(new { success = false, message = "Este canal no tiene una cuenta de Twitch vinculada.", warning = new { code = "no_twitch" } });
                broadcasterId = twitchTarget.BroadcasterId;

                var r = await _followersSyncService.SyncAsync(broadcasterId);

                if (!r.Success)
                {
                    return Ok(new
                    {
                        success = false,
                        message = "No se pudo leer la lista de seguidores de Twitch. No se cambió nada.",
                        warning = new { code = "fetch_failed", detail = r.FetchFailure },
                        stats = new { processed = 0, newFollowers = 0, returned = 0, unfollowed = 0, renamed = 0 }
                    });
                }

                object? warning = r.UnfollowSkipped == Decatron.Core.Helpers.SyncUnfollowSkipReason.None ? null : new
                {
                    code = r.UnfollowSkipped.ToString(),
                    missing = r.Missing,
                    received = r.Received,
                    twitchTotal = r.TwitchTotal
                };

                return Ok(new
                {
                    success = true,
                    message = "Sincronización completada exitosamente",
                    stats = new
                    {
                        processed = r.Processed,
                        newFollowers = r.NewFollowers,
                        returned = r.Returned,
                        unfollowed = r.Unfollowed,
                        renamed = r.Renamed,
                        current = r.Current
                    },
                    warning
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
