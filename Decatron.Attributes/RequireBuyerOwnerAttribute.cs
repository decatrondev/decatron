using System.Security.Claims;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Attributes
{
    /// <summary>
    /// Nucleo comun de RequireBuyerOwner y RequireBuyerMember: sesion scope=buyer atada al tenant del Host y rol VIGENTE en tenant_members.
    /// El rol se lee de la base en cada llamada (no del claim), asi que quitar a alguien o suspender el tenant surte efecto al instante.
    /// El tenant lo fija el Host, nunca la URL ni el cuerpo. El rol encontrado queda en HttpContext.Items[BuyerAccess.RoleItem].
    /// </summary>
    public static class BuyerAccess
    {
        public const string RoleItem = "buyer.role";

        public static async Task AuthorizeAsync(AuthorizationFilterContext context, string[] roles, string filterName)
        {
            var http = context.HttpContext;
            var log = http.RequestServices.GetService<ILoggerFactory>()?.CreateLogger(filterName);
            if (http.User.Identity?.IsAuthenticated != true) { context.Result = new UnauthorizedResult(); return; }

            var tenantId = TenantAmbient.Current;
            var scope = http.User.FindFirst(BuyerClaims.Scope)?.Value;
            var tid = BuyerClaims.TenantOf(http.User);
            if (tenantId is null or 1 || !BuyerClaims.IsBuyer(http.User) || tid != tenantId.ToString())
            {
                log?.LogWarning("buyer.denied reason=context tenant={Tenant} scope={Scope} tid={Tid}", tenantId, scope, tid);
                context.Result = new ForbidResult(); return;
            }
            if (!long.TryParse(http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            {
                log?.LogWarning("buyer.denied reason=user_claim");
                context.Result = new ForbidResult(); return;
            }

            var db = http.RequestServices.GetService<DecatronDbContext>();
            if (db == null) { context.Result = new StatusCodeResult(500); return; }
            var role = await db.TenantMembers.Where(m => m.TenantId == tenantId && m.UserId == userId && roles.Contains(m.Role)).Select(m => m.Role).FirstOrDefaultAsync();
            if (role == null)
            {
                log?.LogWarning("buyer.denied reason=not_{Roles} tenant={Tenant} user={User}", string.Join("_or_", roles), tenantId, userId);
                context.Result = new ForbidResult(); return;
            }
            http.Items[RoleItem] = role;
        }
    }

    /// <summary>Plataforma, Fase A (pieza D): solo el comprador que SIGUE siendo owner del tenant del Host. Todo lo que toca credenciales, equipo o 2FA va con este filtro.</summary>
    public class RequireBuyerOwnerAttribute : Attribute, IAsyncAuthorizationFilter
    {
        public Task OnAuthorizationAsync(AuthorizationFilterContext context) => BuyerAccess.AuthorizeAsync(context, new[] { "owner" }, nameof(RequireBuyerOwnerAttribute));
    }

    /// <summary>Equipo del tenant: owner o admin vigente. Solo para lecturas (estado, plan, permisos) y reabrir EventSub; nada que toque credenciales ni el equipo.</summary>
    public class RequireBuyerMemberAttribute : Attribute, IAsyncAuthorizationFilter
    {
        public Task OnAuthorizationAsync(AuthorizationFilterContext context) => BuyerAccess.AuthorizeAsync(context, new[] { "owner", "admin" }, nameof(RequireBuyerMemberAttribute));
    }
}
