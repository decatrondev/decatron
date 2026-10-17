using System.Text.RegularExpressions;
using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase 4 (paso 4): el dueño carga la app de Twitch de cada tenant. Solo escritura de secretos (nunca se devuelven) y
    /// validación contra Twitch antes de guardar. El tenant #1 no se toca: sigue en modo legacy (appsettings) hasta decidir migrarlo.
    /// </summary>
    [ApiController]
    [Route("api/admin/platform/tenants")]
    [Authorize, RequireSystemOwner]
    public class PlatformTenantsController : ControllerBase
    {
        private static readonly Regex ClientIdRx = new(@"^[a-z0-9]{20,40}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static readonly Regex ScopesRx = new(@"^[a-z0-9:_ ]{0,2000}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private readonly Microsoft.Extensions.Options.IOptions<Decatron.Core.Settings.JwtSettings> _jwt;
        private readonly Decatron.Discord.IDiscordBotValidator _discordValidator;
        private readonly Decatron.Discord.DiscordTenantGateway _gateway;
        private readonly Decatron.Services.Tenancy.TenantEventSubHub _eventSub;
        private readonly Decatron.Services.Tenancy.TenantEventSubSync _eventSubSync;
        private readonly ITenantByoStore _byoStore;
        private readonly IByoKeyValidator _byoValidator;
        private readonly IByoKeys _byoKeys;
        private readonly ITenantCredentialStore _store;
        private readonly ITwitchAppValidator _validator;
        private readonly ICredentialProvider _provider;
        private readonly IConfiguration _config;
        private readonly ILogger<PlatformTenantsController> _log;

        public PlatformTenantsController(ITenantCredentialStore store, ITwitchAppValidator validator, ICredentialProvider provider,
            IConfiguration config, ILogger<PlatformTenantsController> log,
            Microsoft.Extensions.Options.IOptions<Decatron.Core.Settings.JwtSettings> jwt,
            Decatron.Discord.IDiscordBotValidator discordValidator, Decatron.Discord.DiscordTenantGateway gateway,
            Decatron.Services.Tenancy.TenantEventSubHub eventSub, Decatron.Services.Tenancy.TenantEventSubSync eventSubSync,
            ITenantByoStore byoStore, IByoKeyValidator byoValidator, IByoKeys byoKeys)
        {
            _byoStore = byoStore; _byoValidator = byoValidator; _byoKeys = byoKeys;
            _eventSub = eventSub; _eventSubSync = eventSubSync;
            _discordValidator = discordValidator; _gateway = gateway; _jwt = jwt; _store = store; _validator = validator; _provider = provider; _config = config; _log = log;
        }

        public sealed class TwitchAppBody
        {
            public string? ClientId { get; set; }
            public string? ClientSecret { get; set; }
            public string? RedirectUri { get; set; }
            public string? Scopes { get; set; }
        }

        private string Actor => User.FindFirst("login")?.Value ?? User.Identity?.Name ?? "owner";

        private async Task<(long Id, string Slug, string Name, string Status, string Mode)?> FindAsync(long id)
        {
            await using var c = TenantNpgsql.Create(_config.GetConnectionString("DefaultConnection"), 1);
            await c.OpenAsync();
            await using var cmd = new NpgsqlCommand("SELECT id, slug, name, status, credentials_mode FROM tenants WHERE id=@id", c);
            cmd.Parameters.AddWithValue("id", id);
            await using var r = await cmd.ExecuteReaderAsync();
            return await r.ReadAsync() ? (r.GetInt64(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4)) : null;
        }

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
                    discordBot = id == 1 ? null : await _store.GetDiscordBotAsync(id), byo = id == 1 ? null : await ByoSummariesAsync(id), gateway = id == 1 ? null : _gateway.StateOf(id),
                    eventSub = id == 1 ? null : _eventSub.StateOf(id), eventSubSync = id == 1 ? null : _eventSubSync.LastOf(id) });
            return Ok(new { success = true, items, gateways = new { connected = _gateway.Connected, cap = _gateway.Cap, rssMb = System.Diagnostics.Process.GetCurrentProcess().WorkingSet64 / 1048576 } });
        }

        [HttpPut("{id:long}/twitch-app")]
        public async Task<IActionResult> SaveTwitchApp(long id, [FromBody] TwitchAppBody body)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            var tenant = await FindAsync(id);
            if (tenant is null) return NotFound(new { success = false, code = "tenant_not_found" });
            if (tenant.Value.Status != "active") return BadRequest(new { success = false, code = "tenant_not_active" });

            var clientId = body.ClientId?.Trim() ?? "";
            var secret = body.ClientSecret?.Trim() ?? "";
            // Vacio = el callback compartido del dominio canonico (sin redirect_uri el login del tenant no funcionaria)
            var redirect = string.IsNullOrWhiteSpace(body.RedirectUri) ? (_config["Platform:DefaultRedirectUri"] ?? $"https://{tenant.Value.Slug}.{Decatron.Services.Tenancy.TenantResolver.PlatformDomain}/api/auth/callback") : body.RedirectUri.Trim();
            var scopes = string.IsNullOrWhiteSpace(body.Scopes) ? null : body.Scopes.Trim();
            if (!ClientIdRx.IsMatch(clientId)) return BadRequest(new { success = false, code = "invalid_client_id" });
            if (secret.Length < 20 || secret.Length > 100 || secret.Any(char.IsWhiteSpace)) return BadRequest(new { success = false, code = "invalid_client_secret" });
            if (redirect != null && (!Uri.TryCreate(redirect, UriKind.Absolute, out var u) || u.Scheme != Uri.UriSchemeHttps || redirect.Length > 500))
                return BadRequest(new { success = false, code = "invalid_redirect_uri" });
            if (scopes != null && !ScopesRx.IsMatch(scopes)) return BadRequest(new { success = false, code = "invalid_scopes" });

            switch (await _validator.ValidateAsync(clientId, secret))
            {
                case AppValidationResult.InvalidCredentials:
                    return UnprocessableEntity(new { success = false, code = "twitch_rejected" });
                case AppValidationResult.Unreachable:
                    return StatusCode(502, new { success = false, code = "twitch_unreachable" });
            }

            await _store.SaveTwitchAppAsync(id, new TwitchAppInput(clientId, secret, redirect, scopes), Actor);
            _provider.Invalidate(id);
            _log.LogInformation("Plataforma: app de Twitch cargada para el tenant {Tenant} por {Actor}", id, Actor);
            _ = Task.Run(() => _eventSub.StartAsync(id)); // otra app = otro conduit: se reabre (queda en needs_setup si aun no hay bot)
            return Ok(new { success = true, twitchApp = await _store.GetTwitchAppSummaryAsync(id) });
        }

        [HttpDelete("{id:long}/twitch-app")]
        public async Task<IActionResult> DeleteTwitchApp(long id)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            if (await FindAsync(id) is null) return NotFound(new { success = false, code = "tenant_not_found" });
            await _eventSub.StopAsync(id);
            var removed = await _store.DeleteTwitchAppAsync(id, Actor);
            _provider.Invalidate(id);
            _log.LogInformation("Plataforma: app de Twitch borrada del tenant {Tenant} por {Actor}", id, Actor);
            return Ok(new { success = true, removed });
        }
    
        /// <summary>Enlace de un solo proposito (30 min) para que el comprador autorice la cuenta de su bot iniciando sesion en Twitch con ella.</summary>
        [HttpPost("{id:long}/bot-link")]
        public async Task<IActionResult> CreateBotLink(long id)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            var tenant = await FindAsync(id);
            if (tenant is null) return NotFound(new { success = false, code = "tenant_not_found" });
            if (tenant.Value.Status != "active") return BadRequest(new { success = false, code = "tenant_not_active" });
            if (await _store.GetTwitchAppSummaryAsync(id) is null) return BadRequest(new { success = false, code = "app_required" });

            var k = Decatron.Services.AuthService.SignOAuthState("botlink", id, _jwt.Value.SecretKey);
            var baseUrl = (_config["Platform:PublicBaseUrl"] ?? "https://decatron.net").TrimEnd('/');
            var url = $"{baseUrl}/api/auth/login?tenant={Uri.EscapeDataString(tenant.Value.Slug)}&bot=1&k={Uri.EscapeDataString(k)}";
            _log.LogInformation("Plataforma: enlace de autorizacion de bot generado para el tenant {Tenant} por {Actor}", id, Actor);
            return Ok(new { success = true, url, expiresInMinutes = 30 });
        }

        [HttpDelete("{id:long}/bot")]
        public async Task<IActionResult> DeleteBot(long id)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            if (await FindAsync(id) is null) return NotFound(new { success = false, code = "tenant_not_found" });
            await _eventSub.StopAsync(id);
            var removed = await _store.DeleteTwitchBotAsync(id, Actor);
            _provider.Invalidate(id);
            _log.LogInformation("Plataforma: cuenta de bot desvinculada del tenant {Tenant} por {Actor}", id, Actor);
            return Ok(new { success = true, removed });
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

        private async Task<Dictionary<string, ByoKeySummary?>> ByoSummariesAsync(long id)
        {
            var d = new Dictionary<string, ByoKeySummary?>();
            foreach (var p in ByoProviders.All) d[p] = await _byoStore.GetSummaryAsync(id, p);
            return d;
        }

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

        /// <summary>Carga la llave propia del tenant para IA, Deepgram o Fish Audio: se prueba contra el proveedor y se guarda cifrada. Nunca se devuelve.</summary>
        [HttpPut("{id:long}/byo/{provider}")]
        public async Task<IActionResult> SaveByo(long id, string provider, [FromBody] ByoBody body)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            if (!ByoProviders.IsKnown(provider)) return BadRequest(new { success = false, code = "unknown_provider" });
            var tenant = await FindAsync(id);
            if (tenant is null) return NotFound(new { success = false, code = "tenant_not_found" });
            if (tenant.Value.Status != "active") return BadRequest(new { success = false, code = "tenant_not_active" });

            var key = body.ApiKey?.Trim() ?? "";
            var cfg = ByoConfig(provider, body);
            var check = await _byoValidator.ValidateAsync(provider, key, cfg, HttpContext.RequestAborted);
            if (check != ByoCheck.Ok) return ByoFailure(check);

            await _byoStore.SaveAsync(id, provider, key, cfg, Actor);
            _byoKeys.Invalidate(id);
            _log.LogInformation("Plataforma: llave {Provider} cargada para el tenant {Tenant} por {Actor}", provider, id, Actor);
            return Ok(new { success = true, summary = await _byoStore.GetSummaryAsync(id, provider) });
        }

        /// <summary>Vuelve a probar la llave ya guardada (sin gastar créditos del proveedor).</summary>
        [HttpPost("{id:long}/byo/{provider}/test")]
        public async Task<IActionResult> TestByo(long id, string provider)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            if (!ByoProviders.IsKnown(provider)) return BadRequest(new { success = false, code = "unknown_provider" });
            var stored = await _byoStore.GetAsync(id, provider, "admin-test");
            if (stored is null) return NotFound(new { success = false, code = "byo_not_configured" });
            var check = await _byoValidator.ValidateAsync(provider, stored.ApiKey, stored.Config, HttpContext.RequestAborted);
            return check == ByoCheck.Ok ? Ok(new { success = true }) : ByoFailure(check);
        }

        [HttpDelete("{id:long}/byo/{provider}")]
        public async Task<IActionResult> DeleteByo(long id, string provider)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            if (!ByoProviders.IsKnown(provider)) return BadRequest(new { success = false, code = "unknown_provider" });
            var removed = await _byoStore.DeleteAsync(id, provider, Actor);
            _byoKeys.Invalidate(id);
            _log.LogInformation("Plataforma: llave {Provider} quitada del tenant {Tenant} por {Actor}", provider, id, Actor);
            return Ok(new { success = true, removed });
        }

        /// <summary>Carga el bot de Discord del tenant: se valida contra Discord (debe ser un bot), se guarda cifrado y se abre su gateway.</summary>
        [HttpPut("{id:long}/discord-bot")]
        public async Task<IActionResult> SaveDiscordBot(long id, [FromBody] DiscordBotBody body)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            var tenant = await FindAsync(id);
            if (tenant is null) return NotFound(new { success = false, code = "tenant_not_found" });
            if (tenant.Value.Status != "active") return BadRequest(new { success = false, code = "tenant_not_active" });
            var token = body.Token?.Trim() ?? "";
            if (token.Length < 50 || token.Length > 120 || token.Any(char.IsWhiteSpace)) return BadRequest(new { success = false, code = "invalid_discord_token" });

            var who = await _discordValidator.ValidateAsync(token);
            if (who.Result == Decatron.Discord.DiscordTokenCheck.InvalidToken) return UnprocessableEntity(new { success = false, code = "discord_rejected" });
            if (who.Result == Decatron.Discord.DiscordTokenCheck.Unreachable) return StatusCode(502, new { success = false, code = "discord_unreachable" });

            await _store.SaveDiscordBotAsync(id, new DiscordBotInput(token, who.BotId!, who.BotName ?? who.BotId!), Actor);
            _log.LogInformation("Plataforma: bot de Discord {Bot} cargado para el tenant {Tenant} por {Actor}", who.BotName, id, Actor);
            var state = await _gateway.StartAsync(id);
            return Ok(new { success = true, discordBot = await _store.GetDiscordBotAsync(id), gateway = state });
        }

        [HttpPost("{id:long}/discord-bot/restart")]
        public async Task<IActionResult> RestartDiscordBot(long id)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            if (await FindAsync(id) is null) return NotFound(new { success = false, code = "tenant_not_found" });
            return Ok(new { success = true, gateway = await _gateway.StartAsync(id) });
        }

        [HttpDelete("{id:long}/discord-bot")]
        public async Task<IActionResult> DeleteDiscordBot(long id)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            if (await FindAsync(id) is null) return NotFound(new { success = false, code = "tenant_not_found" });
            await _gateway.StopAsync(id);
            var removed = await _store.DeleteDiscordBotAsync(id, Actor);
            _log.LogInformation("Plataforma: bot de Discord quitado del tenant {Tenant} por {Actor}", id, Actor);
            return Ok(new { success = true, removed });
        }

        /// <summary>Reabre el conduit del tenant (app + bot de Twitch) y opcionalmente crea las suscripciones de sus canales.</summary>
        [HttpPost("{id:long}/eventsub/restart")]
        public async Task<IActionResult> RestartEventSub(long id, [FromQuery] bool sync = true)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            if (await FindAsync(id) is null) return NotFound(new { success = false, code = "tenant_not_found" });
            var state = await _eventSub.StartAsync(id);
            Decatron.Services.Tenancy.EventSubSyncResult? result = null;
            if (sync && state.Status == "connected") result = await _eventSubSync.SyncAsync(id);
            return Ok(new { success = true, eventSub = _eventSub.StateOf(id), eventSubSync = result });
        }

        [HttpPost("{id:long}/eventsub/sync")]
        public async Task<IActionResult> SyncEventSub(long id)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            if (await FindAsync(id) is null) return NotFound(new { success = false, code = "tenant_not_found" });
            try { return Ok(new { success = true, eventSubSync = await _eventSubSync.SyncAsync(id) }); }
            catch (InvalidOperationException) { return BadRequest(new { success = false, code = "eventsub_not_connected" }); }
        }
    }
}
