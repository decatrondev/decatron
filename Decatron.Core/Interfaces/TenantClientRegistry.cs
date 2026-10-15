using System.Collections.Concurrent;

namespace Decatron.Core.Interfaces;

/// <summary>
/// Plataforma, Fase 4 (paso 6): un cliente de conexión persistente (gateway de Discord, etc.) por tenant. El tenant #1 NO vive aquí:
/// su cliente es el de siempre y se pasa a <see cref="Resolve"/>. Un tenant sin cliente propio falla cerrado, nunca recibe el del #1.
/// </summary>
public class TenantClientRegistry<T> where T : class
{
    private readonly ConcurrentDictionary<long, T> _clients = new();

    public int Count => _clients.Count;
    public IReadOnlyCollection<long> TenantIds => _clients.Keys.ToArray();

    public bool TryGet(long tenantId, out T client) => _clients.TryGetValue(tenantId, out client!);
    public bool TryAdd(long tenantId, T client) => tenantId != 1 && _clients.TryAdd(tenantId, client);
    public bool TryRemove(long tenantId, out T client) => _clients.TryRemove(tenantId, out client!);

    /// <summary>Tenant dueño de este cliente (el que dispara un evento), o null si es el del #1 o no está registrado.</summary>
    public long? TenantOf(T client)
    {
        foreach (var kv in _clients) if (ReferenceEquals(kv.Value, client)) return kv.Key;
        return null;
    }

    /// <summary>Cliente del tenant ambiente: el #1 (o sin tenant) recibe <paramref name="primary"/>; otro recibe el suyo o una excepción.</summary>
    public T Resolve(T primary, Func<long, Exception> notConfigured)
    {
        var tenant = TenantAmbient.Current ?? 1;
        if (tenant == 1) return primary;
        if (TryGet(tenant, out var own)) return own;
        throw notConfigured(tenant);
    }
}
