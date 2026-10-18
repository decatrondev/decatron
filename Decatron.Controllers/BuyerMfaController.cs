using System.Security.Claims;
using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Core.Settings;
using Decatron.Services;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Npgsql;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase A (pieza F): 2FA (TOTP) del comprador, opcional. Activar, verificar (da el token de paso de 10 min), regenerar codigos de
    /// recuperacion y desactivar. Desactivar y regenerar exigen un codigo valido en la misma peticion. El tenant sale del Host.
    /// </summary>
    [ApiController]
    [AllowWithoutMfa]   // el dueño sin 2FA tiene que poder activarlo
    [Route("api/platform/buyer/mfa")]
    [Authorize, RequireBuyerOwner]
    public class BuyerMfaController : ControllerBase
    {
        private readonly BuyerMfa _mfa;
        private readonly IOptions<JwtSettings> _jwt;
        private readonly TenantCredentialsService _tenants;
        private readonly EmailService _email;
        private readonly IConfiguration _config;
        private readonly ILogger<BuyerMfaController> _log;
        public BuyerMfaController(BuyerMfa mfa, IOptions<JwtSettings> jwt, TenantCredentialsService tenants, EmailService email, IConfiguration config, ILogger<BuyerMfaController> log)
        { _mfa = mfa; _jwt = jwt; _tenants = tenants; _email = email; _config = config; _log = log; }

        /// <summary>Verifica el codigo y, si fue uno de recuperacion, avisa por correo al dueño.</summary>
        private async Task<MfaResult> CheckAsync(string? code)
        {
            var recovery = false;
            var r = await _mfa.VerifyAsync(Tid, Uid, code ?? "", onRecovery: _ => recovery = true);
            if (recovery) await NoticeAsync(BuyerNotices.MfaRecovery);
            return r;
        }

        /// <summary>Aviso de seguridad por correo. Nunca hace fallar la peticion ni gasta el tope de correos de la lista de espera: son pocos y no se pueden perder por eso.</summary>
        private async Task NoticeAsync(string kind)
        {
            try
            {
                var to = User.FindFirst("Email")?.Value;
                var tenant = await _tenants.FindAsync(Tid);
                if (string.IsNullOrWhiteSpace(to) || tenant is null) return;
                string locale = "es";
                await using (var c = TenantNpgsql.Create(_config["ConnectionStrings:DefaultConnection"], Tid))
                {
                    await c.OpenAsync();
                    await using var cmd = new NpgsqlCommand("SELECT preferred_language FROM users WHERE id = @u", c);
                    cmd.Parameters.AddWithValue("u", Uid);
                    locale = (await cmd.ExecuteScalarAsync()) as string == "en" ? "en" : "es";
                }
                var (subject, html) = BuyerNotices.Build(locale, kind, tenant.Name, PlatformSignupController.TenantUrl(tenant.Slug) + "/panel");
                var (sent, _, error) = await _email.SendEmailAsync(to, subject, html, "Decatron <support@decatron.net>");
                if (!sent) _log.LogWarning("Aviso de 2FA ({Kind}) no enviado: {Error}", kind, error);
            }
            catch (Exception ex) { _log.LogWarning(ex, "Aviso de 2FA ({Kind}) fallo", kind); }
        }

        public sealed class CodeBody { public string? Code { get; set; } }

        private long Tid => TenantAmbient.Current!.Value;
        private long Uid => long.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        private string Email => User.FindFirst("Email")?.Value ?? "comprador";

        [HttpGet]
        public async Task<IActionResult> Status()
        {
            var s = await _mfa.StatusAsync(Tid, Uid);
            return Ok(new { success = true, enabled = s.Enabled, recoveryLeft = s.RecoveryLeft, lockedSeconds = s.LockedSeconds });
        }

        /// <summary>Empieza la activacion: secreto nuevo y enlace otpauth para el QR. No queda activo hasta confirmar un codigo.</summary>
        [HttpPost("setup")]
        public async Task<IActionResult> Setup()
        {
            var r = await _mfa.BeginSetupAsync(Tid, Uid, Email, "Decatron");
            if (r is null) return Conflict(new { success = false, code = "already_enabled" });
            return Ok(new { success = true, secret = r.Value.Secret, uri = r.Value.Uri });
        }

        [HttpPost("confirm")]
        public async Task<IActionResult> Confirm([FromBody] CodeBody body)
        {
            var codes = await _mfa.ConfirmSetupAsync(Tid, Uid, body.Code ?? "");
            if (codes is null) return BadRequest(new { success = false, code = "invalid_code" });
            return Ok(new { success = true, recoveryCodes = codes });
        }

        private IActionResult? Reject(MfaResult r) => r switch
        {
            MfaResult.Ok => null,
            MfaResult.Locked => StatusCode(429, new { success = false, code = "locked" }),
            MfaResult.NotEnabled => BadRequest(new { success = false, code = "not_enabled" }),
            _ => BadRequest(new { success = false, code = "invalid_code" }),
        };

        /// <summary>Verifica un codigo (de la app o de recuperacion) y entrega el token de paso para las acciones con credenciales.</summary>
        [HttpPost("verify")]
        public async Task<IActionResult> Verify([FromBody] CodeBody body)
        {
            var bad = Reject(await CheckAsync(body.Code));
            if (bad is not null) return bad;
            var enabledAt = await _mfa.EnabledAtAsync(Tid, Uid);
            if (enabledAt is null) return BadRequest(new { success = false, code = "not_enabled" });
            return Ok(new { success = true, stepUp = BuyerStepUp.Issue(Tid, Uid, enabledAt.Value, _jwt.Value.SecretKey), expiresInSeconds = (int)BuyerStepUp.Lifetime.TotalSeconds });
        }

        [HttpPost("recovery-codes")]
        public async Task<IActionResult> Regenerate([FromBody] CodeBody body)
        {
            var bad = Reject(await CheckAsync(body.Code));
            if (bad is not null) return bad;
            return Ok(new { success = true, recoveryCodes = await _mfa.RegenerateRecoveryAsync(Tid, Uid) });
        }

        [HttpPost("disable")]
        public async Task<IActionResult> Disable([FromBody] CodeBody body)
        {
            var bad = Reject(await CheckAsync(body.Code));
            if (bad is not null) return bad;
            await _mfa.DisableAsync(Tid, Uid);
            await NoticeAsync(BuyerNotices.MfaOff);
            return Ok(new { success = true });
        }
    }
}
