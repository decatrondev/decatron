using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 4 (tareas de fondo): el cuerpo corre una vez por tenant, el #1 primero, cada uno con su ambiente y aislado de los fallos de otro.</summary>
public class TenantTaskRunnerTests
{
    private sealed class Store(params long[] ids) : ITenantCredentialStore
    {
        public bool Fail;
        public Task<IReadOnlyList<long>> ListActiveTenantIdsAsync(CancellationToken ct = default)
            => Fail ? throw new InvalidOperationException("db") : Task.FromResult<IReadOnlyList<long>>(ids);
        public Task<TwitchBotTokens?> GetTwitchBotTokensAsync(long t, string p, CancellationToken ct = default) => Task.FromResult<TwitchBotTokens?>(null);
        public Task UpdateTwitchBotTokensAsync(long t, TwitchBotTokens k, CancellationToken ct = default) => Task.CompletedTask;
        public Task<TwitchAppCredentials?> GetTwitchAppAsync(long t, CancellationToken ct = default) => Task.FromResult<TwitchAppCredentials?>(null);
        public Task<TwitchAppSummary?> GetTwitchAppSummaryAsync(long t, CancellationToken ct = default) => Task.FromResult<TwitchAppSummary?>(null);
        public Task SaveTwitchAppAsync(long t, TwitchAppInput i, string a, CancellationToken ct = default) => Task.CompletedTask;
        public Task<bool> DeleteTwitchAppAsync(long t, string a, CancellationToken ct = default) => Task.FromResult(false);
        public Task SaveTwitchBotAsync(long t, TwitchBotInput i, string a, CancellationToken ct = default) => Task.CompletedTask;
        public Task<TwitchBotSummary?> GetTwitchBotAsync(long t, CancellationToken ct = default) => Task.FromResult<TwitchBotSummary?>(null);
        public Task<bool> DeleteTwitchBotAsync(long t, string a, CancellationToken ct = default) => Task.FromResult(false);
        public Task SaveDiscordBotAsync(long t, DiscordBotInput i, string a, CancellationToken ct = default) => Task.CompletedTask;
        public Task<DiscordBotSummary?> GetDiscordBotAsync(long t, CancellationToken ct = default) => Task.FromResult<DiscordBotSummary?>(null);
        public Task<string?> GetDiscordBotTokenAsync(long t, string p, CancellationToken ct = default) => Task.FromResult<string?>(null);
        public Task<bool> DeleteDiscordBotAsync(long t, string a, CancellationToken ct = default) => Task.FromResult(false);
        public Task<long?> FindActiveTenantIdAsync(string slug, CancellationToken ct = default) => Task.FromResult<long?>(null);
    }

    private sealed class Ops(params long[] ok) : IEntitlements
    {
        public bool Down;
        public Task<bool> IsOperationalAsync(long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(Down ? live : ok.Contains(t ?? 1));
        public Task<bool> HasAsync(string f, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(true);
        public Task<(bool Operational, decimal? Limit)> LimitAsync(string k, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult((true, (decimal?)null));
        public Task<EntitlementResult> TryConsumeAsync(string k, long a = 1, long? t = null, bool live = false, CancellationToken ct = default) => Task.FromResult(EntitlementResult.Ok());
        public Task<EntitlementResult> CheckGaugeAsync(string k, long c, long a = 1, long? t = null, CancellationToken ct = default) => Task.FromResult(EntitlementResult.Ok());
        public void Invalidate(long? t = null) { }
    }

    [Fact(DisplayName = "Fase 5.5: un tenant suspendido o vencido no corre tareas; el #1 siempre; con la base de planes caída se deja correr")]
    public async Task SuspendidoNoCorreTareas()
    {
        var ops = new Ops(2, 4);
        var runner = new TenantTaskRunner(NullLogger<TenantTaskRunner>.Instance, new Store(2, 3, 4), ops);
        Assert.Equal(new long[] { 1, 2, 4 }, await runner.GetTenantsAsync());

        ops.Down = true;
        var runner2 = new TenantTaskRunner(NullLogger<TenantTaskRunner>.Instance, new Store(2, 3, 4), ops);
        Assert.Equal(new long[] { 1, 2, 3, 4 }, await runner2.GetTenantsAsync());
    }

    private static TenantTaskRunner Make(Store? s = null) => new(NullLogger<TenantTaskRunner>.Instance, s);

    [Fact]
    public async Task SinAlmacenSoloCorreElUno()
    {
        var seen = new List<(long arg, long? ambient)>();
        await Make().ForEachTenantAsync("t", t => { seen.Add((t, TenantAmbient.Current)); return Task.CompletedTask; });
        Assert.Equal(new (long, long?)[] { (1, 1) }, seen);
        Assert.Null(TenantAmbient.Current); // el ambiente se restaura
    }

    [Fact]
    public async Task CorreElUnoPrimeroYCadaTenantConSuAmbiente()
    {
        var seen = new List<(long arg, long? ambient)>();
        await Make(new Store(5, 2, 1)).ForEachTenantAsync("t", async t => { await Task.Yield(); seen.Add((t, TenantAmbient.Current)); });
        Assert.Equal(new (long, long?)[] { (1, 1), (2, 2), (5, 5) }, seen);
    }

    [Fact]
    public async Task ElFalloDeUnTenantNoFrenaALosDemas()
    {
        var ran = new List<long>();
        await Make(new Store(2, 3)).ForEachTenantAsync("t", t => { ran.Add(t); if (t == 2) throw new InvalidOperationException("x"); return Task.CompletedTask; });
        Assert.Equal(new long[] { 1, 2, 3 }, ran);
    }

    [Fact]
    public async Task ElErrorDelUnoSeRelanzaAlFinalSinFrenarALosDemas()
    {
        var ran = new List<long>();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => Make(new Store(2)).ForEachTenantAsync("t", t => { ran.Add(t); if (t == 1) throw new InvalidOperationException("uno"); return Task.CompletedTask; }));
        Assert.Equal("uno", ex.Message);
        Assert.Equal(new long[] { 1, 2 }, ran);
    }

    [Fact]
    public async Task SiElAlmacenFallaSeConservaLaUltimaLista()
    {
        var s = new Store(2); var r = Make(s);
        Assert.Equal(new long[] { 1, 2 }, await r.GetTenantsAsync());
        s.Fail = true;
        var r2 = Make(s); // lista nueva sin historial: cae a solo el #1
        Assert.Equal(new long[] { 1 }, await r2.GetTenantsAsync());
    }

    [Fact]
    public async Task CancelarDetieneSinEjecutar()
    {
        using var cts = new CancellationTokenSource(); cts.Cancel();
        var ran = 0;
        await Make(new Store(2)).ForEachTenantAsync("t", _ => { ran++; return Task.CompletedTask; }, cts.Token);
        Assert.Equal(0, ran);
    }
}
