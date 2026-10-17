using System.Security.Claims;
using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Core.Settings;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase A (pieza F): 2FA (TOTP) del comprador, opcional. Activar, verificar (da el token de paso de 10 min), regenerar codigos de
    /// recuperacion y desactivar. Desactivar y regenerar exigen un codigo valido en la misma peticion. El tenant sale del Host.
    /// </summary>
    [ApiController]
    [Route("api/platform/buyer/mfa")]
    [Authorize, RequireBuyerOwner]
    public class BuyerMfaController : ControllerBase
    {
        private readonly BuyerMfa _mfa;
        private readonly IOptions<JwtSettings> _jwt;
        public BuyerMfaController(BuyerMfa mfa, IOptions<JwtSettings> jwt) { _mfa = mfa; _jwt = jwt; }

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
            var bad = Reject(await _mfa.VerifyAsync(Tid, Uid, body.Code ?? ""));
            if (bad is not null) return bad;
            var enabledAt = await _mfa.EnabledAtAsync(Tid, Uid);
            if (enabledAt is null) return BadRequest(new { success = false, code = "not_enabled" });
            return Ok(new { success = true, stepUp = BuyerStepUp.Issue(Tid, Uid, enabledAt.Value, _jwt.Value.SecretKey), expiresInSeconds = (int)BuyerStepUp.Lifetime.TotalSeconds });
        }

        [HttpPost("recovery-codes")]
        public async Task<IActionResult> Regenerate([FromBody] CodeBody body)
        {
            var bad = Reject(await _mfa.VerifyAsync(Tid, Uid, body.Code ?? ""));
            if (bad is not null) return bad;
            return Ok(new { success = true, recoveryCodes = await _mfa.RegenerateRecoveryAsync(Tid, Uid) });
        }

        [HttpPost("disable")]
        public async Task<IActionResult> Disable([FromBody] CodeBody body)
        {
            var bad = Reject(await _mfa.VerifyAsync(Tid, Uid, body.Code ?? ""));
            if (bad is not null) return bad;
            await _mfa.DisableAsync(Tid, Uid);
            return Ok(new { success = true });
        }
    }
}
