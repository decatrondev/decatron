using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Attributes
{
    /// <summary>
    /// Attribute que verifica que el usuario autenticado sea un system owner (admin).
    /// Se aplica a nivel de controlador o acción para proteger endpoints de administración.
    /// </summary>
    public class RequireSystemOwnerAttribute : Attribute, IAsyncAuthorizationFilter
    {
        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            if (!context.HttpContext.User.Identity?.IsAuthenticated ?? true)
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            var dbContext = context.HttpContext.RequestServices.GetService<DecatronDbContext>();
            if (dbContext == null)
            {
                context.Result = new StatusCodeResult(500);
                return;
            }

            var username = context.HttpContext.User.FindFirst("login")?.Value
                ?? context.HttpContext.User.FindFirst(ClaimTypes.Name)?.Value;

            if (string.IsNullOrEmpty(username))
            {
                context.Result = new ForbidResult();
                return;
            }

            var isOwner = await dbContext.SystemAdmins
                .AnyAsync(a => a.Username.ToLower() == username.ToLower() && a.Role == "owner");

            if (!isOwner)
            {
                context.Result = new ForbidResult();
            }
        }
    }
}
