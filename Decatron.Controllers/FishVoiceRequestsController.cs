using System.Security.Claims;
using System.Text.RegularExpressions;
using Decatron.Core.Models.Tts;
using Decatron.Data;
using Decatron.Services.Tts;
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
        private readonly FishTtsClient _fish;
        public FishVoiceRequestsController(DecatronDbContext db, FishTtsClient fish, ILogger<FishVoiceRequestsController> logger) { _db = db; _fish = fish; _logger = logger; }

        /// <summary>Texto libre, o el id de una voz que el streamer escuchó en el buscador (el nombre y la muestra los toma el servidor de Fish).</summary>
        public class CreateRequest
        {
            public string Description { get; set; } = "";
            public string? ReferenceId { get; set; }
        }

        /// <summary>Mis solicitudes, las más recientes primero.</summary>
        [HttpGet]
        public async Task<IActionResult> Mine()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            var list = await _db.TtsFishVoiceRequests.AsNoTracking()
                .Where(r => r.UserId == userId).OrderByDescending(r => r.CreatedAt).Take(20)
                .Select(r => new { r.Id, r.Description, r.ReferenceId, r.Title, r.SampleUrl, r.Status, r.AdminNote, r.CreatedAt, r.ResolvedAt })
                .ToListAsync();
            return Ok(new { success = true, maxPending = MaxPending, requests = list });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateRequest req)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            var text = (req.Description ?? "").Trim();
            var picked = (req.ReferenceId ?? "").Trim().ToLowerInvariant();
            FishModelInfo? model = null;
            if (picked.Length > 0)
            {
                if (!FishTtsClient.LooksLikeVoiceId(picked)) return BadRequest(new { success = false, message = "El id de la voz no es válido" });
                if (await _db.TtsFishVoices.AnyAsync(v => v.ReferenceId == picked && v.Active))
                    return BadRequest(new { success = false, message = "Esa voz ya está en la lista de todos" });
                if (await _db.TtsFishVoiceRequests.AnyAsync(r => r.UserId == userId && r.Status == "pending" && r.ReferenceId == picked))
                    return BadRequest(new { success = false, message = "Ya pediste esa voz; espera a que se revise" });
                try { model = await _fish.GetModelAsync(picked); }
                catch (FishTtsException) { return StatusCode(502, new { success = false, message = "Fish no respondió; inténtalo de nuevo" }); }
                if (model == null || model.TakenDown || !string.Equals(model.Visibility, "public", StringComparison.OrdinalIgnoreCase))
                    return BadRequest(new { success = false, message = "Esa voz no es pública en Fish o fue retirada" });
                if (text.Length < 3) text = model.Title;
            }
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
                ReferenceId = model != null ? picked : (m.Success ? m.Value.ToLowerInvariant() : null),
                Title = model?.Title is { Length: > 200 } t ? t[..200] : model?.Title,
                SampleUrl = model?.SampleUrl
            };
            _db.TtsFishVoiceRequests.Add(entity);
            await _db.SaveChangesAsync();
            _logger.LogInformation("[FishVoices] Solicitud {Id} de usuario {UserId}", entity.Id, userId);
            return Ok(new { success = true, id = entity.Id });
        }

        private long? GetUserId() => long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var n) ? n : null;
    }
}
