using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Decatron.Core.Interfaces;
using Decatron.OAuth.Scopes;

namespace Decatron.Controllers
{
    /// <summary>
    /// Controlador para el Developer Portal.
    /// Permite a los usuarios gestionar sus aplicaciones OAuth.
    /// </summary>
    [ApiController]
    [Route("api/developer")]
    [Authorize] // Requiere sesión de usuario
    public class DeveloperController : ControllerBase
    {
        private readonly IOAuthService _oauthService;
        private readonly ILogger<DeveloperController> _logger;

        public DeveloperController(IOAuthService oauthService, ILogger<DeveloperController> logger)
        {
            _oauthService = oauthService;
            _logger = logger;
        }

        // ═══════════════════════════════════════════════════════════════════
        // GET /api/developer/apps
        // Lista las aplicaciones del usuario
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Lista todas las aplicaciones OAuth del usuario actual.
        /// </summary>
        [HttpGet("apps")]
        public async Task<IActionResult> GetApplications()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var apps = await _oauthService.GetUserApplicationsAsync(userId.Value);

            return Ok(new
            {
                success = true,
                apps = apps.Select(a => new
                {
                    id = a.Id,
                    name = a.Name,
                    description = a.Description,
                    client_id = a.ClientId,
                    icon_url = a.IconUrl,
                    website_url = a.WebsiteUrl,
                    redirect_uris = a.RedirectUris,
                    scopes = a.Scopes,
                    is_active = a.IsActive,
                    is_verified = a.IsVerified,
                    created_at = a.CreatedAt,
                    updated_at = a.UpdatedAt
                })
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // GET /api/developer/apps/{id}
        // Obtiene detalles de una aplicación
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Obtiene los detalles de una aplicación específica.
        /// </summary>
        [HttpGet("apps/{id:guid}")]
        public async Task<IActionResult> GetApplication(Guid id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var app = await _oauthService.GetApplicationAsync(id);

            if (app == null || app.OwnerId != userId)
            {
                return NotFound(new { success = false, error = "Application not found" });
            }

            // Obtener estadísticas
            var stats = await _oauthService.GetAppStatsAsync(id);

            return Ok(new
            {
                success = true,
                app = new
                {
                    id = app.Id,
                    name = app.Name,
                    description = app.Description,
                    client_id = app.ClientId,
                    // No incluir el secret hash
                    icon_url = app.IconUrl,
                    website_url = app.WebsiteUrl,
                    redirect_uris = app.RedirectUris,
                    scopes = app.Scopes,
                    is_active = app.IsActive,
                    is_verified = app.IsVerified,
                    created_at = app.CreatedAt,
                    updated_at = app.UpdatedAt
                },
                stats = stats != null ? new
                {
                    unique_users = stats.UniqueUsers,
                    total_tokens = stats.TotalTokens,
                    active_tokens = stats.ActiveTokens,
                    last_token_at = stats.LastTokenAt
                } : null
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // POST /api/developer/apps
        // Crea una nueva aplicación
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Crea una nueva aplicación OAuth.
        /// Retorna el client_secret en texto plano (única vez que se muestra).
        /// </summary>
        [HttpPost("apps")]
        public async Task<IActionResult> CreateApplication([FromBody] CreateAppDto request)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            // Validaciones
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { success = false, error = "Name is required" });
            }

            if (request.RedirectUris == null || request.RedirectUris.Length == 0)
            {
                return BadRequest(new { success = false, error = "At least one redirect URI is required" });
            }

            if (request.Scopes == null || request.Scopes.Length == 0)
            {
                return BadRequest(new { success = false, error = "At least one scope is required" });
            }

            // Validar URIs
            foreach (var uri in request.RedirectUris)
            {
                if (!Uri.TryCreate(uri, UriKind.Absolute, out var parsedUri))
                {
                    return BadRequest(new { success = false, error = $"Invalid redirect URI: {uri}" });
                }

                // En producción, requerir HTTPS (excepto localhost)
                if (parsedUri.Scheme != "https" && parsedUri.Host != "localhost" && parsedUri.Host != "127.0.0.1")
                {
                    return BadRequest(new { success = false, error = $"Redirect URI must use HTTPS: {uri}" });
                }
            }

            // Validar scopes
            var invalidScopes = request.Scopes.Where(s => !DecatronScopes.IsValid(s)).ToArray();
            if (invalidScopes.Length > 0)
            {
                return BadRequest(new { success = false, error = $"Invalid scopes: {string.Join(", ", invalidScopes)}" });
            }

            try
            {
                var result = await _oauthService.CreateApplicationAsync(
                    userId.Value,
                    new CreateOAuthAppRequest(
                        request.Name,
                        request.Description,
                        request.RedirectUris,
                        request.Scopes,
                        request.IconUrl,
                        request.WebsiteUrl
                    )
                );

                _logger.LogInformation("OAuth app created: {AppId} by user {UserId}", result.Application.Id, userId);

                return Ok(new
                {
                    success = true,
                    app = new
                    {
                        id = result.Application.Id,
                        name = result.Application.Name,
                        client_id = result.Application.ClientId,
                        // Solo se muestra al crear
                        client_secret = result.ClientSecret,
                        redirect_uris = result.Application.RedirectUris,
                        scopes = result.Application.Scopes,
                        created_at = result.Application.CreatedAt
                    },
                    message = "Application created. Save the client_secret now - it won't be shown again!"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating OAuth app");
                return StatusCode(500, new { success = false, error = "Failed to create application" });
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // PUT /api/developer/apps/{id}
        // Actualiza una aplicación
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Actualiza una aplicación existente.
        /// </summary>
        [HttpPut("apps/{id:guid}")]
        public async Task<IActionResult> UpdateApplication(Guid id, [FromBody] UpdateAppDto request)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var app = await _oauthService.UpdateApplicationAsync(
                id,
                userId.Value,
                new UpdateOAuthAppRequest(
                    request.Name,
                    request.Description,
                    request.RedirectUris,
                    request.Scopes,
                    request.IconUrl,
                    request.WebsiteUrl
                )
            );

            if (app == null)
            {
                return NotFound(new { success = false, error = "Application not found" });
            }

            _logger.LogInformation("OAuth app updated: {AppId}", id);

            return Ok(new
            {
                success = true,
                app = new
                {
                    id = app.Id,
                    name = app.Name,
                    description = app.Description,
                    client_id = app.ClientId,
                    redirect_uris = app.RedirectUris,
                    scopes = app.Scopes,
                    updated_at = app.UpdatedAt
                }
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // POST /api/developer/apps/{id}/regenerate-secret
        // Regenera el client_secret
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Regenera el client_secret de una aplicación.
        /// ADVERTENCIA: Esto invalida todos los tokens existentes.
        /// </summary>
        [HttpPost("apps/{id:guid}/regenerate-secret")]
        public async Task<IActionResult> RegenerateSecret(Guid id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var result = await _oauthService.RegenerateSecretAsync(id, userId.Value);

            if (result == null)
            {
                return NotFound(new { success = false, error = "Application not found" });
            }

            _logger.LogWarning("OAuth app secret regenerated: {AppId} by user {UserId}", id, userId);

            return Ok(new
            {
                success = true,
                client_id = result.ClientId,
                client_secret = result.ClientSecret,
                message = "Secret regenerated. All existing tokens have been revoked. Save the new secret now!"
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // DELETE /api/developer/apps/{id}
        // Elimina una aplicación
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Elimina una aplicación y todos sus tokens.
        /// </summary>
        [HttpDelete("apps/{id:guid}")]
        public async Task<IActionResult> DeleteApplication(Guid id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var deleted = await _oauthService.DeleteApplicationAsync(id, userId.Value);

            if (!deleted)
            {
                return NotFound(new { success = false, error = "Application not found" });
            }

            _logger.LogWarning("OAuth app deleted: {AppId} by user {UserId}", id, userId);

            return Ok(new { success = true, message = "Application deleted" });
        }

        // ═══════════════════════════════════════════════════════════════════
        // GET /api/developer/scopes
        // Lista todos los scopes disponibles
        // ═══════════════════════════════════════════════════════════════════

        /// <summary>
        /// Lista todos los scopes disponibles para aplicaciones.
        /// </summary>
        [HttpGet("scopes")]
        [AllowAnonymous]
        public IActionResult GetAvailableScopes()
        {
            var grouped = DecatronScopes.GetGroupedByCategory();

            return Ok(new
            {
                success = true,
                categories = new
                {
                    read = new
                    {
                        name = "Lectura",
                        description = "Permisos para leer datos",
                        scopes = grouped.TryGetValue("read", out var readScopes)
                            ? readScopes.Select(s => new { scope = s.Scope, name = s.Info.Name, description = s.Info.Description })
                            : Enumerable.Empty<object>()
                    },
                    write = new
                    {
                        name = "Escritura",
                        description = "Permisos para modificar configuración",
                        scopes = grouped.TryGetValue("write", out var writeScopes)
                            ? writeScopes.Select(s => new { scope = s.Scope, name = s.Info.Name, description = s.Info.Description })
                            : Enumerable.Empty<object>()
                    },
                    action = new
                    {
                        name = "Acciones",
                        description = "Permisos para ejecutar acciones en tiempo real",
                        scopes = grouped.TryGetValue("action", out var actionScopes)
                            ? actionScopes.Select(s => new { scope = s.Scope, name = s.Info.Name, description = s.Info.Description })
                            : Enumerable.Empty<object>()
                    }
                }
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // HELPERS
        // ═══════════════════════════════════════════════════════════════════

        private long? GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !long.TryParse(userIdClaim, out var userId))
            {
                return null;
            }
            return userId;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // DTOs
    // ═══════════════════════════════════════════════════════════════════

    public record CreateAppDto(
        string Name,
        string? Description,
        string[] RedirectUris,
        string[] Scopes,
        string? IconUrl,
        string? WebsiteUrl
    );

    public record UpdateAppDto(
        string? Name,
        string? Description,
        string[]? RedirectUris,
        string[]? Scopes,
        string? IconUrl,
        string? WebsiteUrl
    );
}
