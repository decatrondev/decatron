using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Discord;

/// <summary>
/// Plataforma, Fase 5.5: hace cumplir el estado de la suscripción sobre las conexiones persistentes. Un tenant suspendido, cancelado, con el sandbox
/// vencido o sin suscripción PAUSA su conduit de EventSub y su gateway de Discord (las tareas de fondo las omite <see cref="TenantTaskRunner"/>); los datos
/// quedan intactos. Al volver a estar operativo se reanudan solos, pero solo los que pausó este servicio (no los que el dueño detuvo a mano).
/// El #1 no pasa por aquí. Si la base de entitlements no responde se deja todo como está (<c>live: true</c>).
/// </summary>
public sealed class TenantLifecycle : BackgroundService
{
    private readonly IEntitlements _ent;
    private readonly ITenantCredentialStore _store;
    private readonly TenantEventSubHub _hub;
    private readonly DiscordTenantGateway _gateway;
    private readonly TenantEventSubSync _sync;
    private readonly IConfiguration _cfg;
    private readonly ILogger<TenantLifecycle> _log;
    private readonly HashSet<long> _paused = new();
    private readonly TenantDataAdmin _data;
    private readonly TenantGrace _grace;
    private DateTime _lastDueCheck = DateTime.MinValue;

    public TenantLifecycle(IEntitlements ent, ITenantCredentialStore store, TenantEventSubHub hub, DiscordTenantGateway gateway,
        TenantEventSubSync sync, TenantDataAdmin data, TenantGrace grace, IConfiguration cfg, ILogger<TenantLifecycle> log)
    { _grace = grace; _data = data; _ent = ent; _store = store; _hub = hub; _gateway = gateway; _sync = sync; _cfg = cfg; _log = log; }

    public IReadOnlyCollection<long> Paused { get { lock (_paused) return _paused.ToArray(); } }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        try { await Task.Delay(TimeSpan.FromSeconds(150), ct); } catch (OperationCanceledException) { return; } // después del arranque de hub y gateways
        var every = TimeSpan.FromSeconds(Math.Max(15, _cfg.GetValue<int?>("Platform:Lifecycle:IntervalSeconds") ?? 60));
        while (!ct.IsCancellationRequested)
        {
            try { await _grace.SweepAsync(ct); } // antes de la pasada: un plan recién vencido entra en gracia y no se pausa
            catch (Exception ex) when (ex is not OperationCanceledException) { _log.LogWarning("tenant.grace.failed {Type}", ex.GetType().Name); }
            try { await PassAsync(ct); }
            catch (Exception ex) when (ex is not OperationCanceledException) { _log.LogWarning("tenant.lifecycle.failed {Type}", ex.GetType().Name); }
            // Aviso (no borra): tenants cuyo plazo de guarda venció; el dueño decide desde /admin/platform-tenants
            if (DateTime.UtcNow - _lastDueCheck > TimeSpan.FromHours(6))
            {
                _lastDueCheck = DateTime.UtcNow;
                try
                {
                    var due = await _data.DueForPurgeAsync(Math.Max(1, _cfg.GetValue<int?>("Platform:Lifecycle:PurgeAfterDays") ?? 30), ct);
                    if (due.Count > 0) _log.LogWarning("tenant.purge.due tenants={Tenants}", string.Join(",", due));
                }
                catch (Exception ex) when (ex is not OperationCanceledException) { _log.LogWarning("tenant.purge.due.failed {Type}", ex.GetType().Name); }
            }
            try { await Task.Delay(every, ct); } catch (OperationCanceledException) { return; }
        }
    }

    /// <summary>Una pasada: pausa lo que no debe estar conectado y reanuda lo que pausó. Pública para las pruebas.</summary>
    public async Task PassAsync(CancellationToken ct = default)
    {
        var active = (await _store.ListActiveTenantIdsAsync(ct)).ToHashSet();
        var candidates = new HashSet<long>(active);
        candidates.UnionWith(_gateway.States.Select(s => s.TenantId));
        lock (_paused) candidates.UnionWith(_paused);
        candidates.Remove(1);

        foreach (var id in candidates.OrderBy(x => x))
        {
            if (ct.IsCancellationRequested) return;
            var shouldRun = active.Contains(id) && await _ent.IsOperationalAsync(id, live: true, ct);
            var running = IsRunning(id);
            bool paused; lock (_paused) paused = _paused.Contains(id);

            if (!shouldRun && running)
            {
                _log.LogWarning("tenant.lifecycle.pause tenant={Tenant}", id);
                await _hub.StopAsync(id);
                await _gateway.StopAsync(id);
                lock (_paused) _paused.Add(id);
            }
            else if (shouldRun && paused)
            {
                _log.LogInformation("tenant.lifecycle.resume tenant={Tenant}", id);
                lock (_paused) _paused.Remove(id);
                if (await _store.GetTwitchBotAsync(id, ct) is not null)
                {
                    var st = await _hub.StartAsync(id, ct);
                    if (st.Status == "connected") _ = Task.Run(async () => { try { await _sync.SyncAsync(id); } catch (Exception ex) { _log.LogWarning("tenant.lifecycle.sync tenant={Tenant} type={Type}", id, ex.GetType().Name); } });
                }
                if (await _store.GetDiscordBotAsync(id, ct) is not null) await _gateway.StartAsync(id, ct);
            }
            else if (!shouldRun && !running)
            {
                lock (_paused) _paused.Add(id); // ya estaba apagado (p. ej. no arrancó por estar suspendido): al volver, se levanta
            }
        }
    }

    private bool IsRunning(long id)
    {
        var h = _hub.StateOf(id)?.Status;
        var g = _gateway.StateOf(id)?.Status;
        return h is "connected" or "connecting" || g is "connected" or "connecting";
    }
}
