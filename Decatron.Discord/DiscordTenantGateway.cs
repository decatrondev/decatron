using System.Collections.Concurrent;
using System.Diagnostics;
using Decatron.Core.Interfaces;
using DSharpPlus;
using DSharpPlus.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord;

public sealed record GatewayState(
    long TenantId, string Status, int Guilds, string? Error, bool IntentsMissing, DateTimeOffset? StartedAt, double MemoryDeltaMb);

/// <summary>
/// Plataforma, Fase 4 (paso 6c.2): abre y cierra un gateway de Discord por tenant con el token de SU bot (guardado cifrado).
/// El tenant #1 no pasa por aquí. Tope de conexiones simultáneas (<c>Platform:Discord:MaxGateways</c>, 20 por defecto) y medición de la memoria
/// que aporta cada gateway (log <c>discord.gateway.mem</c>) para fijar límites y precios con datos.
/// </summary>
public sealed class DiscordTenantGateway : IHostedService
{
    private readonly IEntitlements? _entitlements;
    private readonly DiscordClientProvider _provider;
    private readonly ITenantCredentialStore _store;
    private readonly DiscordBotService _bot;
    private readonly IConfiguration _cfg;
    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger<DiscordTenantGateway> _log;
    private readonly ConcurrentDictionary<long, GatewayState> _states = new();
    private readonly SemaphoreSlim _gate = new(1, 1);
    private CancellationTokenSource? _boot;

    public DiscordTenantGateway(DiscordClientProvider provider, ITenantCredentialStore store, DiscordBotService bot, IConfiguration cfg,
        ILoggerFactory loggerFactory, ILogger<DiscordTenantGateway> log, IEntitlements? entitlements = null)
    { _entitlements = entitlements; _provider = provider; _store = store; _bot = bot; _cfg = cfg; _loggerFactory = loggerFactory; _log = log; }

    public int Cap => Math.Max(0, _cfg.GetValue<int?>("Platform:Discord:MaxGateways") ?? 20);
    public int Connected => _provider.Registry?.Count ?? 0;
    public IReadOnlyCollection<GatewayState> States => _states.Values.OrderBy(s => s.TenantId).ToArray();
    public GatewayState? StateOf(long tenantId) => _states.TryGetValue(tenantId, out var s) ? s : null;

    private void Set(GatewayState s) => _states[s.TenantId] = s;

