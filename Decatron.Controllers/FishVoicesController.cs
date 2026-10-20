using System.Security.Claims;
using Decatron.Core.Helpers;
using Decatron.Core.Models.Tts;
using Decatron.Data;
using Decatron.Services.Tts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Voces de personaje (Fish Audio) para los selectores de Speak Chat, Event Alerts, Tips y Timers: las del catálogo
    /// global (aprobadas por el admin) y, para el rango Patrocinador o superior, las propias del canal, que el
    /// streamer busca y agrega él mismo sin aprobación. Buscar y agregar no genera audio ni gasta saldo de Fish.
    /// </summary>
    [ApiController]
    [Route("api/tts/fish-voices")]
    [Authorize]
    public class FishVoicesController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        private readonly FishTtsClient _fish;
        private readonly IConfiguration _config;
        private readonly ILogger<FishVoicesController> _logger;

        public FishVoicesController(DecatronDbContext db, FishTtsClient fish, IConfiguration config, ILogger<FishVoicesController> logger)
        {
            _db = db; _fish = fish; _config = config; _logger = logger;
        }

        public class AddRequest { public string ReferenceId { get; set; } = ""; }

        private int MaxPrivate => _config.GetValue("FishAudio:MaxPrivateVoices", FishVoiceAccess.DefaultMaxPrivateVoices);

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var voices = await _db.TtsFishVoices.AsNoTracking()
                .Where(v => v.Active).OrderBy(v => v.Name)
                .Select(v => new { id = v.ReferenceId, name = v.Name, languages = v.Languages, author = v.Author, sampleUrl = v.SampleUrl, @private = false })
                .ToListAsync();
            var rate = await _db.CreditRates.AsNoTracking().Where(r => r.Engine == "fish").Select(r => (decimal?)r.CreditsPerUnit).FirstOrDefaultAsync();

            var ownerId = GetChannelOwnerId();
            var canPrivate = ownerId > 0 && FishVoiceAccess.CanUsePrivateVoices(await TierResolver.GetEffectiveTierAsync(_db, ownerId));
            var all = voices.ToList();
            var mine = new List<object>();
            if (canPrivate)
            {
                var own = await _db.TtsFishUserVoices.AsNoTracking()
                    .Where(v => v.UserId == ownerId && v.Active).OrderBy(v => v.Name)
                    .Select(v => new { id = v.ReferenceId, name = v.Name, languages = v.Languages, author = v.Author, sampleUrl = v.SampleUrl, @private = true })
                    .ToListAsync();
                // Si una voz propia ya está en el catálogo global se ofrece una sola vez
                var globalIds = voices.Select(v => v.id).ToHashSet();
                mine.AddRange(own.Where(v => !globalIds.Contains(v.id)));
            }
            return Ok(new
            {
                success = true, creditsPerByte = rate ?? 0m,
                voices = all.Cast<object>().Concat(mine),
                canAddPrivate = canPrivate, maxPrivate = MaxPrivate,
                privateCount = canPrivate ? await _db.TtsFishUserVoices.CountAsync(v => v.UserId == ownerId && v.Active) : 0
            });
        }

        /// <summary>Busca voces públicas en Fish (rango Patrocinador o superior). No gasta saldo.</summary>
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] string? language)
        {
            var ownerId = GetChannelOwnerId();
            if (!await CanUsePrivateAsync(ownerId)) return StatusCode(403, new { success = false, message = "Disponible desde el rango Patrocinador" });
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2) return BadRequest(new { success = false, message = "Escribe al menos 2 letras" });
            try
            {
                var found = await _fish.SearchModelsAsync(q, string.IsNullOrWhiteSpace(language) ? "es" : language, 12);
                var mine = (await _db.TtsFishUserVoices.AsNoTracking().Where(v => v.UserId == ownerId && v.Active).Select(v => v.ReferenceId).ToListAsync()).ToHashSet();
                var global = (await _db.TtsFishVoices.AsNoTracking().Where(v => v.Active).Select(v => v.ReferenceId).ToListAsync()).ToHashSet();
                return Ok(new
                {
                    success = true,
                    results = found.Where(m => !m.TakenDown && string.Equals(m.Visibility, "public", StringComparison.OrdinalIgnoreCase)).Select(m => new
                    {
                        id = m.Id, title = m.Title, languages = m.Languages, author = m.Author, sampleUrl = m.SampleUrl,
                        likes = m.Likes, uses = m.Uses, added = mine.Contains(m.Id), inCatalog = global.Contains(m.Id)
                    })
                });
            }
            catch (FishTtsException ex)
            {
                _logger.LogWarning("[FishVoices] Búsqueda de usuario falló: {Msg}", ex.Message);
                return StatusCode(502, new { success = false, message = "Fish no respondió la búsqueda" });
            }
        }

        /// <summary>Agrega una voz pública de Fish a la lista propia del canal. Fish verifica que exista y sea pública.</summary>
        [HttpPost("mine")]
        public async Task<IActionResult> Add([FromBody] AddRequest req)
        {
            var ownerId = GetChannelOwnerId();
            if (!await CanUsePrivateAsync(ownerId)) return StatusCode(403, new { success = false, message = "Disponible desde el rango Patrocinador" });
            var id = (req.ReferenceId ?? "").Trim().ToLowerInvariant();
            if (!FishTtsClient.LooksLikeVoiceId(id)) return BadRequest(new { success = false, message = "El id de la voz no es válido" });

            var existing = await _db.TtsFishUserVoices.FirstOrDefaultAsync(v => v.UserId == ownerId && v.ReferenceId == id);
            // Una voz que el dueño de la plataforma desactivó (admin) no se puede volver a agregar
            if (existing is { Active: false, InactiveReason: "admin" })
                return BadRequest(new { success = false, message = "Esta voz no está disponible" });
            if (existing is { Active: true }) return Ok(new { success = true });

            var count = await _db.TtsFishUserVoices.CountAsync(v => v.UserId == ownerId && v.Active);
            if (count >= MaxPrivate)
                return BadRequest(new { success = false, message = $"Tu lista permite hasta {MaxPrivate} voces propias; quita alguna para agregar otra" });

            FishModelInfo? model;
            try { model = await _fish.GetModelAsync(id); }
            catch (FishTtsException) { return StatusCode(502, new { success = false, message = "Fish no respondió" }); }
            if (model == null) return NotFound(new { success = false, message = "Fish no encuentra esa voz" });
            if (model.TakenDown || !string.Equals(model.Visibility, "public", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { success = false, message = "La voz no es pública en Fish o fue retirada" });

            if (existing == null)
            {
                existing = new FishUserVoice { UserId = ownerId, ReferenceId = id };
                _db.TtsFishUserVoices.Add(existing);
            }
            existing.Name = model.Title;
            existing.Languages = string.Join(",", model.Languages);
            existing.Author = model.Author;
            existing.SampleUrl = model.SampleUrl;
            existing.Active = true;
            existing.InactiveReason = null;
            existing.LastCheckedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
            _logger.LogInformation("[FishVoices] Voz propia agregada: usuario {UserId}, {Name} ({Id})", ownerId, model.Title, id);
            return Ok(new { success = true });
        }

        [HttpDelete("mine/{id}")]
        public async Task<IActionResult> Remove(string id)
        {
            var ownerId = GetChannelOwnerId();
            var voice = await _db.TtsFishUserVoices.FirstOrDefaultAsync(v => v.UserId == ownerId && v.ReferenceId == id);
            if (voice == null) return NotFound(new { success = false });
            // La desactivada por el admin queda registrada para que no se pueda volver a agregar
            if (voice.InactiveReason == "admin") return Ok(new { success = true });
            _db.TtsFishUserVoices.Remove(voice);
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        private async Task<bool> CanUsePrivateAsync(long ownerId)
            => ownerId > 0 && FishVoiceAccess.CanUsePrivateVoices(await TierResolver.GetEffectiveTierAsync(_db, ownerId));

        /// <summary>Canal con el que se trabaja (sesión activa, claim del JWT o la cuenta propia), igual que los demás paneles.</summary>
        private long GetChannelOwnerId()
        {
            var sessionChannelId = HttpContext.Session.GetString("ActiveChannelId");
            if (long.TryParse(sessionChannelId, out var sessionId)) return sessionId;
            if (long.TryParse(User.FindFirst("ChannelOwnerId")?.Value, out var claimId)) return claimId;
            return long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var n) ? n : 0;
        }
    }
}
