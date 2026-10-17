using System.Security.Claims;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

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
            if (http.User.Identity?.IsAuthenticated != true) { context.Result = new UnauthorizedResult(); return; }

            var tenantId = TenantAmbient.Current;
            var scope = http.User.FindFirst("scope")?.Value;
            var tid = http.User.FindFirst("tid")?.Value;
            if (tenantId is null or 1 || scope != "buyer" || tid != tenantId.ToString()) { context.Result = new ForbidResult(); return; }
            if (!long.TryParse(http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId)) { context.Result = new ForbidResult(); return; }

            var db = http.RequestServices.GetService<DecatronDbContext>();
            if (db == null) { context.Result = new StatusCodeResult(500); return; }
            var ok = await db.TenantMembers.AnyAsync(m => m.TenantId == tenantId && m.UserId == userId && m.Role == "owner");
            if (!ok) context.Result = new ForbidResult();
        }
    }
}
