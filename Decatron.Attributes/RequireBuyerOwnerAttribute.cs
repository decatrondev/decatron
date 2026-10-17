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
    /// Plataforma, Fase A (pieza D): solo el comprador (sesion scope=buyer atada al tenant del Host) que SIGUE siendo owner de ese tenant.
    /// La membresia se lee de la base en cada llamada (no del claim), asi que quitar a alguien o suspender el tenant surte efecto al instante.
    /// El tenant lo fija el Host, nunca la URL ni el cuerpo.
    /// </summary>
    public class RequireBuyerOwnerAttribute : Attribute, IAsyncAuthorizationFilter
    {
        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            var http = context.HttpContext;
            var log = http.RequestServices.GetService<ILoggerFactory>()?.CreateLogger<RequireBuyerOwnerAttribute>();
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
            var ok = await db.TenantMembers.AnyAsync(m => m.TenantId == tenantId && m.UserId == userId && m.Role == "owner");
            if (!ok)
            {
                log?.LogWarning("buyer.denied reason=not_owner tenant={Tenant} user={User}", tenantId, userId);
                context.Result = new ForbidResult();
            }
        }
    }
}
