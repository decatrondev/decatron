using System.Security.Claims;
using System.Text.RegularExpressions;
using Decatron.Core.Models.Tts;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Solicitudes de voz de personaje: el streamer pide una voz (nombre, personaje o enlace de Fish) y el admin
    /// la aprueba o rechaza desde /admin/fish-voices. No genera audio ni gasta saldo de Fish.
    /// </summary>
    [ApiController]
    [Route("api/tts/fish-voice-requests")]
    [Authorize]
    public class FishVoiceRequestsController : ControllerBase
    {
        public const int MaxPending = 3;
        public const int MaxLength = 300;
        private static readonly Regex VoiceIdInText = new("[0-9a-f]{32}", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private readonly DecatronDbContext _db;
        private readonly ILogger<FishVoiceRequestsController> _logger;
        public FishVoiceRequestsController(DecatronDbContext db, ILogger<FishVoiceRequestsController> logger) { _db = db; _logger = logger; }

        public class CreateRequest { public string Description { get; set; } = ""; }

        /// <summary>Mis solicitudes, las más recientes primero.</summary>
        [HttpGet]
        public async Task<IActionResult> Mine()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            var list = await _db.TtsFishVoiceRequests.AsNoTracking()
                .Where(r => r.UserId == userId).OrderByDescending(r => r.CreatedAt).Take(20)
                .Select(r => new { r.Id, r.Description, r.Status, r.AdminNote, r.CreatedAt, r.ResolvedAt })
                .ToListAsync();
            return Ok(new { success = true, maxPending = MaxPending, requests = list });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateRequest req)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            var text = (req.Description ?? "").Trim();
            if (text.Length < 3) return BadRequest(new { success = false, message = "Cuéntanos qué voz quieres" });
            if (text.Length > MaxLength) return BadRequest(new { success = false, message = $"Máximo {MaxLength} caracteres" });

            var pending = await _db.TtsFishVoiceRequests.CountAsync(r => r.UserId == userId && r.Status == "pending");
            if (pending >= MaxPending)
                return BadRequest(new { success = false, message = $"Ya tienes {MaxPending} solicitudes pendientes; espera a que se revisen" });

            var m = VoiceIdInText.Match(text);
            var entity = new FishVoiceRequest
            {
                UserId = userId.Value,
                Description = text,
                ReferenceId = m.Success ? m.Value.ToLowerInvariant() : null
            };
            _db.TtsFishVoiceRequests.Add(entity);
            await _db.SaveChangesAsync();
            _logger.LogInformation("[FishVoices] Solicitud {Id} de usuario {UserId}", entity.Id, userId);
            return Ok(new { success = true, id = entity.Id });
        }

        private long? GetUserId() => long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var n) ? n : null;
    }
}