    public async Task<GatewayState> StartAsync(long tenantId, CancellationToken ct = default)
    {
        if (tenantId == 1) throw new ArgumentException("El tenant 1 usa el cliente principal.", nameof(tenantId));
        var registry = _provider.Registry ?? throw new InvalidOperationException("Sin registro de clientes de Discord.");
        await _gate.WaitAsync(ct);
        try
        {
            if (registry.TryGet(tenantId, out _)) await StopLockedAsync(tenantId); // reinicio: cierra el anterior
            if (registry.Count >= Cap)
            {
                _log.LogWarning("discord.gateway.cap tenant={Tenant} cap={Cap}", tenantId, Cap);
                var capped = new GatewayState(tenantId, "failed", 0, "gateway_cap", false, null, 0);
                Set(capped); return capped;
            }

            var token = await _store.GetDiscordBotTokenAsync(tenantId, "gateway-start", ct);
            var summary = await _store.GetDiscordBotAsync(tenantId, ct);
            if (string.IsNullOrEmpty(token) || summary is null)
            {
                var none = new GatewayState(tenantId, "stopped", 0, null, false, null, 0);
                Set(none); return none;
            }

            Set(new GatewayState(tenantId, "connecting", 0, null, false, null, 0));
            var rssBefore = Process.GetCurrentProcess().WorkingSet64;
            var client = new DiscordClient(new DiscordConfiguration
            {
                Token = token,
                TokenType = TokenType.Bot,
                Intents = DiscordIntents.AllUnprivileged | DiscordIntents.GuildMembers | DiscordIntents.GuildMessages | DiscordIntents.MessageContents,
                LoggerFactory = _loggerFactory,
                AutoReconnect = true,
            });

            var intentsMissing = false;
            client.SocketClosed += (_, e) =>
            {
                if (e.CloseCode == 4014) // intents privilegiados no activados en el portal del comprador
                {
                    intentsMissing = true;
                    Set(new GatewayState(tenantId, "failed", 0, "intents_missing", true, null, 0));
                }
                return Task.CompletedTask;
            };

            using (TenantAmbient.Push(tenantId))
                _bot.AttachTenantClient(client, token, summary.BotId);
            registry.TryAdd(tenantId, client);

            try
            {
                await client.ConnectAsync(new DiscordActivity("decatron.net", ActivityType.Watching));
                await Task.Delay(3000, ct);
                if (intentsMissing) throw new InvalidOperationException("intents_missing");
                using (TenantAmbient.Push(tenantId))
                    await _bot.RegisterTenantCommandsAsync(client, token, summary.BotId);
            }
            catch (Exception ex)
            {
                registry.TryRemove(tenantId, out _);
                try { await client.DisconnectAsync(); } catch { }
                client.Dispose();
                var missing = intentsMissing || ex.Message.Contains("4014") || ex.Message.Contains("ntent", StringComparison.OrdinalIgnoreCase);
                _log.LogWarning("discord.gateway.failed tenant={Tenant} intentsMissing={Intents} type={Type}", tenantId, missing, ex.GetType().Name);
                var failed = new GatewayState(tenantId, "failed", 0, missing ? "intents_missing" : "connect_failed", missing, null, 0);
                Set(failed); return failed;
            }

            var deltaMb = (Process.GetCurrentProcess().WorkingSet64 - rssBefore) / 1048576.0;
            var ok = new GatewayState(tenantId, "connected", client.Guilds.Count, null, false, DateTimeOffset.UtcNow, Math.Round(deltaMb, 1));
            Set(ok);
            _log.LogInformation("discord.gateway.mem tenant={Tenant} guilds={Guilds} deltaMb={Delta} gateways={Count} rssMb={Rss}",
                tenantId, ok.Guilds, ok.MemoryDeltaMb, registry.Count, Process.GetCurrentProcess().WorkingSet64 / 1048576);
            return ok;
        }
        finally { _gate.Release(); }
    }

    public async Task StopAsync(long tenantId)
    {
        await _gate.WaitAsync();
        try { await StopLockedAsync(tenantId); } finally { _gate.Release(); }
    }

    private async Task StopLockedAsync(long tenantId)
    {
        if (_provider.Registry?.TryRemove(tenantId, out var client) == true)
        {
            try { await client.DisconnectAsync(); } catch (Exception ex) { _log.LogDebug(ex, "discord.gateway.stop tenant={Tenant}", tenantId); }
            client.Dispose();
        }
        Set(new GatewayState(tenantId, "stopped", 0, null, false, null, 0));
    }

    // Arranque: abre los gateways de los tenants que ya tienen bot cargado, escalonados y sin bloquear el arranque del backend.
    Task IHostedService.StartAsync(CancellationToken cancellationToken)
    {
        _boot = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(40), _boot.Token); // despues de que conecte el bot principal
                foreach (var id in await _store.ListActiveTenantIdsAsync(_boot.Token))
                {
                    if (await _store.GetDiscordBotAsync(id, _boot.Token) is null) continue;
                    if (_entitlements != null && !await _entitlements.IsOperationalAsync(id, live: true, _boot.Token)) continue; // Fase 5.5: suspendido/vencido no conecta
                    await StartAsync(id, _boot.Token);
                    await Task.Delay(2000, _boot.Token);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex) { _log.LogError(ex, "discord.gateway.boot"); }
        });
        return Task.CompletedTask;
    }

    async Task IHostedService.StopAsync(CancellationToken cancellationToken)
    {
        _boot?.Cancel();
        foreach (var id in _provider.Registry?.TenantIds ?? Array.Empty<long>()) await StopAsync(id);
    }
}
