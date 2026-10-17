using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase 4 (paso 4): el dueño carga las credenciales de cada tenant (app y bot de Twitch, Discord, llaves propias, EventSub). Solo escritura de secretos
    /// (nunca se devuelven) y validación contra el proveedor antes de guardar. Las reglas viven en <see cref="TenantCredentialsService"/>, compartido con el panel
    /// del comprador (<see cref="BuyerTenantController"/>); aquí el tenant sale de la URL y solo entra el dueño del sistema. El tenant #1 no se toca: sigue en modo
    /// legacy (appsettings) hasta decidir migrarlo.
    /// </summary>
    [ApiController]
    [Route("api/admin/platform/tenants")]
    [Authorize, RequireSystemOwner]
    public class PlatformTenantsController : ControllerBase
    {
        private readonly TenantCredentialsService _svc;
        private readonly Decatron.Discord.DiscordTenantGateway _gateway;
        private readonly TenantEventSubHub _eventSub;
        private readonly TenantEventSubSync _eventSubSync;
        private readonly ITenantCredentialStore _store;
        private readonly IConfiguration _config;

        public PlatformTenantsController(TenantCredentialsService svc, Decatron.Discord.DiscordTenantGateway gateway, TenantEventSubHub eventSub,
            TenantEventSubSync eventSubSync, ITenantCredentialStore store, IConfiguration config)
        {
            _svc = svc; _gateway = gateway; _eventSub = eventSub; _eventSubSync = eventSubSync; _store = store; _config = config;
        }

        public sealed class TwitchAppBody
        {
            public string? ClientId { get; set; }
            public string? ClientSecret { get; set; }
            public string? RedirectUri { get; set; }
            public string? Scopes { get; set; }
        }

        public sealed class DiscordBotBody { public string? Token { get; set; } }

        public sealed class ByoBody
        {
            public string? ApiKey { get; set; }
            public string? BaseUrl { get; set; }
            public string? Model { get; set; }
            public string? FallbackModel { get; set; }
            /// <summary>Fish Audio: JSON [{"name":"Toji","referenceId":"…"}].</summary>
            public string? Voices { get; set; }
        }

        private string Actor => User.FindFirst("login")?.Value ?? User.Identity?.Name ?? "owner";

        private IActionResult Map(PlanResult r) => r.Ok ? Ok(r.Data) : new ObjectResult(new { success = false, code = r.Code }) { StatusCode = r.Status };

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var rows = new List<(long, string, string, string, string)>();
            await using (var c = TenantNpgsql.Create(_config.GetConnectionString("DefaultConnection"), 1))
            {
                await c.OpenAsync();
                await using var cmd = new NpgsqlCommand("SELECT id, slug, name, status, credentials_mode FROM tenants ORDER BY id", c);
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync()) rows.Add((r.GetInt64(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4)));
            }
            var items = new List<object>();
            foreach (var (id, slug, name, status, mode) in rows)
                items.Add(new { id, slug, name, status, mode, twitchApp = id == 1 ? null : await _store.GetTwitchAppSummaryAsync(id), twitchBot = id == 1 ? null : await _store.GetTwitchBotAsync(id),
                    discordBot = id == 1 ? null : await _store.GetDiscordBotAsync(id), byo = id == 1 ? null : await _svc.ByoSummariesAsync(id), gateway = id == 1 ? null : _gateway.StateOf(id),
                    eventSub = id == 1 ? null : _eventSub.StateOf(id), eventSubSync = id == 1 ? null : _eventSubSync.LastOf(id) });
            return Ok(new { success = true, items, gateways = new { connected = _gateway.Connected, cap = _gateway.Cap, rssMb = System.Diagnostics.Process.GetCurrentProcess().WorkingSet64 / 1048576 } });
        }

        [HttpPut("{id:long}/twitch-app")]
        public async Task<IActionResult> SaveTwitchApp(long id, [FromBody] TwitchAppBody body)
            => Map(await _svc.SaveTwitchAppAsync(id, new TwitchAppRequest(body.ClientId, body.ClientSecret, body.RedirectUri, body.Scopes), Actor));

        [HttpDelete("{id:long}/twitch-app")]
        public async Task<IActionResult> DeleteTwitchApp(long id) => Map(await _svc.DeleteTwitchAppAsync(id, Actor));

        /// <summary>Enlace de un solo proposito (30 min) para que el comprador autorice la cuenta de su bot iniciando sesion en Twitch con ella.</summary>
        [HttpPost("{id:long}/bot-link")]
        public async Task<IActionResult> CreateBotLink(long id)
            => Map(await _svc.CreateBotLinkAsync(id, _config["Platform:PublicBaseUrl"] ?? "https://decatron.net", Actor));

        [HttpDelete("{id:long}/bot")]
        public async Task<IActionResult> DeleteBot(long id) => Map(await _svc.DeleteBotAsync(id, Actor));

        /// <summary>Carga la llave propia del tenant para IA, Deepgram o Fish Audio: se prueba contra el proveedor y se guarda cifrada. Nunca se devuelve. El dueño puede cargarla aunque el plan no la incluya.</summary>
        [HttpPut("{id:long}/byo/{provider}")]
        public async Task<IActionResult> SaveByo(long id, string provider, [FromBody] ByoBody body)
            => Map(await _svc.SaveByoAsync(id, provider, new ByoRequest(body.ApiKey, body.BaseUrl, body.Model, body.FallbackModel, body.Voices), Actor, enforcePlan: false, HttpContext.RequestAborted));

        /// <summary>Vuelve a probar la llave ya guardada (sin gastar créditos del proveedor).</summary>
        [HttpPost("{id:long}/byo/{provider}/test")]
        public async Task<IActionResult> TestByo(long id, string provider) => Map(await _svc.TestByoAsync(id, provider, "admin-test", HttpContext.RequestAborted));

        [HttpDelete("{id:long}/byo/{provider}")]
        public async Task<IActionResult> DeleteByo(long id, string provider) => Map(await _svc.DeleteByoAsync(id, provider, Actor));

        /// <summary>Carga el bot de Discord del tenant: se valida contra Discord (debe ser un bot), se guarda cifrado y se abre su gateway.</summary>
        [HttpPut("{id:long}/discord-bot")]
        public async Task<IActionResult> SaveDiscordBot(long id, [FromBody] DiscordBotBody body) => Map(await _svc.SaveDiscordBotAsync(id, body.Token, Actor));

        [HttpPost("{id:long}/discord-bot/restart")]
        public async Task<IActionResult> RestartDiscordBot(long id) => Map(await _svc.RestartDiscordBotAsync(id));

        [HttpDelete("{id:long}/discord-bot")]
        public async Task<IActionResult> DeleteDiscordBot(long id) => Map(await _svc.DeleteDiscordBotAsync(id, Actor));

        /// <summary>Reabre el conduit del tenant (app + bot de Twitch) y opcionalmente crea las suscripciones de sus canales.</summary>
        [HttpPost("{id:long}/eventsub/restart")]
        public async Task<IActionResult> RestartEventSub(long id, [FromQuery] bool sync = true) => Map(await _svc.RestartEventSubAsync(id, sync));

        [HttpPost("{id:long}/eventsub/sync")]
        public async Task<IActionResult> SyncEventSub(long id) => Map(await _svc.SyncEventSubAsync(id));
    }
}
