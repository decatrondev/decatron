using System.Text.RegularExpressions;
using Decatron.Attributes;
using Decatron.Core.Models.Platform;
using Decatron.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma: el dueño aprueba los correos que pueden registrarse como comprador (<c>Platform:SignupMode</c> = approval, ver <c>SignupGate</c>).
    /// Se aprueba desde la lista de espera o a mano. Aprobar no envía ningún correo ni crea nada: solo permite que esa persona pida su enlace de alta.
    /// </summary>
    [ApiController]
    [Route("api/admin/platform/approvals")]
    [Authorize, RequireSystemOwner]
    public class PlatformApprovalsController : ControllerBase
    {
        private static readonly Regex EmailRx = new(@"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$", RegexOptions.Compiled);
        private readonly DecatronDbContext _db;
        private readonly IConfiguration _config;
        private readonly ILogger<PlatformApprovalsController> _log;

        public PlatformApprovalsController(DecatronDbContext db, IConfiguration config, ILogger<PlatformApprovalsController> log)
        { _db = db; _config = config; _log = log; }

        public sealed class ApproveBody { public string? Email { get; set; } public string? Note { get; set; } }

        private string Actor => User.FindFirst("login")?.Value ?? User.Identity?.Name ?? "owner";

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var items = await _db.PlatformApprovedEmails.AsNoTracking().OrderByDescending(a => a.ApprovedAt)
                .Select(a => new { a.Email, a.ApprovedAt, a.ApprovedBy, a.Note }).ToListAsync();
            return Ok(new { success = true, mode = Decatron.Services.Tenancy.SignupGate.Mode(_config), items });
        }

        [HttpPost]
        public async Task<IActionResult> Approve([FromBody] ApproveBody body)
        {
            var email = (body.Email ?? "").Trim().ToLowerInvariant();
            if (email.Length == 0 || email.Length > 254 || !EmailRx.IsMatch(email)) return BadRequest(new { success = false, code = "invalid_email" });
            var note = string.IsNullOrWhiteSpace(body.Note) ? null : body.Note.Trim();
            if (note is { Length: > 200 }) return BadRequest(new { success = false, code = "invalid_note" });

            var row = await _db.PlatformApprovedEmails.FirstOrDefaultAsync(a => a.Email == email);
            if (row is null) _db.PlatformApprovedEmails.Add(new PlatformApprovedEmail { Email = email, ApprovedBy = Actor, Note = note });
            else if (note != null) row.Note = note;
            await _db.SaveChangesAsync();
            _log.LogInformation("Plataforma: correo aprobado para registrarse por {Actor}", Actor);
            return Ok(new { success = true });
        }

        /// <summary>Retira la aprobación. No toca un tenant ya creado; solo impide pedir o confirmar un alta nueva con ese correo.</summary>
        [HttpDelete]
        public async Task<IActionResult> Revoke([FromQuery] string email)
        {
            email = (email ?? "").Trim().ToLowerInvariant();
            var row = await _db.PlatformApprovedEmails.FirstOrDefaultAsync(a => a.Email == email);
            if (row is null) return NotFound(new { success = false, code = "not_found" });
            _db.PlatformApprovedEmails.Remove(row);
            await _db.SaveChangesAsync();
            _log.LogInformation("Plataforma: aprobacion de registro retirada por {Actor}", Actor);
            return Ok(new { success = true });
        }
    }
}
