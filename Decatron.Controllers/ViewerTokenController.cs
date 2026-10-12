using System.Security.Claims;
using Decatron.Services.LiveTranslation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// El token de espectador de la traducción en vivo: la página /extension/login lo pide con la sesión normal y se lo entrega a la
    /// extensión. Solo identifica a la persona ante el hub de traducción; no da acceso a nada más. Plan: TRADUCCION_ACCESO_PLAN.md, Fase 2.
    /// </summary>
    [ApiController]
    [Route("api/viewer-token")]
    [Authorize]
    public class ViewerTokenController : ControllerBase
    {
        private readonly ViewerTokenService _tokens;
        private readonly ILogger<ViewerTokenController> _logger;

        public ViewerTokenController(ViewerTokenService tokens, ILogger<ViewerTokenController> logger)
        {
            _tokens = tokens;
            _logger = logger;
        }

        private long? CurrentUserId() =>
            long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

        /// <summary>Un token de espectador nuevo para la persona que inició sesión.</summary>
        [HttpPost]
        public async Task<IActionResult> Create()
        {
            var userId = CurrentUserId();
            if (userId == null) return Unauthorized();
            var who = await _tokens.IdentityOfAsync(userId.Value);
            if (who == null) return NotFound(new { error = "account" });
            var epoch = await _tokens.GetEpochAsync(userId.Value);
            var token = _tokens.Create(who, epoch);
            _logger.LogInformation("[LiveTranslation] Token de espectador emitido para {UserId}", userId);
            return Ok(new { token, login = who.Login, expiresAt = DateTimeOffset.UtcNow.Add(ViewerTokenService.Lifetime).ToUnixTimeSeconds() });
        }

        /// <summary>Cierra la sesión de la extensión en todos los navegadores (invalida los tokens ya emitidos).</summary>
        [HttpPost("revoke")]
        public async Task<IActionResult> Revoke()
        {
            var userId = CurrentUserId();
            if (userId == null) return Unauthorized();
            await _tokens.RevokeAllAsync(userId.Value);
            return NoContent();
        }
    }
}
