using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Decatron.OAuth.Handlers;

namespace Decatron.OAuth.Attributes
{
    /// <summary>
    /// Atributo para requerir autenticación OAuth Bearer.
    /// Usa el esquema OAuthBearer para autenticar la request.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class OAuthAuthorizeAttribute : AuthorizeAttribute
    {
        public OAuthAuthorizeAttribute()
        {
            AuthenticationSchemes = OAuthBearerOptions.SchemeName;
        }
    }

    /// <summary>
    /// Atributo para requerir scopes específicos en endpoints de la API pública.
    ///
    /// Uso:
    /// [RequireScope("read:timer")]
    /// [RequireScope("write:commands", "action:commands")]  // Requiere ambos
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
    public class RequireScopeAttribute : Attribute, IAsyncAuthorizationFilter
    {
        private readonly string[] _requiredScopes;

        /// <summary>
        /// Crea un filtro que requiere los scopes especificados.
        /// Si se proporcionan múltiples scopes, TODOS deben estar presentes.
        /// </summary>
        /// <param name="scopes">Scopes requeridos</param>
        public RequireScopeAttribute(params string[] scopes)
        {
            if (scopes == null || scopes.Length == 0)
            {
                throw new ArgumentException("At least one scope is required", nameof(scopes));
            }
            _requiredScopes = scopes;
        }

        public Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            var user = context.HttpContext.User;

            // Verificar que el usuario está autenticado
            if (!user.Identity?.IsAuthenticated ?? true)
            {
                context.Result = new UnauthorizedResult();
                return Task.CompletedTask;
            }

            // Obtener scopes del token
            var scopesClaim = user.FindFirst("oauth_scopes")?.Value;
            var grantedScopes = scopesClaim?.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                ?? Array.Empty<string>();

            // También verificar claims individuales de scope (por compatibilidad)
            var individualScopes = user.FindAll("scope")
                .Select(c => c.Value)
                .ToArray();

            var allScopes = grantedScopes.Union(individualScopes).ToHashSet();

            // Verificar que todos los scopes requeridos están presentes
            var hasAllScopes = _requiredScopes.All(scope => allScopes.Contains(scope));

            if (!hasAllScopes)
            {
                // Retornar 403 Forbidden con detalle de scopes faltantes
                var missingScopes = _requiredScopes.Where(s => !allScopes.Contains(s));
                context.Result = new ObjectResult(new
                {
                    error = "insufficient_scope",
                    message = "The access token does not have the required scopes",
                    required_scopes = _requiredScopes,
                    missing_scopes = missingScopes.ToArray()
                })
                {
                    StatusCode = 403
                };
                return Task.CompletedTask;
            }

            return Task.CompletedTask;
        }
    }

    /// <summary>
    /// Atributo para requerir AL MENOS UNO de los scopes especificados.
    ///
    /// Uso:
    /// [RequireAnyScope("read:timer", "write:timer")]  // Requiere cualquiera
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
    public class RequireAnyScopeAttribute : Attribute, IAsyncAuthorizationFilter
    {
        private readonly string[] _possibleScopes;

        public RequireAnyScopeAttribute(params string[] scopes)
        {
            if (scopes == null || scopes.Length == 0)
            {
                throw new ArgumentException("At least one scope is required", nameof(scopes));
            }
            _possibleScopes = scopes;
        }

        public Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            var user = context.HttpContext.User;

            if (!user.Identity?.IsAuthenticated ?? true)
            {
                context.Result = new UnauthorizedResult();
                return Task.CompletedTask;
            }

            var scopesClaim = user.FindFirst("oauth_scopes")?.Value;
            var grantedScopes = scopesClaim?.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                ?? Array.Empty<string>();

            var individualScopes = user.FindAll("scope")
                .Select(c => c.Value)
                .ToArray();

            var allScopes = grantedScopes.Union(individualScopes).ToHashSet();

            // Verificar que AL MENOS UNO de los scopes está presente
            var hasAnyScope = _possibleScopes.Any(scope => allScopes.Contains(scope));

            if (!hasAnyScope)
            {
                context.Result = new ObjectResult(new
                {
                    error = "insufficient_scope",
                    message = "The access token requires at least one of the specified scopes",
                    accepted_scopes = _possibleScopes
                })
                {
                    StatusCode = 403
                };
                return Task.CompletedTask;
            }

            return Task.CompletedTask;
        }
    }
}
