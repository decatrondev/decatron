using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Decatron.Core.Settings;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Decatron.Controllers
{
    /// <summary>
    /// Renovación de la sesión mientras /multi está abierto. La sesión normal dura <c>JwtSettings.ExpiryMinutes</c> (60) y no se renueva;
    /// en /multi la gente deja la página horas (lurk), así que la página pide aquí una sesión nueva unos minutos antes de que venza.
    /// Solo se renueva una sesión todavía válida: una robada o abandonada sigue muriendo a la hora. Sirve igual para Twitch, Kick
    /// o Discord porque copia los datos de la sesión actual (con la misma forma que les dio su login) y solo cambia el vencimiento.
    /// </summary>
    [Route("api/multiview/session")]
    [ApiController]
    [Authorize]
    public class MultiviewSessionController : ControllerBase
    {
        // Datos propios del token que se generan de nuevo; el resto (usuario, proveedor, ids, foto) se copia tal cual.
        private static readonly HashSet<string> Reserved = new(StringComparer.Ordinal) { "exp", "nbf", "iat", "jti", "iss", "aud" };

        private readonly DecatronDbContext _db;
        private readonly JwtSettings _jwt;
        private readonly ILogger<MultiviewSessionController> _logger;

        public MultiviewSessionController(DecatronDbContext db, IOptions<JwtSettings> jwt, ILogger<MultiviewSessionController> logger)
        {
            _db = db;
            _jwt = jwt.Value;
            _logger = logger;
        }

        /// <summary>POST /api/multiview/session/renew — devuelve una sesión nueva con los mismos datos y otra hora de vida.</summary>
        [HttpPost("renew")]
        public async Task<IActionResult> Renew()
        {
            if (!long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId)) return Unauthorized();
            // Una cuenta borrada o desactivada no se renueva
            var active = await _db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => (bool?)u.IsActive).FirstOrDefaultAsync();
            if (active != true) return Unauthorized();

            var now = DateTime.UtcNow;
            var expires = now.AddMinutes(_jwt.ExpiryMinutes);
            var claims = User.Claims.Where(c => !Reserved.Contains(c.Type)).Select(c => new Claim(c.Type, c.Value)).ToList();
            var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.SecretKey)), SecurityAlgorithms.HmacSha256);
            var token = new JwtSecurityToken(claims: claims, notBefore: now, expires: expires, signingCredentials: creds);

            _logger.LogInformation("Multi-view: sesión renovada para el usuario {UserId} hasta {Expires:HH:mm} UTC", userId, expires);
            return Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token), expiresAt = expires });
        }
    }
}
