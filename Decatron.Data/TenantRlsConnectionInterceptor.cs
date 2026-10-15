using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Decatron.Data;

/// <summary>
/// Fase 3 (paso 5): al abrir cada conexión le dice a PostgreSQL de qué tenant es (set_config 'app.tenant_id'), que es lo que leen las
/// políticas RLS (función app_tenant_id()). Solo actúa con Platform:TenantContext:Rls = context; apagado no hace nada.
/// Se fija a nivel de sesión en CADA apertura: Npgsql reinicia el estado al devolver la conexión al pool, así que no se filtra
/// el tenant de un uso al siguiente. Las conexiones Npgsql directas del código (fuera de EF) no pasan por aquí: se cubren en el paso 6.
/// </summary>
public sealed class TenantRlsConnectionInterceptor : DbConnectionInterceptor
{
    public static readonly TenantRlsConnectionInterceptor Instance = new();

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        if (eventData.Context is DecatronDbContext { RlsContextEnabled: true } ctx)
            using (var cmd = Build(connection, ctx.CurrentTenantIdForRls)) cmd.ExecuteNonQuery();
    }

    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        if (eventData.Context is DecatronDbContext { RlsContextEnabled: true } ctx)
        {
            await using var cmd = Build(connection, ctx.CurrentTenantIdForRls);
            await cmd.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static DbCommand Build(DbConnection connection, long tenantId)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = "select set_config('app.tenant_id', @t, false)";
        var p = cmd.CreateParameter();
        p.ParameterName = "t";
        p.Value = tenantId.ToString();
        cmd.Parameters.Add(p);
        return cmd;
    }
}
