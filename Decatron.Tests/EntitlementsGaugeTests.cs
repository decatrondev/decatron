using Decatron.Core.Interfaces;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 5.4: <see cref="EntitlementsGauge.CheckNewAsync"/> (tope de comandos/timers al crear).</summary>
public class EntitlementsGaugeTests
{
    private sealed class Ent(decimal? limit, bool operational = true) : IEntitlements
    {
        public Task<bool> IsOperationalAsync(long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(operational);
        public Task<bool> HasAsync(string f, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(true);
        public Task<(bool Operational, decimal? Limit)> LimitAsync(string k, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult((operational, limit));
        public Task<EntitlementResult> TryConsumeAsync(string k, long a = 1, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(EntitlementResult.Ok());
        public Task<EntitlementResult> CheckGaugeAsync(string k, long c, long a = 1, long? t = null, CancellationToken ct = default) =>
            Task.FromResult(!operational || c + a > limit ? new EntitlementResult(EntitlementOutcome.Blocked, c, limit, "limit_reached") : EntitlementResult.Ok(c + a, limit));
        public void Invalidate(long? t = null) { }
    }

    [Fact]
    public async Task TenantUno_PasaSinContar()
    {
        var counted = false;
        var r = await new Ent(0).CheckNewAsync("quota.commands", () => { counted = true; return Task.FromResult(99L); }, 1);
        Assert.True(r.IsAllowed); Assert.False(counted);
    }

    [Fact]
    public async Task SinServicio_NoBloquea() =>
        Assert.True((await ((IEntitlements?)null).CheckNewAsync("quota.commands", () => Task.FromResult(99L), 2)).IsAllowed);

    [Fact]
    public async Task Ilimitado_PasaSinContar()
    {
        var counted = false;
        var r = await new Ent(null).CheckNewAsync("quota.commands", () => { counted = true; return Task.FromResult(99L); }, 2);
        Assert.True(r.IsAllowed); Assert.False(counted);
    }

    [Fact]
    public async Task EnElTope_Bloquea() =>
        Assert.False((await new Ent(5).CheckNewAsync("quota.commands", () => Task.FromResult(5L), 2)).IsAllowed);

    [Fact]
    public async Task BajoElTope_Pasa() =>
        Assert.True((await new Ent(5).CheckNewAsync("quota.commands", () => Task.FromResult(4L), 2)).IsAllowed);

    [Fact]
    public async Task NoOperativo_Bloquea() =>
        Assert.False((await new Ent(5, operational: false).CheckNewAsync("quota.timers", () => Task.FromResult(0L), 2)).IsAllowed);
}
