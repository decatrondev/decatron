using System.Text.RegularExpressions;
using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Npgsql;

namespace Decatron.Controllers
{
    public sealed record TwitchAppRequest(string? ClientId, string? ClientSecret, string? RedirectUri, string? Scopes);
    public sealed record ByoRequest(string? ApiKey, string? BaseUrl, string? Model, string? FallbackModel, string? Voices);

    /// <summary>
    /// Plataforma: las acciones sobre las credenciales de un tenant (app y bot de Twitch, llaves propias, bot de Discord, EventSub), con una sola
    /// copia de las reglas. Las usan el panel del dueño (<see cref="PlatformTenantsController"/>, tenant por URL) y el del comprador
    /// (<see cref="BuyerTenantController"/>, tenant por Host): cada controlador decide quién puede llamar y de dónde sale el tenant; aquí vive
    /// lo que se valida, se guarda y se registra. El tenant #1 nunca se toca (modo legacy). Los secretos son solo de escritura.
    /// </summary>
    public sealed class TenantCredentialsService
    {
        private static readonly Regex ClientIdRx = new(@"^[a-z0-9]{20,40}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static readonly Regex ScopesRx = new(@"^[a-z0-9:_ ]{0,2000}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private readonly Microsoft.Extensions.Options.IOptions<Decatron.Core.Settings.JwtSettings> _jwt;
        private readonly Decatron.Discord.IDiscordBotValidator _discordValidator;
        private readonly Decatron.Discord.DiscordTenantGateway _gateway;
        private readonly TenantEventSubHub _eventSub;
        private readonly TenantEventSubSync _eventSubSync;
        private readonly ITenantByoStore _byoStore;
        private readonly IByoKeyValidator _byoValidator;
        private readonly IByoKeys _byoKeys;
        private readonly IEntitlements _entitlements;
        private readonly ITenantCredentialStore _store;
        private readonly ITwitchAppValidator _validator;
        private readonly ICredentialProvider _provider;
        private readonly IConfiguration _config;
        private readonly ILogger<TenantCredentialsService> _log;

        public TenantCredentialsService(ITenantCredentialStore store, ITwitchAppValidator validator, ICredentialProvider provider, IConfiguration config,
            ILogger<TenantCredentialsService> log, Microsoft.Extensions.Options.IOptions<Decatron.Core.Settings.JwtSettings> jwt,
            Decatron.Discord.IDiscordBotValidator discordValidator, Decatron.Discord.DiscordTenantGateway gateway,
            TenantEventSubHub eventSub, TenantEventSubSync eventSubSync, ITenantByoStore byoStore, IByoKeyValidator byoValidator, IByoKeys byoKeys,
            IEntitlements entitlements)
        {
            _store = store; _validator = validator; _provider = provider; _config = config; _log = log; _jwt = jwt;
            _discordValidator = discordValidator; _gateway = gateway; _eventSub = eventSub; _eventSubSync = eventSubSync;
            _byoStore = byoStore; _byoValidator = byoValidator; _byoKeys = byoKeys; _entitlements = entitlements;
        }

        public sealed record TenantRow(long Id, string Slug, string Name, string Status, string Mode);

        public async Task<TenantRow?> FindAsync(long id)
        {
            await using var c = TenantNpgsql.Create(_config.GetConnectionString("DefaultConnection"), 1);
            await c.OpenAsync();
            await using var cmd = new NpgsqlCommand("SELECT id, slug, name, status, credentials_mode FROM tenants WHERE id=@id", c);
            cmd.Parameters.AddWithValue("id", id);
            await using var r = await cmd.ExecuteReaderAsync();
            return await r.ReadAsync() ? new TenantRow(r.GetInt64(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4)) : null;
        }

        /// <summary>El tenant existe y no es el #1 (y, si <paramref name="mustBeActive"/>, está activo). Falla con el código que ven los dos paneles.</summary>
        private async Task<(TenantRow? Tenant, PlanResult? Error)> RequireAsync(long id, bool mustBeActive)
        {
            if (id == 1) return (null, PlanResult.Fail(400, "tenant_one_legacy"));
            var t = await FindAsync(id);
            if (t is null) return (null, PlanResult.Fail(404, "tenant_not_found"));
            if (mustBeActive && t.Status != "active") return (null, PlanResult.Fail(400, "tenant_not_active"));
            return (t, null);
        }

        // ── Twitch ──

        /// <summary>Guarda la app de Twitch del tenant tras validarla contra Twitch. Un tenant sin redirección propia usa la de la plataforma.</summary>
        public async Task<PlanResult> SaveTwitchAppAsync(long id, TwitchAppRequest body, string actor)
        {
            var (tenant, error) = await RequireAsync(id, mustBeActive: true);
            if (error is { } e) return e;

            var clientId = body.ClientId?.Trim() ?? "";
            var secret = body.ClientSecret?.Trim() ?? "";
            var redirect = string.IsNullOrWhiteSpace(body.RedirectUri)
                ? (_config["Platform:DefaultRedirectUri"] ?? $"https://{tenant!.Slug}.{TenantResolver.PlatformDomain}/api/auth/callback")
                : body.RedirectUri.Trim();
            var scopes = string.IsNullOrWhiteSpace(body.Scopes) ? null : body.Scopes.Trim();
            if (!ClientIdRx.IsMatch(clientId)) return PlanResult.Fail(400, "invalid_client_id");
            if (secret.Length < 20 || secret.Length > 100 || secret.Any(char.IsWhiteSpace)) return PlanResult.Fail(400, "invalid_client_secret");
            if (!Uri.TryCreate(redirect, UriKind.Absolute, out var u) || u.Scheme != Uri.UriSchemeHttps || redirect.Length > 500) return PlanResult.Fail(400, "invalid_redirect_uri");
            if (scopes != null && !ScopesRx.IsMatch(scopes)) return PlanResult.Fail(400, "invalid_scopes");

            switch (await _validator.ValidateAsync(clientId, secret))
            {
                case AppValidationResult.InvalidCredentials: return PlanResult.Fail(422, "twitch_rejected");
                case AppValidationResult.Unreachable: return PlanResult.Fail(502, "twitch_unreachable");
            }

            await _store.SaveTwitchAppAsync(id, new TwitchAppInput(clientId, secret, redirect, scopes), actor);
            _provider.Invalidate(id);
            _log.LogInformation("Plataforma: app de Twitch cargada para el tenant {Tenant} por {Actor}", id, actor);
            _ = Task.Run(() => _eventSub.StartAsync(id)); // otra app = otro conduit: se reabre (queda en needs_setup si aun no hay bot)
            return PlanResult.Success(new { success = true, twitchApp = await _store.GetTwitchAppSummaryAsync(id) });
        }

        public async Task<PlanResult> DeleteTwitchAppAsync(long id, string actor)
        {
            var (_, error) = await RequireAsync(id, mustBeActive: false);
            if (error is { } e) return e;
            await _eventSub.StopAsync(id);
            var removed = await _store.DeleteTwitchAppAsync(id, actor);
            _provider.Invalidate(id);
            _log.LogInformation("Plataforma: app de Twitch borrada del tenant {Tenant} por {Actor}", id, actor);
            return PlanResult.Success(new { success = true, removed });
        }

        /// <summary>Enlace de un solo propósito (30 min) para autorizar la cuenta del bot iniciando sesión en Twitch con ella. <paramref name="baseUrl"/> es el sitio donde se abre.</summary>
        public async Task<PlanResult> CreateBotLinkAsync(long id, string baseUrl, string actor)
        {
            var (tenant, error) = await RequireAsync(id, mustBeActive: true);
            if (error is { } e) return e;
            if (await _store.GetTwitchAppSummaryAsync(id) is null) return PlanResult.Fail(400, "app_required");
            var k = Decatron.Services.AuthService.SignOAuthState("botlink", id, _jwt.Value.SecretKey);
            var url = $"{baseUrl.TrimEnd('/')}/api/auth/login?tenant={Uri.EscapeDataString(tenant!.Slug)}&bot=1&k={Uri.EscapeDataString(k)}";
            _log.LogInformation("Plataforma: enlace de autorizacion de bot generado para el tenant {Tenant} por {Actor}", id, actor);
            return PlanResult.Success(new { success = true, url, expiresInMinutes = 30 });
        }

        public async Task<PlanResult> DeleteBotAsync(long id, string actor)
        {
            var (_, error) = await RequireAsync(id, mustBeActive: false);
            if (error is { } e) return e;
            await _eventSub.StopAsync(id);
            var removed = await _store.DeleteTwitchBotAsync(id, actor);
            _provider.Invalidate(id);
            _log.LogInformation("Plataforma: cuenta de bot desvinculada del tenant {Tenant} por {Actor}", id, actor);
            return PlanResult.Success(new { success = true, removed });
        }

        // ── EventSub ──

        /// <summary>Reabre el conduit del tenant (app + bot de Twitch) y, si se pide, crea las suscripciones de sus canales.</summary>
        public async Task<PlanResult> RestartEventSubAsync(long id, bool sync)
        {
            var (_, error) = await RequireAsync(id, mustBeActive: false);
            if (error is { } e) return e;
            var state = await _eventSub.StartAsync(id);
            EventSubSyncResult? result = null;
            if (sync && state.Status == "connected") result = await _eventSubSync.SyncAsync(id);
            return PlanResult.Success(new { success = true, eventSub = _eventSub.StateOf(id), eventSubSync = result });
        }

        public async Task<PlanResult> SyncEventSubAsync(long id)
        {
            var (_, error) = await RequireAsync(id, mustBeActive: false);
            if (error is { } e) return e;
            try { return PlanResult.Success(new { success = true, eventSubSync = await _eventSubSync.SyncAsync(id) }); }
            catch (InvalidOperationException) { return PlanResult.Fail(400, "eventsub_not_connected"); }
        }

        // ── Llaves propias (IA, Deepgram, Fish Audio) ──

        public async Task<Dictionary<string, ByoKeySummary?>> ByoSummariesAsync(long id)
        {
            var d = new Dictionary<string, ByoKeySummary?>();
            foreach (var p in ByoProviders.All) d[p] = await _byoStore.GetSummaryAsync(id, p);
            return d;
        }

        /// <summary>Qué proveedores incluye el plan del tenant (para que el panel explique los que no).</summary>
        public async Task<Dictionary<string, bool>> ByoAllowedAsync(long id)
        {
            var d = new Dictionary<string, bool>();
            foreach (var p in ByoProviders.All) d[p] = await ByoProviders.AllowedAsync(_entitlements, p, id);
            return d;
        }

        private static Dictionary<string, string> ByoConfig(string provider, ByoRequest b)
        {
            var all = new Dictionary<string, string?> { ["base_url"] = b.BaseUrl, ["model"] = b.Model, ["fallback_model"] = b.FallbackModel, ["voices"] = b.Voices };
            var cfg = new Dictionary<string, string>();
            foreach (var k in ByoProviders.ConfigKeys(provider))
                if (!string.IsNullOrWhiteSpace(all[k]) && all[k]!.Length <= 4000) cfg[k] = all[k]!.Trim();
            return cfg;
        }

        private static PlanResult ByoFailure(ByoCheck check) => check switch
        {
            ByoCheck.Rejected => PlanResult.Fail(422, "byo_rejected"),
            ByoCheck.Unreachable => PlanResult.Fail(502, "byo_unreachable"),
            _ => PlanResult.Fail(400, "invalid_byo"),
        };

        /// <summary>Prueba la llave contra el proveedor y la guarda cifrada. <paramref name="enforcePlan"/>: el comprador no puede guardar una llave que su plan no habilita (no serviría: IByoKeys la ignora); el dueño sí puede.</summary>
        public async Task<PlanResult> SaveByoAsync(long id, string provider, ByoRequest body, string actor, bool enforcePlan, CancellationToken ct = default)
        {
            var (_, error) = await RequireAsync(id, mustBeActive: true);
            if (error is { } e) return e;
            if (!ByoProviders.IsKnown(provider)) return PlanResult.Fail(400, "unknown_provider");
            if (enforcePlan && !await ByoProviders.AllowedAsync(_entitlements, provider, id, ct)) return PlanResult.Fail(403, "byo_not_in_plan");

            var key = body.ApiKey?.Trim() ?? "";
            var cfg = ByoConfig(provider, body);
            var check = await _byoValidator.ValidateAsync(provider, key, cfg, ct);
            if (check != ByoCheck.Ok) return ByoFailure(check);

            await _byoStore.SaveAsync(id, provider, key, cfg, actor);
            _byoKeys.Invalidate(id);
            _log.LogInformation("Plataforma: llave {Provider} cargada para el tenant {Tenant} por {Actor}", provider, id, actor);
            return PlanResult.Success(new { success = true, summary = await _byoStore.GetSummaryAsync(id, provider) });
        }

        /// <summary>Vuelve a probar la llave ya guardada. <paramref name="purpose"/> queda en la auditoría de lectura.</summary>
        public async Task<PlanResult> TestByoAsync(long id, string provider, string purpose, CancellationToken ct = default)
        {
            var (_, error) = await RequireAsync(id, mustBeActive: false);
            if (error is { } e) return e;
            if (!ByoProviders.IsKnown(provider)) return PlanResult.Fail(400, "unknown_provider");
            var stored = await _byoStore.GetAsync(id, provider, purpose);
            if (stored is null) return PlanResult.Fail(404, "byo_not_configured");
            var check = await _byoValidator.ValidateAsync(provider, stored.ApiKey, stored.Config, ct);
            return check == ByoCheck.Ok ? PlanResult.Success(new { success = true }) : ByoFailure(check);
        }

        public async Task<PlanResult> DeleteByoAsync(long id, string provider, string actor)
        {
            var (_, error) = await RequireAsync(id, mustBeActive: false);
            if (error is { } e) return e;
            if (!ByoProviders.IsKnown(provider)) return PlanResult.Fail(400, "unknown_provider");
            var removed = await _byoStore.DeleteAsync(id, provider, actor);
            _byoKeys.Invalidate(id);
            _log.LogInformation("Plataforma: llave {Provider} quitada del tenant {Tenant} por {Actor}", provider, id, actor);
            return PlanResult.Success(new { success = true, removed });
        }

        // ── Discord ──

        /// <summary>Valida el token contra Discord (debe ser un bot), lo guarda cifrado y abre el gateway del tenant.</summary>
        public async Task<PlanResult> SaveDiscordBotAsync(long id, string? rawToken, string actor)
        {
            var (_, error) = await RequireAsync(id, mustBeActive: true);
            if (error is { } e) return e;
            var token = rawToken?.Trim() ?? "";
            if (token.Length < 50 || token.Length > 120 || token.Any(char.IsWhiteSpace)) return PlanResult.Fail(400, "invalid_discord_token");

            var who = await _discordValidator.ValidateAsync(token);
            if (who.Result == Decatron.Discord.DiscordTokenCheck.InvalidToken) return PlanResult.Fail(422, "discord_rejected");
            if (who.Result == Decatron.Discord.DiscordTokenCheck.Unreachable) return PlanResult.Fail(502, "discord_unreachable");

            await _store.SaveDiscordBotAsync(id, new DiscordBotInput(token, who.BotId!, who.BotName ?? who.BotId!), actor);
            _log.LogInformation("Plataforma: bot de Discord {Bot} cargado para el tenant {Tenant} por {Actor}", who.BotName, id, actor);
            var state = await _gateway.StartAsync(id);
            return PlanResult.Success(new { success = true, discordBot = await _store.GetDiscordBotAsync(id), gateway = state });
        }

        public async Task<PlanResult> RestartDiscordBotAsync(long id)
        {
            var (_, error) = await RequireAsync(id, mustBeActive: false);
            if (error is { } e) return e;
            return PlanResult.Success(new { success = true, gateway = await _gateway.StartAsync(id) });
        }

        public async Task<PlanResult> DeleteDiscordBotAsync(long id, string actor)
        {
            var (_, error) = await RequireAsync(id, mustBeActive: false);
            if (error is { } e) return e;
            await _gateway.StopAsync(id);
            var removed = await _store.DeleteDiscordBotAsync(id, actor);
            _log.LogInformation("Plataforma: bot de Discord quitado del tenant {Tenant} por {Actor}", id, actor);
            return PlanResult.Success(new { success = true, removed });
        }
    }
}
