using Decatron.Core.Interfaces;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tenancy;

/// <summary>Escribe en lotes lo que <see cref="IEntitlements.Count"/> acumula en memoria (cada 10 s y al cerrar el proceso).</summary>
public sealed class EntitlementsFlusher : BackgroundService
{
    private readonly IEntitlements _ent;
    private readonly ILogger<EntitlementsFlusher> _log;
    public EntitlementsFlusher(IEntitlements ent, ILogger<EntitlementsFlusher> log) { _ent = ent; _log = log; }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try { await Task.Delay(TimeSpan.FromSeconds(10), ct); } catch (OperationCanceledException) { break; }
            try { await _ent.FlushAsync(ct); }
            catch (Exception ex) when (ex is not OperationCanceledException) { _log.LogWarning("entitlements.flusher.failed {Type}", ex.GetType().Name); }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);
        try { await _ent.FlushAsync(CancellationToken.None); } catch { /* al cerrar no hay a quién avisar */ }
    }
}
