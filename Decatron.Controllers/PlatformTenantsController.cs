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

        private readonly ITenantCredentialStore _store;
        private readonly ITwitchAppValidator _validator;
        private readonly ICredentialProvider _provider;
        private readonly IConfiguration _config;
        private readonly ILogger<PlatformTenantsController> _log;

        public PlatformTenantsController(ITenantCredentialStore store, ITwitchAppValidator validator, ICredentialProvider provider,
            IConfiguration config, ILogger<PlatformTenantsController> log)
        {
            _store = store; _validator = validator; _provider = provider; _config = config; _log = log;
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
                items.Add(new { id, slug, name, status, mode, twitchApp = id == 1 ? null : await _store.GetTwitchAppSummaryAsync(id) });
            return Ok(new { success = true, items });
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
            var redirect = string.IsNullOrWhiteSpace(body.RedirectUri) ? null : body.RedirectUri.Trim();
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
            return Ok(new { success = true, twitchApp = await _store.GetTwitchAppSummaryAsync(id) });
        }

        [HttpDelete("{id:long}/twitch-app")]
        public async Task<IActionResult> DeleteTwitchApp(long id)
        {
            if (id == 1) return BadRequest(new { success = false, code = "tenant_one_legacy" });
            if (await FindAsync(id) is null) return NotFound(new { success = false, code = "tenant_not_found" });
            var removed = await _store.DeleteTwitchAppAsync(id, Actor);
            _provider.Invalidate(id);
            _log.LogInformation("Plataforma: app de Twitch borrada del tenant {Tenant} por {Actor}", id, Actor);
            return Ok(new { success = true, removed });
        }
    }
}
