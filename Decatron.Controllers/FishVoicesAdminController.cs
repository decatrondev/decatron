using Decatron.Attributes;
using Decatron.Core.Models.Tts;
using Decatron.Data;
using Decatron.Services.Tts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Decatron.Controllers
{
    /// <summary>
    /// Catálogo de voces de personaje de Fish desde el admin: buscar en Fish y escuchar la muestra del autor
    /// (todo gratis, no se genera audio) y aprobar con la licencia anotada. Una voz inactiva deja de ofrecerse
    /// y de aceptarse al sintetizar.
    /// </summary>
    [ApiController]
    [Route("api/admin/tts-fish-voices")]
    [Authorize]
    [RequireSystemOwner]
    public class FishVoicesAdminController : ControllerBase
    {
        private static readonly string[] Licenses = { "commercial", "noncommercial", "unknown" };

        private readonly DecatronDbContext _db;
        private readonly FishTtsClient _fish;
        private readonly ILogger<FishVoicesAdminController> _logger;

        public FishVoicesAdminController(DecatronDbContext db, FishTtsClient fish, ILogger<FishVoicesAdminController> logger)
        {
            _db = db; _fish = fish; _logger = logger;
        }

        public class ApproveRequest
        {
            public string ReferenceId { get; set; } = "";
            public string? Name { get; set; }
            public string? License { get; set; }
            public string? LicenseNote { get; set; }
            /// <summary>Solicitud de un streamer que esta aprobación resuelve (opcional).</summary>
            public long? RequestId { get; set; }
        }

        public class RejectRequest { public string? Note { get; set; } }

        public class UpdateRequest
        {
            public string? Name { get; set; }
            public string? License { get; set; }
            public string? LicenseNote { get; set; }
            public bool? Active { get; set; }
        }

        /// <summary>Voces del catálogo (activas e inactivas).</summary>
        [HttpGet]
        public async Task<IActionResult> List()
        {
            var voices = await _db.TtsFishVoices.AsNoTracking()
                .OrderByDescending(v => v.Active).ThenBy(v => v.Name).ToListAsync();
            return Ok(new { success = true, voices });
        }

        /// <summary>Solicitudes de voz de los streamers (pendientes primero).</summary>
        [HttpGet("requests")]
        public async Task<IActionResult> Requests()
        {
            var rows = await (from r in _db.TtsFishVoiceRequests.AsNoTracking()
                              join u in _db.Users.AsNoTracking() on r.UserId equals u.Id into uj
                              from u in uj.DefaultIfEmpty()
                              orderby r.Status == "pending" ? 0 : 1, r.CreatedAt descending
                              select new { r.Id, r.UserId, login = u != null ? u.Login : null, r.Description, r.ReferenceId, r.Title, r.SampleUrl, r.Status, r.AdminNote, r.VoiceId, r.CreatedAt, r.ResolvedAt })
                             .Take(100).ToListAsync();
            return Ok(new { success = true, requests = rows });
        }

        [HttpPost("requests/{id:long}/reject")]
        public async Task<IActionResult> Reject(long id, [FromBody] RejectRequest req)
        {
            var r = await _db.TtsFishVoiceRequests.FirstOrDefaultAsync(x => x.Id == id);
            if (r == null) return NotFound(new { success = false, message = "Solicitud no encontrada" });
            if (r.Status != "pending") return BadRequest(new { success = false, message = "La solicitud ya fue resuelta" });
            r.Status = "rejected";
            r.AdminNote = string.IsNullOrWhiteSpace(req?.Note) ? null : req!.Note!.Trim();
            r.ResolvedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        /// <summary>Voces propias que agregaron los Patrocinadores (todas, activas e inactivas).</summary>
        [HttpGet("user-voices")]
        public async Task<IActionResult> UserVoices()
        {
            var rows = await (from v in _db.TtsFishUserVoices.AsNoTracking()
                              join u in _db.Users.AsNoTracking() on v.UserId equals u.Id into uj
                              from u in uj.DefaultIfEmpty()
                              orderby v.Active descending, v.CreatedAt descending
                              select new { v.UserId, login = u != null ? u.Login : null, referenceId = v.ReferenceId, v.Name, v.Languages, v.Author, v.SampleUrl, v.Active, v.InactiveReason, v.CreatedAt })
                             .Take(300).ToListAsync();
            return Ok(new { success = true, voices = rows });
        }

        /// <summary>El dueño de la plataforma desactiva (o reactiva) una voz propia: queda registrada y el usuario no puede volver a agregarla.</summary>
        [HttpPatch("user-voices/{userId:long}/{referenceId}")]
        public async Task<IActionResult> UpdateUserVoice(long userId, string referenceId, [FromBody] UpdateRequest req)
        {
            var voice = await _db.TtsFishUserVoices.FirstOrDefaultAsync(v => v.UserId == userId && v.ReferenceId == referenceId);
            if (voice == null) return NotFound(new { success = false, message = "Voz no encontrada" });
            if (req.Active.HasValue)
            {
                voice.Active = req.Active.Value;
                voice.InactiveReason = req.Active.Value ? null : "admin";
            }
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        /// <summary>Busca voces públicas en Fish. No gasta saldo.</summary>
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] string? language)
        {
            try
            {
                var found = await _fish.SearchModelsAsync(q, string.IsNullOrWhiteSpace(language) ? "es" : language, 12);
                var inCatalog = (await _db.TtsFishVoices.AsNoTracking().Select(v => v.ReferenceId).ToListAsync()).ToHashSet();
                return Ok(new
                {
                    success = true,
                    results = found.Select(m => new
                    {
                        id = m.Id, title = m.Title, languages = m.Languages, author = m.Author, sampleUrl = m.SampleUrl,
                        likes = m.Likes, uses = m.Uses, visibility = m.Visibility, takenDown = m.TakenDown,
                        inCatalog = inCatalog.Contains(m.Id)
                    })
                });
            }
            catch (FishTtsException ex)
            {
                _logger.LogWarning("[FishVoices] Búsqueda falló: {Msg}", ex.Message);
                return StatusCode(502, new { success = false, message = "Fish no respondió la búsqueda" });
            }
        }

        /// <summary>Aprueba (agrega o reactiva) una voz. Verifica en Fish que exista y sea pública.</summary>
        [HttpPost]
        public async Task<IActionResult> Approve([FromBody] ApproveRequest req)
        {
            var id = (req.ReferenceId ?? "").Trim().ToLowerInvariant();
            if (!FishTtsClient.LooksLikeVoiceId(id)) return BadRequest(new { success = false, message = "El id de la voz no es válido" });
            var license = string.IsNullOrWhiteSpace(req.License) ? "unknown" : req.License.Trim().ToLowerInvariant();
            if (!Licenses.Contains(license)) return BadRequest(new { success = false, message = "Licencia no válida" });

            FishModelInfo? model;
            try { model = await _fish.GetModelAsync(id); }
            catch (FishTtsException) { return StatusCode(502, new { success = false, message = "Fish no respondió" }); }
            if (model == null) return NotFound(new { success = false, message = "Fish no encuentra esa voz" });
            if (model.TakenDown || !string.Equals(model.Visibility, "public", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { success = false, message = "La voz no es pública en Fish o fue retirada" });

            var voice = await _db.TtsFishVoices.FirstOrDefaultAsync(v => v.ReferenceId == id);
            if (voice == null)
            {
                voice = new FishVoice { ReferenceId = id, CreatedBy = GetUserId(), Source = req.RequestId != null ? "request" : "admin" };
                _db.TtsFishVoices.Add(voice);
            }
            voice.Name = string.IsNullOrWhiteSpace(req.Name) ? model.Title : req.Name.Trim();
            voice.Languages = string.Join(",", model.Languages);
            voice.Author = model.Author;
            voice.SampleUrl = model.SampleUrl;
            voice.License = license;
            voice.LicenseNote = string.IsNullOrWhiteSpace(req.LicenseNote) ? null : req.LicenseNote.Trim();
            voice.Active = true;
            voice.InactiveReason = null;
            voice.LastCheckedAt = DateTimeOffset.UtcNow;
            if (req.RequestId != null)
            {
                var r = await _db.TtsFishVoiceRequests.FirstOrDefaultAsync(x => x.Id == req.RequestId && x.Status == "pending");
                if (r != null)
                {
                    r.Status = "approved";
                    r.VoiceId = id;
                    r.ResolvedAt = DateTimeOffset.UtcNow;
                }
            }
            await _db.SaveChangesAsync();
            _logger.LogInformation("[FishVoices] Voz aprobada: {Name} ({Id}) licencia {License}", voice.Name, id, license);
            return Ok(new { success = true, voice });
        }

        [HttpPatch("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] UpdateRequest req)
        {
            var voice = await _db.TtsFishVoices.FirstOrDefaultAsync(v => v.ReferenceId == id);
            if (voice == null) return NotFound(new { success = false, message = "Voz no encontrada" });
            if (!string.IsNullOrWhiteSpace(req.Name)) voice.Name = req.Name.Trim();
            if (req.License != null)
            {
                var license = req.License.Trim().ToLowerInvariant();
                if (!Licenses.Contains(license)) return BadRequest(new { success = false, message = "Licencia no válida" });
                voice.License = license;
            }
            if (req.LicenseNote != null) voice.LicenseNote = string.IsNullOrWhiteSpace(req.LicenseNote) ? null : req.LicenseNote.Trim();
            if (req.Active.HasValue)
            {
                voice.Active = req.Active.Value;
                voice.InactiveReason = req.Active.Value ? null : "manual";
            }
            await _db.SaveChangesAsync();
            return Ok(new { success = true, voice });
        }

        private long? GetUserId() => long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var n) ? n : null;
    }
}
