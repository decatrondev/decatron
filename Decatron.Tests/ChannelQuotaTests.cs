using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 5.4: el login de una cuenta nueva respeta quota.channels; las cuentas que ya son canal del tenant y el tenant 1 no se ven afectados.</summary>
public class ChannelQuotaTests
{
    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");

    private sealed class FakeEntitlements(long limit) : IEntitlements
    {
        public int GaugeCalls;
        public Task<bool> IsOperationalAsync(long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> HasAsync(string f, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(true);
        public Task<(bool Operational, decimal? Limit)> LimitAsync(string k, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult((true, (decimal?)limit));
        public Task<EntitlementResult> TryConsumeAsync(string k, long a = 1, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(EntitlementResult.Ok());
        public Task<EntitlementResult> CheckGaugeAsync(string key, long current, long adding = 1, long? tenantId = null, CancellationToken ct = default)
        {
            GaugeCalls++;
            return Task.FromResult(current + adding > limit ? new EntitlementResult(EntitlementOutcome.Blocked, current, limit, "limit_reached") : EntitlementResult.Ok(current + adding, limit));
        }
        public void Invalidate(long? t = null) { }
    }

    [Fact(DisplayName = "Cuenta nueva: entra si cabe, se rechaza si el plan está lleno; una cuenta que ya es canal siempre pasa; el #1 no consulta nada")]
    public async Task TopeDeCanales()
    {
        if (string.IsNullOrWhiteSpace(App)) return;
        await using var c = TenantNpgsql.Create(App, 1); await c.OpenAsync();
        if ((string)(await new NpgsqlCommand("select current_database()", c).ExecuteScalarAsync())! != "decatron_schema") return;
        if ((long)(await new NpgsqlCommand("select count(*) from tenants where id in (9101,9102)", c).ExecuteScalarAsync())! != 2) return;
        const long uid = 990102; const string tw = "zz-tw-990102";
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = App }).Build();
        try
        {
            await new NpgsqlCommand($@"insert into users (id, twitch_id, login, display_name, email, profile_image_url, offline_image_url, broadcaster_type, view_count, description,
                access_token, refresh_token, token_expiration, created_at, updated_at, is_active, unique_id)
                values ({uid}, '{tw}', 'zzquota', 'Z', '', '', '', '', 0, '', 'a', 'b', now(), now(), now(), true, 'zz-uid-990102')", c).ExecuteNonQueryAsync();
            var hoy = (long)(await new NpgsqlCommand("select count(*) from channels where tenant_id=9102 and platform='twitch'", c).ExecuteScalarAsync())!;

            var lleno = new FakeEntitlements(hoy);      // el plan ya está usado por completo
            var m = new TenantMembership(cfg, null, lleno);
            var r = await m.ChannelQuotaAsync(tw, 9102);
            Assert.False(r.IsAllowed);
            Assert.Equal("limit_reached", r.Reason);

            var conCupo = new FakeEntitlements(hoy + 1);
            m = new TenantMembership(cfg, null, conCupo);
            Assert.True((await m.ChannelQuotaAsync(tw, 9102)).IsAllowed);

            await m.EnsureChannelAsync(9102, uid, tw, "ZZQuota");
            var otraVezLleno = new TenantMembership(cfg, null, new FakeEntitlements(0));
            Assert.True((await otraVezLleno.ChannelQuotaAsync(tw, 9102)).IsAllowed);  // ya es canal del tenant: no suma

            var uno = new FakeEntitlements(0);
            Assert.True((await new TenantMembership(cfg, null, uno).ChannelQuotaAsync("cualquiera", 1)).IsAllowed);
            Assert.Equal(0, uno.GaugeCalls);                                          // el #1 no pregunta
        }
        finally
        {
            foreach (var sql in new[] { $"delete from tenant_members where user_id={uid}", $"delete from channels where user_id={uid}", $"delete from users where id={uid}" })
                await new NpgsqlCommand(sql, c).ExecuteNonQueryAsync();
        }
    }
}
