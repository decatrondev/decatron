using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase A (pieza D): el comprador carga SUS credenciales (app y bot de Twitch, bot de Discord, llaves de IA/voz) sin pasar por el dueño.
    /// Las reglas viven en <see cref="TenantCredentialsService"/> (las mismas del panel del dueño, <see cref="PlatformTenantsController"/>); aquí solo se
    /// decide quién puede llamar y de dónde sale el tenant: del Host, nunca de la URL, y el acceso exige ser owner de ese tenant. Los secretos son solo
    /// escritura: nunca se devuelven. Las acciones que tocan credenciales piden además el 2FA reciente si el comprador lo activó (RequireStepUp).
    /// Ver .dev/plans/plataforma/FASE_A_BC_DISENO.md.
    /// </summary>
    [ApiController]
    [Route("api/platform/buyer")]
    [Authorize, RequireBuyerOwner]
    public class BuyerTenantController : ControllerBase
    {
        private readonly TenantCredentialsService _svc;
        private readonly Decatron.Discord.DiscordTenantGateway _gateway;
        private readonly TenantEventSubHub _eventSub;
        private readonly TenantEventSubSync _eventSubSync;
        private readonly ITenantCredentialStore _store;
        private readonly IConfiguration _config;

        public BuyerTenantController(TenantCredentialsService svc, Decatron.Discord.DiscordTenantGateway gateway, TenantEventSubHub eventSub,
            TenantEventSubSync eventSubSync, ITenantCredentialStore store, IConfiguration config)
        {
            _svc = svc; _gateway = gateway; _eventSub = eventSub; _eventSubSync = eventSubSync; _store = store; _config = config;
        }

        /// <summary>Tenant del subdominio. El filtro RequireBuyerOwner ya garantizó que existe y no es el #1.</summary>
        private long Tid => TenantAmbient.Current!.Value;
        private string Actor => "buyer:" + (User.FindFirst("Email")?.Value ?? "?");
        /// <summary>El callback de Twitch vuelve al subdominio del tenant: ahi se guarda la sesion del streamer (cada marca en su propio dominio).</summary>
        private static string SiteOf(string slug) => $"https://{slug}.{TenantResolver.PlatformDomain}";
        private static string RedirectFor(string slug) => $"{SiteOf(slug)}/api/auth/callback";

        private IActionResult Map(PlanResult r) => r.Ok ? Ok(r.Data) : new ObjectResult(new { success = false, code = r.Code }) { StatusCode = r.Status };

        public sealed class TwitchAppBody { public string? ClientId { get; set; } public string? ClientSecret { get; set; } }
        public sealed class DiscordBotBody { public string? Token { get; set; } }
        public sealed class ByoBody
        {
            public string? ApiKey { get; set; }
            public string? BaseUrl { get; set; }
            public string? Model { get; set; }
            public string? FallbackModel { get; set; }
            public string? Voices { get; set; }
        }

        private async Task<(string Slug, string Name, string Status)?> TenantAsync()
        {
            var t = await _svc.FindAsync(Tid);
            return t is null ? null : (t.Slug, t.Name, t.Status);
        }

        [HttpGet("tenant")]
        public async Task<IActionResult> Get()
        {
            var t = await TenantAsync();
            if (t is null) return NotFound(new { success = false, code = "tenant_not_found" });
            return Ok(new
            {
                success = true,
                tenant = new { slug = t.Value.Slug, name = t.Value.Name, status = t.Value.Status },
                redirectUri = RedirectFor(t.Value.Slug),
                twitchApp = await _store.GetTwitchAppSummaryAsync(Tid),
                twitchBot = await _store.GetTwitchBotAsync(Tid),
                discordBot = await _store.GetDiscordBotAsync(Tid),
                byo = await _svc.ByoSummariesAsync(Tid),
                byoAllowed = await _svc.ByoAllowedAsync(Tid),
                gateway = _gateway.StateOf(Tid),
                eventSub = _eventSub.StateOf(Tid),
                eventSubSync = _eventSubSync.LastOf(Tid),
            });
        }

        // ── Twitch ──

        /// <summary>Carga la app de Twitch del comprador. La URL de retorno y los permisos son los de la plataforma (el comprador no los cambia).</summary>
        [HttpPut("twitch-app")]
        [RequireStepUp]
        public async Task<IActionResult> SaveTwitchApp([FromBody] TwitchAppBody body)
        {
            var t = await TenantAsync();
            if (t is null) return NotFound(new { success = false, code = "tenant_not_found" });
            return Map(await _svc.SaveTwitchAppAsync(Tid, new TwitchAppRequest(body.ClientId, body.ClientSecret, RedirectFor(t.Value.Slug), null), Actor));
        }

        [HttpDelete("twitch-app")]
        [RequireStepUp]
        public async Task<IActionResult> DeleteTwitchApp() => Map(await _svc.DeleteTwitchAppAsync(Tid, Actor));

        /// <summary>Enlace de un solo proposito (30 min) para autorizar la cuenta del bot iniciando sesion en Twitch con ella.</summary>
        [HttpPost("bot-link")]
        [RequireStepUp]
        public async Task<IActionResult> CreateBotLink()
        {
            var t = await TenantAsync();
            if (t is null) return NotFound(new { success = false, code = "tenant_not_found" });
            return Map(await _svc.CreateBotLinkAsync(Tid, SiteOf(t.Value.Slug), Actor));
        }

        [HttpDelete("bot")]
        [RequireStepUp]
        public async Task<IActionResult> DeleteBot() => Map(await _svc.DeleteBotAsync(Tid, Actor));

        [HttpPost("eventsub/restart")]
        public async Task<IActionResult> RestartEventSub([FromQuery] bool sync = true) => Map(await _svc.RestartEventSubAsync(Tid, sync));

        // ── Llaves propias (IA, Deepgram, Fish Audio) ──

        [HttpPut("byo/{provider}")]
        [RequireStepUp]
        public async Task<IActionResult> SaveByo(string provider, [FromBody] ByoBody body)
            => Map(await _svc.SaveByoAsync(Tid, provider, new ByoRequest(body.ApiKey, body.BaseUrl, body.Model, body.FallbackModel, body.Voices), Actor, enforcePlan: true, HttpContext.RequestAborted));

        [HttpPost("byo/{provider}/test")]
        public async Task<IActionResult> TestByo(string provider) => Map(await _svc.TestByoAsync(Tid, provider, "buyer-test", HttpContext.RequestAborted));

        [HttpDelete("byo/{provider}")]
        [RequireStepUp]
        public async Task<IActionResult> DeleteByo(string provider) => Map(await _svc.DeleteByoAsync(Tid, provider, Actor));

        // ── Discord ──

        [HttpPut("discord-bot")]
        [RequireStepUp]
        public async Task<IActionResult> SaveDiscordBot([FromBody] DiscordBotBody body) => Map(await _svc.SaveDiscordBotAsync(Tid, body.Token, Actor));

        [HttpPost("discord-bot/restart")]
        public async Task<IActionResult> RestartDiscordBot() => Map(await _svc.RestartDiscordBotAsync(Tid));

        [HttpDelete("discord-bot")]
        [RequireStepUp]
        public async Task<IActionResult> DeleteDiscordBot() => Map(await _svc.DeleteDiscordBotAsync(Tid, Actor));
    }
}
