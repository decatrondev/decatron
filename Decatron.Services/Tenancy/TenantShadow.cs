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
}
