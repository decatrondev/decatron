using System.Security.Claims;
using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Core.Models.Platform;
using Decatron.Data;
using Decatron.Services;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase A (Equipo): el dueño ve su equipo, invita admins por correo, cancela invitaciones y quita admins. Solo el owner (rol leído de la base
    /// en cada llamada); invitar y quitar piden además el 2FA reciente si lo activó. El tenant sale del Host. La aceptación del invitado es pública y vive en
    /// <see cref="PlatformSignupController"/> junto a las demás entradas. Las reglas (cuota, topes, un solo uso) están en <see cref="TenantTeam"/>.
    /// </summary>
    [ApiController]
    [Route("api/platform/buyer/team")]
    [Authorize, RequireBuyerOwner]
    public class BuyerTeamController : ControllerBase
    {
        private readonly TenantTeam _team;
        private readonly TenantCredentialsService _tenants;
        private readonly DecatronDbContext _db;
        private readonly EmailService _email;
        private readonly IConfiguration _config;
        private readonly ILogger<BuyerTeamController> _log;

        public BuyerTeamController(TenantTeam team, TenantCredentialsService tenants, DecatronDbContext db, EmailService email, IConfiguration config, ILogger<BuyerTeamController> log)
        { _team = team; _tenants = tenants; _db = db; _email = email; _config = config; _log = log; }

        private long Tid => TenantAmbient.Current!.Value;
        private long Uid => long.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        private IActionResult Map(PlanResult r) => r.Ok ? Ok(r.Data) : new ObjectResult(new { success = false, code = r.Code }) { StatusCode = r.Status };
        /// <summary>Mismo tope diario de correos que la lista de espera y el registro: la cuota de Resend la comparte todo el bot.</summary>
        private int MaxEmailsPerDay => Math.Max(0, _config.GetValue<int?>("Platform:WaitlistMaxEmailsPerDay") ?? 40);

        public sealed class InviteBody { public string? Email { get; set; } public string? Locale { get; set; } }

        [HttpGet]
        public async Task<IActionResult> Get() => Map(await _team.GetAsync(Tid, HttpContext.RequestAborted));

        [HttpPost("invite")]
        [RequireStepUp]
        public async Task<IActionResult> Invite([FromBody] InviteBody body)
        {
            var since = DateTime.UtcNow.AddDays(-1);
            if (await _db.PlatformWaitlistEmails.CountAsync(m => m.SentAt >= since) >= MaxEmailsPerDay)
            {
                _log.LogWarning("Equipo: tope diario de correos alcanzado ({Max})", MaxEmailsPerDay);
                return StatusCode(503, new { success = false, code = "busy" });
            }

            var locale = body.Locale == "en" ? "en" : "es";
            var r = await _team.InviteAsync(Tid, Uid, body.Email ?? "", locale, HttpContext.RequestAborted);
            if (!r.Ok) return Map(r);
            var invite = (InviteOutcome)r.Data!;

            var tenant = await _tenants.FindAsync(Tid);
            if (tenant is null) { await _team.CancelInvitationAsync(Tid, invite.InvitationId, Uid, "cancel_error"); return NotFound(new { success = false, code = "tenant_not_found" }); }

            _db.PlatformWaitlistEmails.Add(new PlatformWaitlistEmail()); // se cuenta aunque Resend falle: el intento también gasta cuota
            await _db.SaveChangesAsync();
            var by = User.FindFirst("Email")?.Value ?? "";
            var link = $"{PlatformSignupController.TenantUrl(tenant.Slug)}/panel/invitacion?t={invite.Token}";
            var (subject, html) = PlatformSignupController.BuildEmail(locale, "invite", tenant.Name, link, TenantTeam.InviteDays * 1440, by);
            var (sent, _, error) = await _email.SendEmailAsync(invite.Email, subject, html, "Decatron <support@decatron.net>");
            if (!sent)
            {
                // Sin correo no hay invitación: se cancela para no dejar ocupado un lugar del plan con un enlace que nadie recibió.
                _log.LogWarning("Equipo: no se pudo enviar la invitación ({Error})", error);
                await _team.CancelInvitationAsync(Tid, invite.InvitationId, Uid, "cancel_mail_failed");
                return StatusCode(502, new { success = false, code = "email_failed" });
            }
            return Ok(new { success = true });
        }

        [HttpDelete("invitations/{id:long}")]
        public async Task<IActionResult> CancelInvitation(long id) => Map(await _team.CancelInvitationAsync(Tid, id, Uid, "cancel", HttpContext.RequestAborted));

        [HttpDelete("members/{userId:long}")]
        [RequireStepUp]
        public async Task<IActionResult> RemoveAdmin(long userId) => Map(await _team.RemoveAdminAsync(Tid, Uid, userId, HttpContext.RequestAborted));
    }
}
