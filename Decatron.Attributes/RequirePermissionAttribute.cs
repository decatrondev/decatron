using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;
using Decatron.Services;

namespace Decatron.Attributes
{
    /// <summary>
    /// Attribute para verificar permisos específicos antes de ejecutar una acción
    /// </summary>
    public class RequirePermissionAttribute : Attribute, IAsyncAuthorizationFilter
    {
        private readonly string _section;
        private readonly string? _specificLevel;

        public RequirePermissionAttribute(string section, string? specificLevel = null)
        {
            _section = section;
            _specificLevel = specificLevel;
        }

        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            // Verificar si el usuario está autenticado
            if (!context.HttpContext.User.Identity?.IsAuthenticated ?? true)
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            // Obtener servicios
            var permissionService = context.HttpContext.RequestServices.GetService<IPermissionService>();
            if (permissionService == null)
            {
                context.Result = new StatusCodeResult(500);
                return;
            }

            try
            {
                // Obtener información del usuario
                var userIdClaim = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var channelOwnerIdClaim = context.HttpContext.User.FindFirst("ChannelOwnerId")?.Value;

                if (!long.TryParse(userIdClaim, out var userId))
                {
                    context.Result = new UnauthorizedResult();
                    return;
                }

                // Si no hay channelOwnerId en claims, asumir que es el propio canal
                long channelOwnerId = userId;
                if (!string.IsNullOrEmpty(channelOwnerIdClaim) && long.TryParse(channelOwnerIdClaim, out var parsedChannelOwnerId))
                {
                    channelOwnerId = parsedChannelOwnerId;
                }

                // Verificar permisos
                bool hasAccess;
                if (!string.IsNullOrEmpty(_specificLevel))
                {
                    hasAccess = await permissionService.HasPermissionLevelAsync(userId, channelOwnerId, _specificLevel);
                }
                else
                {
                    hasAccess = await permissionService.CanAccessAsync(userId, channelOwnerId, _section);
                }

                if (!hasAccess)
                {
                    context.Result = new ForbidResult();
                    return;
                }
            }
            catch (Exception)
            {
                context.Result = new StatusCodeResult(500);
                return;
            }
        }
    }
}