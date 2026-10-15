using System.Collections.Concurrent;
using Npgsql;

namespace Decatron.Core.Interfaces;

/// <summary>
/// Plataforma, Fase 3 (paso 6): fábrica de conexiones Npgsql directas (las que no pasan por EF y por tanto por el interceptor RLS).
/// La conexión nace con el parámetro de arranque <c>app.tenant_id</c> (el que lee app_tenant_id() en las políticas), tomado del tenant
/// ambiente de la tarea (<see cref="TenantAmbient"/>) o 1 si no hay, igual que <c>DecatronDbContext</c>. Así el aislamiento no depende
/// del valor por defecto del rol. Cada tenant usa su propio pool (la cadena difiere), lo que además impide que una sesión herede el tenant de otra.
/// </summary>
public static class TenantNpgsql
{
    private static readonly ConcurrentDictionary<(string, long), string> _cadenas = new();

    public static NpgsqlConnection Create(string? connectionString) => Create(connectionString, TenantAmbient.Current ?? 1);

    public static NpgsqlConnection Create(string? connectionString, long tenantId)
    {
        if (string.IsNullOrEmpty(connectionString)) return new NpgsqlConnection(connectionString);
        var cs = _cadenas.GetOrAdd((connectionString, tenantId), static k =>
        {
            var b = new NpgsqlConnectionStringBuilder(k.Item1);
            var previas = System.Text.RegularExpressions.Regex.Replace(b.Options ?? "", @"-c\s+app\.tenant_id=\S+", "").Trim();
            b.Options = (previas + $" -c app.tenant_id={k.Item2}").Trim();
            return b.ConnectionString;
        });
        return new NpgsqlConnection(cs);
    }
}
