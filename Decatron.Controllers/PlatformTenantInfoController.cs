using Decatron.Attributes;
using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace Decatron.Controllers
{
    /// <summary>
    /// Plataforma, Fase A (pieza E y transparencia): lo que el subdominio de un tenant muestra de sí mismo (marca = nombre) y lo que el comprador
    /// ve sobre los permisos de Twitch que pide la plataforma y lo que incluye su plan. El tenant sale siempre del Host.
    /// </summary>
    [ApiController]
    public class PlatformTenantInfoController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly ITenantCredentialStore _store;
        private readonly IEntitlements _ent;
        private readonly TenantPlanAdmin _plans;

        public PlatformTenantInfoController(IConfiguration config, ITenantCredentialStore store, IEntitlements ent, TenantPlanAdmin plans)
        { _config = config; _store = store; _ent = ent; _plans = plans; }

        private static object ScopeRow(TwitchScopeCatalog.Entry e) => new { scope = e.Scope, module = e.Module, es = e.Es, en = e.En };

        /// <summary>Datos públicos del subdominio para el login del streamer: nombre, si ya tiene app de Twitch y qué permisos se pedirán.</summary>
        [HttpGet("api/platform/tenant-info")]
        [AllowAnonymous]
        public async Task<IActionResult> Info()
        {
            var tid = TenantAmbient.Current;
            if (tid is null or 1) return NotFound(new { success = false, code = "not_a_tenant_host" });

            string? name = null, status = null;
            await using (var c = TenantNpgsql.Create(_config.GetConnectionString("DefaultConnection"), 1))
            {
                await c.OpenAsync();
                await using var cmd = new NpgsqlCommand("SELECT name, status FROM tenants WHERE id=@id", c);
                cmd.Parameters.AddWithValue("id", tid.Value);
                await using var r = await cmd.ExecuteReaderAsync();
                if (await r.ReadAsync()) { name = r.GetString(0); status = r.GetString(1); }
            }
            if (name is null) return NotFound(new { success = false, code = "tenant_not_found" });

            var app = await _store.GetTwitchAppSummaryAsync(tid.Value);
            return Ok(new
            {
                success = true,
                name,
                active = status == "active",
                twitchReady = app is { Status: "ok" },
                scopes = TwitchScopeCatalog.Streamer.Select(ScopeRow),
            });
        }

        /// <summary>Panel del comprador: permisos de Twitch con su motivo y módulo, plan actual, qué incluye y cuánto se ha usado.</summary>
        [HttpGet("api/platform/buyer/transparency")]
        [Authorize, RequireBuyerOwner]
        public async Task<IActionResult> Transparency()
        {
            var tid = TenantAmbient.Current!.Value;
            var rows = new List<(string Key, string Kind, string Group, string Description, string? Unit)>();
            await using (var c = TenantNpgsql.Create(_config.GetConnectionString("DefaultConnection"), 1))
            {
                await c.OpenAsync();
                await using var cmd = new NpgsqlCommand("SELECT key, kind, group_key, description, unit FROM capabilities WHERE active ORDER BY sort, key", c);
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync()) rows.Add((r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3), r.IsDBNull(4) ? null : r.GetString(4)));
            }
            var caps = new List<object>();
            var included = new HashSet<string>();
            foreach (var (key, kind, group, description, unit) in rows)
            {
                if (kind == "quota")
                {
                    var (_, limit) = await _ent.LimitAsync(key, tid, live: true);
                    caps.Add(new { key, kind, group, description, unit, included = true, limit });
                }
                else
                {
                    var has = await _ent.HasAsync(key, tid, live: true);
                    if (has) included.Add(key);
                    caps.Add(new { key, kind, group, description, unit, included = has, limit = (decimal?)null });
                }
            }
            var plan = await _plans.GetAsync(tid);
            object Row(TwitchScopeCatalog.Entry e) => new { scope = e.Scope, module = e.Module, es = e.Es, en = e.En, moduleIncluded = e.Module is null || included.Contains(e.Module) };

            return Ok(new
            {
                success = true,
                plan = plan.Data,
                capabilities = caps,
                scopes = new
                {
                    streamer = TwitchScopeCatalog.Streamer.Select(Row),
                    bot = TwitchScopeCatalog.Bot.Select(Row),
                    moderation = TwitchScopeCatalog.Moderation.Select(Row),
                },
            });
        }
    }
}
