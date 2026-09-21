using Decatron.Core.Models.Tournament;
using Decatron.Data;
using Decatron.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Decatron.Controllers
{
    /// <summary>
    /// Helpers compartidos de tenancy para los controllers de admin del modulo de
    /// Torneos — ver .dev/torneos/09-panel-admin-backend.md #1. Todo controller de
    /// admin nuevo deberia heredar de acá en vez de reimplementar la resolucion de
    /// channelOwnerId, para no repetir el bug de "me olvide de filtrar por tenant" en
    /// alguno nuevo (ver .dev/torneos/13-roles-permisos-multitenant.md #3).
    /// </summary>
    public abstract class TournamentControllerBase : ControllerBase
    {
        protected readonly DecatronDbContext DbContext;
        private readonly IPermissionService _permissionService;

        protected TournamentControllerBase(DecatronDbContext dbContext, IPermissionService permissionService)
        {
            DbContext = dbContext;
            _permissionService = permissionService;
        }

        protected long GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(userIdClaim, out var userId))
                return userId;
            throw new UnauthorizedAccessException("User not found");
        }

        protected long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
                return sessionId;

            var channelOwnerIdClaim = User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
                return channelOwnerId;

            return GetUserId();
        }

        /// <summary>
        /// Dueno real del canal, O alguien con permiso "control_total" delegado sobre
        /// ese canal (mismo sistema que ya usan Settings/ChannelSwitch/etc. —
        /// UserChannelPermissions, ver PermissionService). Antes solo comparaba
        /// GetUserId() == channelOwnerId, lo que dejaba afuera a cualquiera con
        /// control total delegado (bug reportado 24-08-2026: un usuario con
        /// control_total en un canal no podia administrar sus torneos). El sistema
        /// de roles granulares por seccion de torneo (13-roles-permisos-multitenant.md,
        /// "TournamentStaffRole") sigue sin construir — esto solo conecta el nivel
        /// generico que ya existe.
        /// </summary>
        protected async Task<bool> IsChannelAuthorizedAsync(long channelOwnerId)
        {
            var userId = GetUserId();
            return await _permissionService.IsChannelOwnerAsync(userId, channelOwnerId)
                || await _permissionService.HasPermissionLevelAsync(userId, channelOwnerId, "control_total");
        }

        protected async Task<TournamentEdition?> GetOwnedEditionOrNullAsync(long editionId, long channelOwnerId)
        {
            return await DbContext.TournamentEditions
                .FirstOrDefaultAsync(e => e.Id == editionId && e.ChannelOwnerId == channelOwnerId);
        }
    }
}
