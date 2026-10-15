using System.Collections.Concurrent;
using Decatron.Core.Interfaces;
using Decatron.Services;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 4 (paso 6a.1): el envio de chat conserva el tenant de quien lo pidio y un tenant sin bot propio no usa el del #1.</summary>
public class MessageSenderTenantTests
{
    private sealed class NoBot : IBotAccountProvider { public Task<BotAccount?> GetAsync(CancellationToken ct = default) => Task.FromResult<BotAccount?>(null); }

    private static IConfiguration Cfg() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["TwitchSettings:ClientId"] = "uno" }).Build();

    [Fact]
    public void LaColaGuardaElTenantDeQuienEncola()
    {
        var sender = new MessageSenderService(NullLogger<MessageSenderService>.Instance, new HttpClient(), new CredentialProvider(Cfg()), new NoBot(), new ServiceCollection().BuildServiceProvider());
        // Se detiene el consumidor para inspeccionar la cola sin que la vacie
        var cts = (CancellationTokenSource)typeof(MessageSenderService).GetField("_cancellationTokenSource", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!.GetValue(sender)!;
        cts.Cancel(); Thread.Sleep(300);
        using (TenantAmbient.Push(5)) sender.SendMessage("canal", "hola");
        sender.SendMessage("canal2", "uno");
        var q = (ConcurrentQueue<(long tenantId, string channel, string message)>)typeof(MessageSenderService).GetField("_messageQueue", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!.GetValue(sender)!;
        var items = q.ToArray();
        Assert.Contains(items, i => i.channel == "canal" && i.tenantId == 5);
        Assert.Contains(items, i => i.channel == "canal2" && i.tenantId == 1);
    }

    [Fact]
    public async Task TenantSinBotPropioNoUsaElDelUno()
    {
        var p = new BotAccountProvider(new ServiceCollection().BuildServiceProvider(), new CredentialProvider(Cfg()), NullLogger<BotAccountProvider>.Instance);
        using var _ = TenantAmbient.Push(2);
        Assert.Null(await p.GetAsync());
    }
}

public class TenantEventSubHubTests
{
    private sealed class EmptyStore : ITenantCredentialStore
    {
        public Task<TwitchAppCredentials?> GetTwitchAppAsync(long t, CancellationToken ct = default) => Task.FromResult<TwitchAppCredentials?>(null);
        public Task<TwitchAppSummary?> GetTwitchAppSummaryAsync(long t, CancellationToken ct = default) => Task.FromResult<TwitchAppSummary?>(null);
        public Task SaveTwitchAppAsync(long t, TwitchAppInput i, string a, CancellationToken ct = default) => Task.CompletedTask;
        public Task<bool> DeleteTwitchAppAsync(long t, string a, CancellationToken ct = default) => Task.FromResult(false);
        public Task SaveTwitchBotAsync(long t, TwitchBotInput i, string a, CancellationToken ct = default) => Task.CompletedTask;
        public Task<TwitchBotSummary?> GetTwitchBotAsync(long t, CancellationToken ct = default) => Task.FromResult<TwitchBotSummary?>(null);
        public Task<bool> DeleteTwitchBotAsync(long t, string a, CancellationToken ct = default) => Task.FromResult(false);
        public Task<TwitchBotTokens?> GetTwitchBotTokensAsync(long t, string p, CancellationToken ct = default) => Task.FromResult<TwitchBotTokens?>(null);
        public Task UpdateTwitchBotTokensAsync(long t, TwitchBotTokens k, CancellationToken ct = default) => Task.CompletedTask;
        public Task SaveDiscordBotAsync(long t, DiscordBotInput i, string a, CancellationToken ct = default) => Task.CompletedTask;
        public Task<DiscordBotSummary?> GetDiscordBotAsync(long t, CancellationToken ct = default) => Task.FromResult<DiscordBotSummary?>(null);
        public Task<string?> GetDiscordBotTokenAsync(long t, string p, CancellationToken ct = default) => Task.FromResult<string?>(null);
        public Task<bool> DeleteDiscordBotAsync(long t, string a, CancellationToken ct = default) => Task.FromResult(false);
        public Task<IReadOnlyList<long>> ListActiveTenantIdsAsync(CancellationToken ct = default) => Task.FromResult<IReadOnlyList<long>>(new List<long>());
        public Task<long?> FindActiveTenantIdAsync(string slug, CancellationToken ct = default) => Task.FromResult<long?>(null);
    }

    private static TenantEventSubHub NewHub()
        => new(new ServiceCollection().BuildServiceProvider(), new EmptyStore(), new ConfigurationBuilder().Build(),
            Microsoft.Extensions.Logging.Abstractions.NullLoggerFactory.Instance, NullLogger<TenantEventSubHub>.Instance);

    [Fact]
    public async Task SinAppNiBotQuedaEnNeedsSetupYNoConectaNada()
    {
        var st = await NewHub().StartAsync(2);
        Assert.Equal("needs_setup", st.Status);
        Assert.Equal(0, st.Shards);
    }

    [Fact]
    public async Task ElTenantUnoNoPasaPorElHubNiPorLaSincronizacion()
    {
        var hub = NewHub();
        await Assert.ThrowsAsync<ArgumentException>(() => hub.StartAsync(1));
        var sync = new TenantEventSubSync(new ServiceCollection().BuildServiceProvider(), new ConfigurationBuilder().Build(), hub, NullLogger<TenantEventSubSync>.Instance);
        await Assert.ThrowsAsync<ArgumentException>(() => sync.SyncAsync(1));
        await Assert.ThrowsAsync<InvalidOperationException>(() => sync.SyncAsync(2)); // sin conduit conectado
    }
}
