using System.Text.RegularExpressions;
using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase A (pieza D): el comprador carga SUS credenciales (app y bot de Twitch, bot de Discord, llaves de IA/voz) sin pasar por el dueño.
    /// Mismas reglas y mismos servicios que <see cref="PlatformTenantsController"/>, pero el tenant sale del Host (nunca de la URL) y el acceso exige
    /// ser owner de ese tenant. Los secretos son solo escritura: nunca se devuelven. Ver .dev/plans/plataforma/FASE_A_BC_DISENO.md.
    /// </summary>
    [ApiController]
    [Route("api/platform/buyer")]
    [Authorize, RequireBuyerOwner]
    public class BuyerTenantController : ControllerBase
    {
        private static readonly Regex ClientIdRx = new(@"^[a-z0-9]{20,40}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private readonly Microsoft.Extensions.Options.IOptions<Decatron.Core.Settings.JwtSettings> _jwt;
        private readonly Decatron.Discord.IDiscordBotValidator _discordValidator;
        private readonly Decatron.Discord.DiscordTenantGateway _gateway;
        private readonly Decatron.Services.Tenancy.TenantEventSubHub _eventSub;
        private readonly Decatron.Services.Tenancy.TenantEventSubSync _eventSubSync;
        private readonly ITenantByoStore _byoStore;
        private readonly IByoKeyValidator _byoValidator;
        private readonly IByoKeys _byoKeys;
        private readonly IEntitlements _entitlements;
        private readonly ITenantCredentialStore _store;
        private readonly ITwitchAppValidator _validator;
        private readonly ICredentialProvider _provider;
        private readonly IConfiguration _config;
        private readonly ILogger<BuyerTenantController> _log;

        public BuyerTenantController(ITenantCredentialStore store, ITwitchAppValidator validator, ICredentialProvider provider,
            IConfiguration config, ILogger<BuyerTenantController> log,
            Microsoft.Extensions.Options.IOptions<Decatron.Core.Settings.JwtSettings> jwt,
            Decatron.Discord.IDiscordBotValidator discordValidator, Decatron.Discord.DiscordTenantGateway gateway,
            Decatron.Services.Tenancy.TenantEventSubHub eventSub, Decatron.Services.Tenancy.TenantEventSubSync eventSubSync,
            ITenantByoStore byoStore, IByoKeyValidator byoValidator, IByoKeys byoKeys, IEntitlements entitlements)
        {
            _entitlements = entitlements; _byoStore = byoStore; _byoValidator = byoValidator; _byoKeys = byoKeys;
            _eventSub = eventSub; _eventSubSync = eventSubSync;
            _discordValidator = discordValidator; _gateway = gateway; _jwt = jwt; _store = store; _validator = validator; _provider = provider; _config = config; _log = log;
        }

        /// <summary>Tenant del subdominio. El filtro RequireBuyerOwner ya garantizó que existe y no es el #1.</summary>
        private long Tid => TenantAmbient.Current!.Value;
        private string Actor => "buyer:" + (User.FindFirst("Email")?.Value ?? "?");
        /// <summary>El callback de Twitch vuelve al subdominio del tenant: ahi se guarda la sesion del streamer (cada marca en su propio dominio).</summary>
        private static string SiteOf(string slug) => $"https://{slug}.{Decatron.Services.Tenancy.TenantResolver.PlatformDomain}";
        private static string RedirectFor(string slug) => $"{SiteOf(slug)}/api/auth/callback";

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
            await using var c = TenantNpgsql.Create(_config.GetConnectionString("DefaultConnection"), 1);
            await c.OpenAsync();
            await using var cmd = new NpgsqlCommand("SELECT slug, name, status FROM tenants WHERE id=@id", c);
            cmd.Parameters.AddWithValue("id", Tid);
            await using var r = await cmd.ExecuteReaderAsync();
            return await r.ReadAsync() ? (r.GetString(0), r.GetString(1), r.GetString(2)) : null;
        }

        /// <summary>Las escrituras exigen un tenant activo (uno suspendido solo puede mirar).</summary>
        private async Task<IActionResult?> RequireActiveAsync()
        {
            var t = await TenantAsync();
            if (t is null) return NotFound(new { success = false, code = "tenant_not_found" });
            return t.Value.Status != "active" ? BadRequest(new { success = false, code = "tenant_not_active" }) : null;
        }

        [HttpGet("tenant")]
        public async Task<IActionResult> Get()
        {
            var t = await TenantAsync();
            if (t is null) return NotFound(new { success = false, code = "tenant_not_found" });
            var byo = new Dictionary<string, ByoKeySummary?>();
            var byoAllowed = new Dictionary<string, bool>();
            foreach (var p in ByoProviders.All) { byo[p] = await _byoStore.GetSummaryAsync(Tid, p); byoAllowed[p] = await ByoProviders.AllowedAsync(_entitlements, p, Tid); }
            return Ok(new
            {
                success = true,
                tenant = new { slug = t.Value.Slug, name = t.Value.Name, status = t.Value.Status },
                redirectUri = RedirectFor(t.Value.Slug),
                twitchApp = await _store.GetTwitchAppSummaryAsync(Tid),
                twitchBot = await _store.GetTwitchBotAsync(Tid),
                discordBot = await _store.GetDiscordBotAsync(Tid),
                byo,
                byoAllowed,
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
            if (await RequireActiveAsync() is { } stop) return stop;
            var slug = (await TenantAsync())!.Value.Slug;
            var clientId = body.ClientId?.Trim() ?? "";
            var secret = body.ClientSecret?.Trim() ?? "";
            if (!ClientIdRx.IsMatch(clientId)) return BadRequest(new { success = false, code = "invalid_client_id" });
            if (secret.Length < 20 || secret.Length > 100 || secret.Any(char.IsWhiteSpace)) return BadRequest(new { success = false, code = "invalid_client_secret" });

            switch (await _validator.ValidateAsync(clientId, secret))
            {
                case AppValidationResult.InvalidCredentials: return UnprocessableEntity(new { success = false, code = "twitch_rejected" });
                case AppValidationResult.Unreachable: return StatusCode(502, new { success = false, code = "twitch_unreachable" });
            }

            await _store.SaveTwitchAppAsync(Tid, new TwitchAppInput(clientId, secret, RedirectFor(slug), null), Actor);
            _provider.Invalidate(Tid);
            _log.LogInformation("Plataforma: app de Twitch cargada por el comprador del tenant {Tenant}", Tid);
            var tid = Tid;
            _ = Task.Run(() => _eventSub.StartAsync(tid)); // otra app = otro conduit: se reabre (queda en needs_setup si aun no hay bot)
            return Ok(new { success = true, twitchApp = await _store.GetTwitchAppSummaryAsync(Tid) });
        }

        [HttpDelete("twitch-app")]
        [RequireStepUp]
        public async Task<IActionResult> DeleteTwitchApp()
        {
            await _eventSub.StopAsync(Tid);
            var removed = await _store.DeleteTwitchAppAsync(Tid, Actor);
            _provider.Invalidate(Tid);
            _log.LogInformation("Plataforma: app de Twitch borrada por el comprador del tenant {Tenant}", Tid);
            return Ok(new { success = true, removed });
        }

        /// <summary>Enlace de un solo proposito (30 min) para autorizar la cuenta del bot iniciando sesion en Twitch con ella.</summary>
        [HttpPost("bot-link")]
        [RequireStepUp]
        public async Task<IActionResult> CreateBotLink()
        {
            if (await RequireActiveAsync() is { } stop) return stop;
            if (await _store.GetTwitchAppSummaryAsync(Tid) is null) return BadRequest(new { success = false, code = "app_required" });
            var t = (await TenantAsync())!.Value;
            var k = Decatron.Services.AuthService.SignOAuthState("botlink", Tid, _jwt.Value.SecretKey);
            var url = $"{SiteOf(t.Slug)}/api/auth/login?tenant={Uri.EscapeDataString(t.Slug)}&bot=1&k={Uri.EscapeDataString(k)}";
            _log.LogInformation("Plataforma: enlace de autorizacion de bot generado para el tenant {Tenant}", Tid);
            return Ok(new { success = true, url, expiresInMinutes = 30 });
        }

        [HttpDelete("bot")]
        [RequireStepUp]
        public async Task<IActionResult> DeleteBot()
        {
            await _eventSub.StopAsync(Tid);
            var removed = await _store.DeleteTwitchBotAsync(Tid, Actor);
            _provider.Invalidate(Tid);
            _log.LogInformation("Plataforma: cuenta de bot desvinculada por el comprador del tenant {Tenant}", Tid);
            return Ok(new { success = true, removed });
        }

        [HttpPost("eventsub/restart")]
        public async Task<IActionResult> RestartEventSub([FromQuery] bool sync = true)
        {
            var state = await _eventSub.StartAsync(Tid);
            Decatron.Services.Tenancy.EventSubSyncResult? result = null;
            if (sync && state.Status == "connected") result = await _eventSubSync.SyncAsync(Tid);
            return Ok(new { success = true, eventSub = _eventSub.StateOf(Tid), eventSubSync = result });
        }

        // ── Llaves propias (IA, Deepgram, Fish Audio) ──

        private static Dictionary<string, string> ByoConfig(string provider, ByoBody b)
        {
            var all = new Dictionary<string, string?> { ["base_url"] = b.BaseUrl, ["model"] = b.Model, ["fallback_model"] = b.FallbackModel, ["voices"] = b.Voices };
            var cfg = new Dictionary<string, string>();
            foreach (var k in ByoProviders.ConfigKeys(provider))
                if (!string.IsNullOrWhiteSpace(all[k]) && all[k]!.Length <= 4000) cfg[k] = all[k]!.Trim();
            return cfg;
        }

        private IActionResult ByoFailure(ByoCheck check) => check switch
        {
            ByoCheck.Rejected => UnprocessableEntity(new { success = false, code = "byo_rejected" }),
            ByoCheck.Unreachable => StatusCode(502, new { success = false, code = "byo_unreachable" }),
            _ => BadRequest(new { success = false, code = "invalid_byo" }),
        };

        [HttpPut("byo/{provider}")]
        [RequireStepUp]
        public async Task<IActionResult> SaveByo(string provider, [FromBody] ByoBody body)
        {
            if (!ByoProviders.IsKnown(provider)) return BadRequest(new { success = false, code = "unknown_provider" });
            if (await RequireActiveAsync() is { } stop) return stop;
            // Una llave que el plan no habilita no serviria (IByoKeys la ignora): no se guarda.
            if (!await ByoProviders.AllowedAsync(_entitlements, provider, Tid)) return StatusCode(403, new { success = false, code = "byo_not_in_plan" });
            var key = body.ApiKey?.Trim() ?? "";
            var cfg = ByoConfig(provider, body);
            var check = await _byoValidator.ValidateAsync(provider, key, cfg, HttpContext.RequestAborted);
            if (check != ByoCheck.Ok) return ByoFailure(check);
            await _byoStore.SaveAsync(Tid, provider, key, cfg, Actor);
            _byoKeys.Invalidate(Tid);
            _log.LogInformation("Plataforma: llave {Provider} cargada por el comprador del tenant {Tenant}", provider, Tid);
            return Ok(new { success = true, summary = await _byoStore.GetSummaryAsync(Tid, provider) });
        }

        [HttpPost("byo/{provider}/test")]
        public async Task<IActionResult> TestByo(string provider)
        {
            if (!ByoProviders.IsKnown(provider)) return BadRequest(new { success = false, code = "unknown_provider" });
            var stored = await _byoStore.GetAsync(Tid, provider, "buyer-test");
            if (stored is null) return NotFound(new { success = false, code = "byo_not_configured" });
            var check = await _byoValidator.ValidateAsync(provider, stored.ApiKey, stored.Config, HttpContext.RequestAborted);
            return check == ByoCheck.Ok ? Ok(new { success = true }) : ByoFailure(check);
        }

        [HttpDelete("byo/{provider}")]
        [RequireStepUp]
        public async Task<IActionResult> DeleteByo(string provider)
        {
            if (!ByoProviders.IsKnown(provider)) return BadRequest(new { success = false, code = "unknown_provider" });
            var removed = await _byoStore.DeleteAsync(Tid, provider, Actor);
            _byoKeys.Invalidate(Tid);
            _log.LogInformation("Plataforma: llave {Provider} quitada por el comprador del tenant {Tenant}", provider, Tid);
            return Ok(new { success = true, removed });
        }

        // ── Discord ──

        [HttpPut("discord-bot")]
        [RequireStepUp]
        public async Task<IActionResult> SaveDiscordBot([FromBody] DiscordBotBody body)
        {
            if (await RequireActiveAsync() is { } stop) return stop;
            var token = body.Token?.Trim() ?? "";
            if (token.Length < 50 || token.Length > 120 || token.Any(char.IsWhiteSpace)) return BadRequest(new { success = false, code = "invalid_discord_token" });
            var who = await _discordValidator.ValidateAsync(token);
            if (who.Result == Decatron.Discord.DiscordTokenCheck.InvalidToken) return UnprocessableEntity(new { success = false, code = "discord_rejected" });
            if (who.Result == Decatron.Discord.DiscordTokenCheck.Unreachable) return StatusCode(502, new { success = false, code = "discord_unreachable" });
            await _store.SaveDiscordBotAsync(Tid, new DiscordBotInput(token, who.BotId!, who.BotName ?? who.BotId!), Actor);
            _log.LogInformation("Plataforma: bot de Discord {Bot} cargado por el comprador del tenant {Tenant}", who.BotName, Tid);
            var state = await _gateway.StartAsync(Tid);
            return Ok(new { success = true, discordBot = await _store.GetDiscordBotAsync(Tid), gateway = state });
        }

        [HttpPost("discord-bot/restart")]
        public async Task<IActionResult> RestartDiscordBot() => Ok(new { success = true, gateway = await _gateway.StartAsync(Tid) });

        [HttpDelete("discord-bot")]
        [RequireStepUp]
        public async Task<IActionResult> DeleteDiscordBot()
        {
            await _gateway.StopAsync(Tid);
            var removed = await _store.DeleteDiscordBotAsync(Tid, Actor);
            _log.LogInformation("Plataforma: bot de Discord quitado por el comprador del tenant {Tenant}", Tid);
            return Ok(new { success = true, removed });
        }
    }
}
