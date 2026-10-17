using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase A (Equipo): lo que ve y puede hacer un admin del tenant. Lectura del estado de las conexiones SIN pistas de credenciales
    /// (solo «configurado / sin configurar»: nada de Client ID, últimos caracteres ni nombres de cuentas) y reabrir la conexión de EventSub.
    /// Lo pueden usar el dueño y los admins; todo lo demás del panel sigue siendo solo del dueño (<see cref="BuyerTenantController"/>).
    /// </summary>
    [ApiController]
    [Route("api/platform/buyer")]
    [Authorize, RequireBuyerMember]
    public class BuyerStateController : ControllerBase
    {
        private readonly TenantCredentialsService _svc;
        private readonly Decatron.Discord.DiscordTenantGateway _gateway;
        private readonly TenantEventSubHub _eventSub;
        private readonly ITenantCredentialStore _store;

        public BuyerStateController(TenantCredentialsService svc, Decatron.Discord.DiscordTenantGateway gateway, TenantEventSubHub eventSub, ITenantCredentialStore store)
        { _svc = svc; _gateway = gateway; _eventSub = eventSub; _store = store; }

        private long Tid => TenantAmbient.Current!.Value;

        [HttpGet("state")]
        public async Task<IActionResult> State()
        {
            var t = await _svc.FindAsync(Tid);
            if (t is null) return NotFound(new { success = false, code = "tenant_not_found" });
            var app = await _store.GetTwitchAppSummaryAsync(Tid);
            var byo = (await _svc.ByoSummariesAsync(Tid)).ToDictionary(kv => kv.Key, kv => kv.Value is not null);
            var gateway = _gateway.StateOf(Tid);
            return Ok(new
            {
                success = true,
                tenant = new { slug = t.Slug, name = t.Name, status = t.Status },
                twitchApp = app is null ? null : new { status = app.Status },
                twitchBot = await _store.GetTwitchBotAsync(Tid) is not null,
                discordBot = await _store.GetDiscordBotAsync(Tid) is not null,
                byo,
                byoAllowed = await _svc.ByoAllowedAsync(Tid),
                gateway = gateway is null ? null : new { status = gateway.Status, guilds = gateway.Guilds },
                eventSub = _eventSub.StateOf(Tid),
            });
        }

        [HttpPost("eventsub/restart")]
        public async Task<IActionResult> RestartEventSub([FromQuery] bool sync = true)
        {
            var r = await _svc.RestartEventSubAsync(Tid, sync);
            return r.Ok ? Ok(r.Data) : new ObjectResult(new { success = false, code = r.Code }) { StatusCode = r.Status };
        }
    }
}
