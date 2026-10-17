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
            IDisposable? ambient = null;
            try
            {
                var mode = _config[TenantMode.ConfigKey];
                if (TenantMode.IsOn(mode))
                {
                    var res = Resolve(context, resolver);
                    tenant.Set(res);
                    // Fase 5.8: los servicios singleton (IA, voz, llaves propias) leen el tenant de TenantAmbient; sin esto, lo que se dispara desde
                    // un request de otro tenant correria como el #1. DecatronDbContext ya prefiere el ambiente, y es el mismo valor.
                    if (res.Resolved) ambient = TenantAmbient.Push(res.TenantId);
                    // Un usuario autenticado cuyo tenant no se pudo resolver es una ambigüedad; los anónimos no.
                    if (!res.Resolved && context.User.Identity?.IsAuthenticated == true)
                        LogOnce($"user:{context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value}", context.Request.Path);
                }
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "tenant.middleware_error");
            }
            try { await _next(context); }
            finally { ambient?.Dispose(); }
        }

        private static TenantResolution Resolve(HttpContext context, ITenantResolver resolver)
        {
            // Fase 8: en slug.decatron.top manda el Host (una sesion de otro tenant no cambia el tenant de ese subdominio)
            var byHost = resolver.ByHost(context.Request.Host.Host);
            if (byHost.Resolved) return byHost;
            var claim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (long.TryParse(claim, out var userId))
            {
                var byUser = resolver.ByUserId(userId);
                if (byUser.Resolved) return byUser;
            }
            return byHost;
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
