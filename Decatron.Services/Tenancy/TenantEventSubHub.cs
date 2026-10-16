using System.Collections.Concurrent;
using System.Text.Json;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;
using TwitchLib.EventSub.Websockets;

namespace Decatron.Services.Tenancy;

public sealed record EventSubHubState(
    long TenantId, string Status, string? ConduitId, int Shards, int ShardsConnected, string? Error, DateTimeOffset? LastEventAt);

/// <summary>
/// Plataforma, Fase 4 (paso 7b): un conduit de EventSub con sus shards WebSocket por tenant, con la app de Twitch DEL TENANT.
/// El tenant #1 NO pasa por aquí (sigue en <see cref="EventSubWebSocketService"/>, intacto). Cada evento se despacha dentro del
/// tenant de su shard (<see cref="TenantAmbient.Push"/>), así el manejador y la base de datos trabajan en el tenant correcto.
/// Necesita app y cuenta de bot de Twitch cargadas; si faltan, queda en <c>needs_setup</c> y no conecta nada.
/// </summary>
public sealed class TenantEventSubHub : IHostedService
{
    private static readonly Uri WsUrl = new("wss://eventsub.wss.twitch.tv/ws");

    private sealed class TenantRun
    {
        public string? ConduitId;
        public List<EventSubWebsocketClient> Clients = new();
        public int Connected;
        public DateTimeOffset? LastEventAt;
        public CancellationTokenSource Cts = new();
    }

    private readonly IServiceProvider _sp;
    private readonly ITenantCredentialStore _store;
    private readonly IConfiguration _cfg;
    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger<TenantEventSubHub> _log;
    private readonly ConcurrentDictionary<long, TenantRun> _runs = new();
    private readonly ConcurrentDictionary<long, EventSubHubState> _states = new();
    private readonly SemaphoreSlim _gate = new(1, 1);
    private CancellationTokenSource? _boot;

    public TenantEventSubHub(IServiceProvider sp, ITenantCredentialStore store, IConfiguration cfg, ILoggerFactory loggerFactory, ILogger<TenantEventSubHub> log)
    { _sp = sp; _store = store; _cfg = cfg; _loggerFactory = loggerFactory; _log = log; }

    private int ShardCount => Math.Clamp(_cfg.GetValue<int?>("Platform:EventSub:TenantShardCount") ?? 1, 1, 10);

    public EventSubHubState? StateOf(long tenantId)
    {
        if (!_states.TryGetValue(tenantId, out var st)) return null;
        return _runs.TryGetValue(tenantId, out var run) ? st with { ShardsConnected = run.Connected, LastEventAt = run.LastEventAt } : st;
    }

    private void Set(EventSubHubState s) => _states[s.TenantId] = s;

