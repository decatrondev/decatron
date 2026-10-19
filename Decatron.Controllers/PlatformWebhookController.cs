using System.Text;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase 7.5b: avisos de Culqi. La URL lleva un secreto (<c>Platform:Billing:CulqiWebhookSecret</c>); sin él configurado, o con otro, responde 404 como si no existiera.
    /// Registrar en CulqiPanel → Eventos → Webhook: <c>https://decatron.top/api/platform/webhooks/culqi/{secreto}</c>. Nada del contenido se da por cierto (ver <see cref="PlatformWebhooks"/>).
    /// </summary>
    [ApiController]
    [AllowAnonymous]
    [Route("api/platform/webhooks/culqi/{secret}")]
    public class PlatformWebhookController : ControllerBase
    {
        private readonly PlatformWebhooks _hooks;
        private readonly IPaymentProvider _provider;
        private readonly ILogger<PlatformWebhookController> _log;

        public PlatformWebhookController(PlatformWebhooks hooks, IPaymentProvider provider, ILogger<PlatformWebhookController> log) { _hooks = hooks; _provider = provider; _log = log; }

        [HttpPost]
        [RequestSizeLimit(PlatformWebhooks.MaxBody)]
        public async Task<IActionResult> Receive(string secret)
        {
            if (!_hooks.SecretOk(secret)) return NotFound();
            string body;
            using (var reader = new StreamReader(Request.Body, Encoding.UTF8, false, 4096, leaveOpen: true))
            {
                var buf = new char[PlatformWebhooks.MaxBody];
                var n = await reader.ReadBlockAsync(buf, 0, buf.Length);
                body = new string(buf, 0, n);
            }
            try
            {
                var result = await _hooks.HandleAsync(_provider, body, HttpContext.RequestAborted);
                return Ok(new { ok = true, result });
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _log.LogError(ex, "tenant.billing.webhook.failed");
                return StatusCode(500);     // Culqi reintenta
            }
        }
    }
}
