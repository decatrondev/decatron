using System.Security.Claims;

namespace Decatron.Middleware
{
    /// <summary>
    /// Middleware que añade el claim ChannelOwnerId basado en el contexto activo almacenado en sesión
    /// Esto permite que el sistema existente de permisos funcione sin cambios
    /// </summary>
    public class ChannelAccessMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ChannelAccessMiddleware> _logger;

        public ChannelAccessMiddleware(RequestDelegate next, ILogger<ChannelAccessMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                // Solo procesar si el usuario está autenticado
                if (context.User.Identity?.IsAuthenticated == true)
                {
                    var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                    if (long.TryParse(userIdClaim, out var userId))
                    {
                        // Obtener el canal activo desde la sesión
                        var activeChannelId = context.Session.GetString("ActiveChannelId");

                        // Si no hay contexto activo, usar su propio canal como default
                        var channelOwnerId = userId; // Default

                        if (!string.IsNullOrEmpty(activeChannelId) && long.TryParse(activeChannelId, out var parsedChannelId))
                        {
                            channelOwnerId = parsedChannelId;
                        }

                        // Añadir claim ChannelOwnerId a la identidad del usuario
                        // Esto hace que el sistema existente funcione sin cambios
                        var identity = context.User.Identity as ClaimsIdentity;
                        if (identity != null)
                        {
                            // Remover claim existente si lo hay
                            var existingClaim = identity.FindFirst("ChannelOwnerId");
                            if (existingClaim != null)
                            {
                                identity.RemoveClaim(existingClaim);
                            }

                            // Añadir nuevo claim
                            identity.AddClaim(new Claim("ChannelOwnerId", channelOwnerId.ToString()));

                            // Log para debugging
                            if (channelOwnerId != userId)
                            {
                                _logger.LogInformation($"User {userId} is managing channel {channelOwnerId}");
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in ChannelAccessMiddleware");
                // No bloquear la request si hay errores, continuar sin modificaciones
            }

            await _next(context);
        }
    }

    /// <summary>
    /// Extension method para registrar el middleware fácilmente
    /// </summary>
    public static class ChannelAccessMiddlewareExtensions
    {
        public static IApplicationBuilder UseChannelAccess(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<ChannelAccessMiddleware>();
        }
    }
}