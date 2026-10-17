using System.Security.Claims;
using Decatron.Core.Interfaces;
using Decatron.Core.Settings;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;

namespace Decatron.Attributes
{
    /// <summary>
    /// Plataforma, Fase A (pieza F): las acciones que guardan, cambian o quitan credenciales exigen haber verificado el 2FA hace menos de 10 minutos
    /// (encabezado X-Step-Up). Si el comprador no activo el 2FA (es opcional por ahora) la accion pasa. Va junto a RequireBuyerOwner, que ya validó la sesion.
    /// </summary>
    public class RequireStepUpAttribute : Attribute, IAsyncAuthorizationFilter
    {
        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            var http = context.HttpContext;
            var tenantId = TenantAmbient.Current;
            if (tenantId is null or 1 || !long.TryParse(http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId)) return; // lo rechaza RequireBuyerOwner

            var mfa = http.RequestServices.GetRequiredService<BuyerMfa>();
            var enabledAt = await mfa.EnabledAtAsync(tenantId.Value, userId);
            if (enabledAt is null) return;

            var secret = http.RequestServices.GetRequiredService<IOptions<JwtSettings>>().Value.SecretKey;
            if (BuyerStepUp.Validate(http.Request.Headers[BuyerStepUp.Header].ToString(), tenantId.Value, userId, enabledAt.Value, secret)) return;
            context.Result = new ObjectResult(new { success = false, code = "step_up_required" }) { StatusCode = 403 };
        }
    }
}