    public async Task<EventSubHubState> StartAsync(long tenantId, CancellationToken ct = default)
    {
        if (tenantId == 1) throw new ArgumentException("El tenant 1 usa el servicio principal.", nameof(tenantId));
        await _gate.WaitAsync(ct);
        try
        {
            await StopLockedAsync(tenantId);
            if (await _store.GetTwitchAppAsync(tenantId, ct) is null || await _store.GetTwitchBotAsync(tenantId, ct) is null)
            {
                var need = new EventSubHubState(tenantId, "needs_setup", null, 0, 0, null, null);
                Set(need); return need;
            }

            Set(new EventSubHubState(tenantId, "connecting", null, ShardCount, 0, null, null));
            var run = new TenantRun();
            try
            {
                using (TenantAmbient.Push(tenantId))
                {
                    using var scope = _sp.CreateScope();
                    var svc = scope.ServiceProvider.GetRequiredService<EventSubService>();
                    run.ConduitId = await EnsureConduitAsync(svc, ShardCount);
                    if (string.IsNullOrEmpty(run.ConduitId)) throw new InvalidOperationException("conduit_failed");
                    await svc.EnsureConduitShardDisabledSubscriptionAsync(run.ConduitId);
                }

                _runs[tenantId] = run;
                for (var i = 0; i < ShardCount; i++)
                {
                    var client = CreateShardClient(tenantId, i.ToString(), run);
                    run.Clients.Add(client);
                    if (!await client.ConnectAsync(WsUrl)) _log.LogError("eventsub.tenant.shard tenant={Tenant} shard={Shard} connect=false", tenantId, i);
                }
                _log.LogInformation("eventsub.tenant.start tenant={Tenant} conduit={Conduit} shards={Shards}", tenantId, run.ConduitId, ShardCount);
                var ok = new EventSubHubState(tenantId, "connected", run.ConduitId, ShardCount, run.Connected, null, null);
                Set(ok); return ok;
            }
            catch (Exception ex)
            {
                _log.LogWarning("eventsub.tenant.failed tenant={Tenant} type={Type} msg={Msg}", tenantId, ex.GetType().Name, ex.Message);
                await StopLockedAsync(tenantId);
                var failed = new EventSubHubState(tenantId, "failed", run.ConduitId, 0, 0, ex is CredentialsNotConfiguredException ? "needs_setup" : "connect_failed", null);
                Set(failed); return failed;
            }
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
        if (_runs.TryRemove(tenantId, out var run))
        {
            run.Cts.Cancel();
            foreach (var c in run.Clients)
            {
                try { await c.DisconnectAsync(); } catch (Exception ex) { _log.LogDebug(ex, "eventsub.tenant.stop tenant={Tenant}", tenantId); }
            }
        }
        Set(new EventSubHubState(tenantId, "stopped", null, 0, 0, null, null));
    }

    /// <summary>Reusa el conduit de la app del tenant o crea uno (ya dentro del tenant ambiente: el servicio usa SU token y SU client_id).</summary>
    private async Task<string?> EnsureConduitAsync(EventSubService svc, int shardCount)
    {
        var existing = await svc.GetConduitsAsync();
        if (existing.Success && !string.IsNullOrEmpty(existing.ResponseBody))
        {
            using var doc = JsonDocument.Parse(existing.ResponseBody);
            var data = doc.RootElement.GetProperty("data");
            if (data.GetArrayLength() > 0)
            {
                var id = data[0].GetProperty("id").GetString();
                if (data[0].GetProperty("shard_count").GetInt32() != shardCount) await svc.UpdateConduitAsync(id!, shardCount);
                return id;
            }
        }
        var created = await svc.CreateConduitAsync(shardCount);
        if (!created.Success || string.IsNullOrEmpty(created.ResponseBody)) return null;
        using var cdoc = JsonDocument.Parse(created.ResponseBody);
        return cdoc.RootElement.GetProperty("data")[0].GetProperty("id").GetString();
    }

    private EventSubWebsocketClient CreateShardClient(long tenantId, string shardId, TenantRun run)
    {
        var client = new EventSubWebsocketClient(_loggerFactory);
        var W = typeof(EventSubWebSocketService);

        async Task Associate()
        {
            if (string.IsNullOrEmpty(run.ConduitId) || string.IsNullOrEmpty(client.SessionId)) return;
            try
            {
                using (TenantAmbient.Push(tenantId))
                {
                    using var scope = _sp.CreateScope();
                    await scope.ServiceProvider.GetRequiredService<EventSubService>().UpdateConduitShardsAsync(run.ConduitId, shardId, client.SessionId);
                }
            }
            catch (Exception ex) { _log.LogError(ex, "eventsub.tenant.associate tenant={Tenant} shard={Shard}", tenantId, shardId); }
        }

        client.WebsocketConnected += async (_, __) => { Interlocked.Increment(ref run.Connected); await Associate(); };
        client.WebsocketReconnected += async (_, __) => await Associate();
        client.WebsocketDisconnected += async (_, __) =>
        {
            Interlocked.Decrement(ref run.Connected);
            _log.LogWarning("eventsub.tenant.disconnected tenant={Tenant} shard={Shard}", tenantId, shardId);
            await ReconnectWithBackoffAsync(client, tenantId, shardId, run.Cts.Token);
        };
        client.ErrorOccurred += (_, e) => { _log.LogError(e.Exception, "eventsub.tenant.error tenant={Tenant} shard={Shard} {Msg}", tenantId, shardId, e.Message); return Task.CompletedTask; };
        client.ConduitShardDisabled += (_, e) =>
        {
            _log.LogError("eventsub.tenant.shard_disabled tenant={Tenant} shard={Shard} status={Status}", tenantId, e.Payload.Event.ShardId, e.Payload.Event.Status);
            return Task.CompletedTask;
        };

        Task D(string type, JObject obj) => Dispatch(tenantId, run, type, obj);
        client.ChannelChatMessage += (_, e) => D("channel.chat.message", EventSubWebSocketService.BuildChatMessageJObject(e.Payload.Event));
        client.ChannelFollow += (_, e) => D("channel.follow", EventSubWebSocketService.BuildFollowJObject(e.Payload.Event));
        client.ChannelPointsCustomRewardRedemptionAdd += (_, e) => D("channel.channel_points_custom_reward_redemption.add", EventSubWebSocketService.BuildRedemptionJObject(e.Payload.Event));
        client.ChannelCheer += (_, e) => D("channel.cheer", EventSubWebSocketService.BuildCheerJObject(e.Payload.Event));
        client.ChannelSubscribe += (_, e) => D("channel.subscribe", EventSubWebSocketService.BuildSubscribeJObject(e.Payload.Event));
        client.ChannelSubscriptionGift += (_, e) => D("channel.subscription.gift", EventSubWebSocketService.BuildGiftSubJObject(e.Payload.Event));
        client.ChannelSubscriptionMessage += (_, e) => D("channel.subscription.message", EventSubWebSocketService.BuildResubJObject(e.Payload.Event));
        client.ChannelRaid += (_, e) => D("channel.raid", EventSubWebSocketService.BuildRaidJObject(e.Payload.Event));
        client.ChannelHypeTrainBeginV2 += (_, e) => D("channel.hype_train.begin", EventSubWebSocketService.BuildHypeTrainJObject(e.Payload.Event));
        client.ChannelHypeTrainProgressV2 += (_, e) => D("channel.hype_train.progress", new JObject { ["broadcaster_user_login"] = e.Payload.Event.BroadcasterUserLogin, ["level"] = e.Payload.Event.Level });
        client.ChannelHypeTrainEndV2 += (_, e) => D("channel.hype_train.end", new JObject { ["broadcaster_user_login"] = e.Payload.Event.BroadcasterUserLogin, ["level"] = e.Payload.Event.Level });
        client.StreamOnline += (_, e) => D("stream.online", EventSubWebSocketService.BuildStreamOnlineJObject(e.Payload.Event));
        client.StreamOffline += (_, e) => D("stream.offline", EventSubWebSocketService.BuildStreamOfflineJObject(e.Payload.Event));
        client.ChannelUpdate += (_, e) => D("channel.update", EventSubWebSocketService.BuildChannelUpdateJObject(e.Payload.Event));
        return client;
    }

    private async Task Dispatch(long tenantId, TenantRun run, string type, JObject data)
    {
        run.LastEventAt = DateTimeOffset.UtcNow;
        try
        {
            using (TenantAmbient.Push(tenantId)) // el evento llega en un hilo del socket, sin contexto
            {
                using var scope = _sp.CreateScope();
                await scope.ServiceProvider.GetRequiredService<EventSubNotificationHandler>().ManejarEvento(type, data);
            }
        }
        catch (Exception ex) { _log.LogError(ex, "eventsub.tenant.dispatch tenant={Tenant} type={Type}", tenantId, type); }
    }

    private async Task ReconnectWithBackoffAsync(EventSubWebsocketClient client, long tenantId, string shardId, CancellationToken ct)
    {
        var delay = TimeSpan.FromSeconds(5);
        for (var attempt = 1; !ct.IsCancellationRequested; attempt++)
        {
            try { if (await client.ReconnectAsync()) return; }
            catch (Exception ex) { _log.LogError(ex, "eventsub.tenant.reconnect tenant={Tenant} shard={Shard} attempt={Attempt}", tenantId, shardId, attempt); }
            try { await Task.Delay(delay, ct); } catch (OperationCanceledException) { return; }
            delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, 60));
        }
    }

    // Arranque: tenants con app y bot de Twitch cargados, escalonados y sin bloquear el arranque (despues del conduit del #1).
    Task IHostedService.StartAsync(CancellationToken cancellationToken)
    {
        _boot = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(90), _boot.Token);
                foreach (var id in await _store.ListActiveTenantIdsAsync(_boot.Token))
                {
                    if (await _store.GetTwitchBotAsync(id, _boot.Token) is null) continue;
                    if (_sp.GetService<IEntitlements>() is { } ent && !await ent.IsOperationalAsync(id, live: true, _boot.Token)) continue; // Fase 5.5: suspendido/vencido no conecta
                    var st = await StartAsync(id, _boot.Token);
                    if (st.Status == "connected") _ = Task.Run(async () => { try { await _sp.GetRequiredService<TenantEventSubSync>().SyncAsync(id); } catch (Exception ex) { _log.LogWarning("eventsub.tenant.boot_sync tenant={Tenant} type={Type}", id, ex.GetType().Name); } });
                    await Task.Delay(3000, _boot.Token);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex) { _log.LogError(ex, "eventsub.tenant.boot"); }
        });
        return Task.CompletedTask;
    }

    async Task IHostedService.StopAsync(CancellationToken cancellationToken)
    {
        _boot?.Cancel();
        foreach (var id in _runs.Keys.ToArray()) await StopAsync(id);
    }
}
