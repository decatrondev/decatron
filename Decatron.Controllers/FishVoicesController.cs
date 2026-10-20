using Decatron.Core.Models.Tts;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Voces de personaje (Fish Audio) aprobadas, para los selectores de Speak Chat, Event Alerts,
    /// Tips y Timers. Solo devuelve las activas y lo que el streamer necesita ver: nombre, idioma,
    /// autor y cuánto cuesta (créditos por byte de texto, de la tarifa «fish» de credit_rates).
    /// </summary>
    [ApiController]
    [Route("api/tts/fish-voices")]
    [Authorize]
    public class FishVoicesController : ControllerBase
    {
        private readonly DecatronDbContext _db;
        public FishVoicesController(DecatronDbContext db) { _db = db; }

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var voices = await _db.TtsFishVoices.AsNoTracking()
                .Where(v => v.Active).OrderBy(v => v.Name)
                .Select(v => new { id = v.ReferenceId, name = v.Name, languages = v.Languages, author = v.Author, sampleUrl = v.SampleUrl })
                .ToListAsync();
            var rate = await _db.CreditRates.AsNoTracking().Where(r => r.Engine == "fish").Select(r => (decimal?)r.CreditsPerUnit).FirstOrDefaultAsync();
            return Ok(new { success = true, creditsPerByte = rate ?? 0m, voices });
        }
    }
}
