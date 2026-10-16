namespace Decatron.Core.Interfaces;

/// <summary>
/// Bandera Platform:TenantContext:Mode: off (por defecto) | shadow (calcula y registra) | strict (además filtra por tenant en EF).
/// strict se lee al construir el modelo de EF: cambiarlo exige reiniciar el backend.
/// </summary>
public static class TenantMode
{
    public const string ConfigKey = "Platform:TenantContext:Mode";

    public static bool IsOn(string? mode) =>
        string.Equals(mode, "shadow", StringComparison.OrdinalIgnoreCase) || IsStrict(mode);

    public static bool IsStrict(string? mode) => string.Equals(mode, "strict", StringComparison.OrdinalIgnoreCase);
}

/// <summary>Tenant ambiente por flujo asíncrono (AsyncLocal) para tareas sin HttpContext. null = ninguno fijado.</summary>
public static class TenantAmbient
{
    private static readonly AsyncLocal<long?> _current = new();
    public static long? Current => _current.Value;

    /// <summary>Clave de memoria por canal con el tenant ambiente por delante: un mismo canal en dos tenants no comparte contadores, caches ni permisos. Sin tenant fijado cae al #1 (igual que el resto).</summary>
    public static string Key(string channel) => (_current.Value ?? 1) + "|" + channel.ToLowerInvariant();

    public static IDisposable Push(long tenantId)
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
