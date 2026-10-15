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
