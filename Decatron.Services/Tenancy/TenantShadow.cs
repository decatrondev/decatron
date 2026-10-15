using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Decatron.Core.Interfaces;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Fase 2 (modo sombra) para puntos de entrada sin HttpContext (chat, EventSub): resuelve el tenant de la clave de canal
/// y registra `tenant.ambiguous` si no se pudo, una vez por hora por clave y punto. Con Mode=off no hace nada.
/// Nunca lanza ni cambia el flujo del llamador.
/// </summary>
public sealed class TenantShadow
{
    private readonly ITenantResolver _resolver;
    private readonly IConfiguration _config;
    private readonly ILogger<TenantShadow> _log;
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, DateTime> _seen = new();

    public TenantShadow(ITenantResolver resolver, IConfiguration config, ILogger<TenantShadow> log)
    {
        _resolver = resolver;
        _config = config;
        _log = log;
    }

    public void Observe(string entryPoint, string? channelKey)
    {
        try
        {
            if (!string.Equals(_config["Platform:TenantContext:Mode"], "shadow", StringComparison.OrdinalIgnoreCase)) return;
            var res = _resolver.ByChannelKey(channelKey);
            if (res.Resolved) return;
            var k = entryPoint + "|" + (channelKey ?? "");
            var now = DateTime.UtcNow;
            if (_seen.TryGetValue(k, out var last) && now - last < TimeSpan.FromHours(1)) return;
            _seen[k] = now;
            _log.LogWarning("tenant.ambiguous key={Key} path={Path} fallback=1", channelKey ?? "(vacío)", entryPoint);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "tenant.shadow_error");
        }
    }

    /// <summary>
    /// Fase 2: fija el tenant ambiente de una tarea de fondo mientras procesa un canal (using var _ = shadow.Enter(...)).
    /// Con Mode=off no hace nada. Hoy solo lo lee TenantAmbient.Current (registro); en la Fase 3 lo usarán el filtro de EF y RLS.
    /// </summary>
    public IDisposable Enter(string entryPoint, string? channelKey)
    {
        try
        {
            if (!string.Equals(_config["Platform:TenantContext:Mode"], "shadow", StringComparison.OrdinalIgnoreCase))
                return NoopScope.Instance;
            Observe(entryPoint, channelKey);
            return TenantAmbient.Push(_resolver.ByChannelKey(channelKey).TenantId);
        }
        catch
        {
            return NoopScope.Instance;
        }
    }

    /// <summary>Igual que <see cref="Enter"/> pero la clave es users.id (tareas que recorren usuarios, no canales).</summary>
    public IDisposable EnterUser(string entryPoint, long userId)
    {
        try
        {
            if (!string.Equals(_config["Platform:TenantContext:Mode"], "shadow", StringComparison.OrdinalIgnoreCase))
                return NoopScope.Instance;
            var res = _resolver.ByUserId(userId);
            if (!res.Resolved) WarnOnce(entryPoint, "user:" + userId);
            return TenantAmbient.Push(res.TenantId);
        }
        catch
        {
            return NoopScope.Instance;
        }
    }

    private void WarnOnce(string entryPoint, string key)
    {
        var k = entryPoint + "|" + key;
        var now = DateTime.UtcNow;
        if (_seen.TryGetValue(k, out var last) && now - last < TimeSpan.FromHours(1)) return;
        _seen[k] = now;
        _log.LogWarning("tenant.ambiguous key={Key} path={Path} fallback=1", key, entryPoint);
    }

    private sealed class NoopScope : IDisposable
    {
        public static readonly NoopScope Instance = new();
        public void Dispose() { }
    }
}

/// <summary>Tenant ambiente por flujo asíncrono (AsyncLocal) para tareas sin HttpContext. null = ninguno fijado.</summary>
public static class TenantAmbient
{
    private static readonly AsyncLocal<long?> _current = new();
    public static long? Current => _current.Value;

    internal static IDisposable Push(long tenantId)
    {
        var prev = _current.Value;
        _current.Value = tenantId;
        return new Restore(prev);
    }

    private sealed class Restore : IDisposable
    {
        private readonly long? _prev;
        public Restore(long? prev) { _prev = prev; }
        public void Dispose() { _current.Value = _prev; }
    }
}
