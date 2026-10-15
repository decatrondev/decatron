using System.Collections.Concurrent;
using System.Security.Claims;
using Decatron.Core.Interfaces;

namespace Decatron.Middleware
{
    /// <summary>
    /// Fase 2 de la plataforma: calcula el tenant de cada request y lo deja en ITenantContext.
    /// Bandera Platform:TenantContext:Mode = off (por defecto, no hace nada) | shadow (calcula y registra ambigüedades).
    /// Nunca bloquea ni cambia la respuesta: ante cualquier error sigue con el request.
    /// </summary>
    public class TenantMiddleware
    {
        private static readonly ConcurrentDictionary<string, DateTime> _seen = new();
        private readonly RequestDelegate _next;
        private readonly IConfiguration _config;
        private readonly ILogger<TenantMiddleware> _log;

        public TenantMiddleware(RequestDelegate next, IConfiguration config, ILogger<TenantMiddleware> log)
        {
            _next = next;
            _config = config;
            _log = log;
        }

        public async Task InvokeAsync(HttpContext context, ITenantContext tenant, ITenantResolver resolver)
        {
            try
            {
                var mode = _config["Platform:TenantContext:Mode"];
                if (string.Equals(mode, "shadow", StringComparison.OrdinalIgnoreCase))
                {
                    var res = Resolve(context, resolver);
                    tenant.Set(res);
                    // Un usuario autenticado cuyo tenant no se pudo resolver es una ambigüedad; los anónimos no.
                    if (!res.Resolved && context.User.Identity?.IsAuthenticated == true)
                        LogOnce($"user:{context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value}", context.Request.Path);
                }
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "tenant.middleware_error");
            }
            await _next(context);
        }

        private static TenantResolution Resolve(HttpContext context, ITenantResolver resolver)
        {
            var claim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(claim, out var userId))
            {
                var byUser = resolver.ByUserId(userId);
                if (byUser.Resolved) return byUser;
            }
            return resolver.ByHost(context.Request.Host.Host);
        }

        // Un aviso por clave cada hora, para que Grafana no se llene.
        private void LogOnce(string key, PathString path)
        {
            var now = DateTime.UtcNow;
            if (_seen.TryGetValue(key, out var last) && now - last < TimeSpan.FromHours(1)) return;
            _seen[key] = now;
            _log.LogWarning("tenant.ambiguous key={Key} path={Path} fallback=1", key, path.Value);
        }
    }

    public static class TenantMiddlewareExtensions
    {
        public static IApplicationBuilder UseTenantContext(this IApplicationBuilder builder)
            => builder.UseMiddleware<TenantMiddleware>();
    }
}
