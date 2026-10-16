using System.Diagnostics;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Plataforma, Fase 4 (tareas de fondo): una tarea sin request corre con el tenant ambiente 1 y la RLS solo le deja ver filas del #1.
/// Este ejecutor repite el cuerpo de la tarea una vez por tenant activo (el #1 siempre primero, con el mismo comportamiento de hoy),
/// cada uno dentro de <see cref="TenantAmbient.Push"/> y con su propio try/catch: el fallo de un tenant no frena a los demás.
/// El cuerpo debe abrir su propio IServiceScope (la conexión toma el tenant al abrirse).
/// </summary>
public sealed class TenantTaskRunner
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(60);
    private readonly ITenantCredentialStore? _store;
    private readonly ILogger<TenantTaskRunner> _log;
    private readonly IEntitlements? _entitlements;
    private IReadOnlyList<long> _tenants = new long[] { 1 };
    private DateTime _loadedAt = DateTime.MinValue;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public TenantTaskRunner(ILogger<TenantTaskRunner> log, ITenantCredentialStore? store = null, IEntitlements? entitlements = null) { _log = log; _store = store; _entitlements = entitlements; }

    /// <summary>Tenants activos: el #1 primero y luego el resto en orden. Si el almacén falla, se conserva la última lista conocida.</summary>
    public async Task<IReadOnlyList<long>> GetTenantsAsync(CancellationToken ct = default)
    {
        if (DateTime.UtcNow - _loadedAt < CacheFor) return _tenants;
        await _gate.WaitAsync(ct);
        try
        {
            if (DateTime.UtcNow - _loadedAt < CacheFor) return _tenants;
            if (_store != null)
            {
                try
                {
                    var others = (await _store.ListActiveTenantIdsAsync(ct)).Where(t => t != 1).Distinct().OrderBy(t => t).ToList();
                    if (_entitlements != null)
                    {
                        // Fase 5.5: un tenant suspendido, vencido o sin suscripción no corre tareas (sus datos quedan intactos). Si no se puede saber, se deja correr.
                        var operational = new List<long>();
                        foreach (var t in others) if (await _entitlements.IsOperationalAsync(t, live: true, ct)) operational.Add(t);
                        others = operational;
                    }
                    _tenants = new[] { 1L }.Concat(others).ToArray();
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _log.LogWarning("tasks.tenants.list.failed {Type}; se conserva la lista anterior", ex.GetType().Name);
                }
            }
            _loadedAt = DateTime.UtcNow;
            return _tenants;
        }
        finally { _gate.Release(); }
    }

    /// <summary>
    /// Ejecuta <paramref name="body"/> una vez por tenant, en secuencia. No lanza: los errores de un tenant se registran.
    /// Fase 5.4: con <paramref name="module"/> (p. ej. <c>module.timers</c>) se omiten los tenants cuyo plan no lo incluye; el #1 siempre corre.
    /// Si no se puede saber (base de planes caída) se deja correr.
    /// </summary>
    public async Task ForEachTenantAsync(string name, Func<long, Task> body, CancellationToken ct = default, string? module = null)
    {
        if (ct.IsCancellationRequested) return;
        Exception? firstError = null; // el del #1 se relanza al final para que la tarea lo maneje como siempre
        foreach (var tenant in await GetTenantsAsync(ct))
        {
            if (ct.IsCancellationRequested) return;
            if (module != null && tenant != 1 && _entitlements != null && !await _entitlements.HasAsync(module, tenant, live: true, ct)) continue;
            var sw = Stopwatch.StartNew();
            try
            {
                using (TenantAmbient.Push(tenant)) await body(tenant);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                if (tenant == 1) { firstError = ex; continue; }
                _log.LogError(ex, "tasks.tenant.error name={Name} tenant={Tenant}", name, tenant);
            }
            finally
            {
                if (tenant != 1) _log.LogDebug("tasks.tenant name={Name} tenant={Tenant} ms={Ms}", name, tenant, sw.ElapsedMilliseconds);
            }
        }
        if (firstError != null) System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(firstError).Throw();
    }
}
