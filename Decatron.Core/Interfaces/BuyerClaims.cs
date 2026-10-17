using System.Security.Claims;

namespace Decatron.Core.Interfaces;

/// <summary>
/// Claims de la sesion atada a un tenant (los emiten BuyerSessions y AuthController). El claim se llama "tnt" y NO "tid":
/// JwtBearer convierte "tid" en el claim de Azure AD (.../identity/claims/tenantid) y la comprobacion nunca lo encontraria.
/// </summary>
public static class BuyerClaims
{
    public const string Tenant = "tnt";
    public const string Scope = "scope";
    public const string BuyerScope = "buyer";
    private const string MappedTid = "http://schemas.microsoft.com/identity/claims/tenantid"; // en que se convirtio "tid" (tokens emitidos antes del cambio)
    private static readonly string[] BuyerPaths = { "/api/platform/", "/api/auth/", "/api/brand", "/api/design/tokens", "/uploads/brand/" };

    public static string? TenantOf(ClaimsPrincipal user) => user.FindFirst(Tenant)?.Value ?? user.FindFirst(MappedTid)?.Value;
    public static bool IsBuyer(ClaimsPrincipal user) => user.FindFirst(Scope)?.Value == BuyerScope;
    public static bool PathAllowed(string? path) => path != null && BuyerPaths.Any(x => path.StartsWith(x, StringComparison.OrdinalIgnoreCase) || path.Equals(x.TrimEnd('/'), StringComparison.OrdinalIgnoreCase));
}
