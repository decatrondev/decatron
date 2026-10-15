using System.Collections;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>
/// Fase 3 (paso 4): el rol de aplicación `decatron_app` (sin superusuario) debe poder hacer TODO lo que hace el bot
/// (DML sobre todas las entidades) y nada más. Corre sobre `decatron_schema`; cadena en DECATRON_APP_CONN
/// (Database=decatron_schema, Username=decatron_app). Sin la variable las pruebas se omiten.
/// </summary>
public class AppRoleTests
{
    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(Conn);

    private static NpgsqlConnection Open()
    {
        var c = new NpgsqlConnection(Conn);
        c.Open();
        using var cmd = new NpgsqlCommand("select current_database() || '/' || current_user", c);
        var who = (string)cmd.ExecuteScalar()!;
        if (who != "decatron_schema/decatron_app") { c.Dispose(); throw new InvalidOperationException($"Conexión inesperada: {who}"); }
        return c;
    }

    [Fact(DisplayName = "decatron_app no es superusuario, no ignora RLS y no puede crear nada")]
    public void Role_IsLimited()
    {
        if (!Available) return;
        using var c = Open();
        using var q = new NpgsqlCommand("select rolsuper, rolbypassrls, rolcreatedb, rolcreaterole from pg_roles where rolname = current_user", c);
        using var r = q.ExecuteReader();
        Assert.True(r.Read());
        Assert.False(r.GetBoolean(0)); Assert.False(r.GetBoolean(1)); Assert.False(r.GetBoolean(2)); Assert.False(r.GetBoolean(3));
    }

    [Fact(DisplayName = "decatron_app no puede ejecutar DDL (crear, alterar o borrar tablas)")]
    public void Role_CannotRunDdl()
    {
        if (!Available) return;
        using var c = Open();
        foreach (var sql in new[] { "create table zz_intruso (id int)", "alter table command_counters add column zz int", "drop table command_counters", "truncate table command_counters" })
        {
            using var cmd = new NpgsqlCommand(sql, c);
            var ex = Assert.ThrowsAny<PostgresException>(() => cmd.ExecuteNonQuery());
            Assert.Equal("42501", ex.SqlState); // permission denied / must be owner
        }
    }

    [Fact(DisplayName = "decatron_app puede consultar todas las entidades de EF (lo que hace el bot)")]
    public void Role_CanQueryEveryEntity()
    {
        if (!Available) return;
        var options = new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(Conn).Options;
        using var ctx = new DecatronDbContext(options);
        var setMethod = typeof(DbContext).GetMethods().First(m => m.Name == "Set" && m.GetParameters().Length == 0 && m.IsGenericMethodDefinition);
        var take = typeof(Queryable).GetMethods().First(m => m.Name == "Take" && m.GetParameters()[1].ParameterType == typeof(int));
        var failures = new List<string>();
        foreach (var t in ctx.Model.GetEntityTypes().Where(t => t.BaseType == null && t.GetTableName() != null))
        {
            try
            {
                var set = setMethod.MakeGenericMethod(t.ClrType).Invoke(ctx, null)!;
                var q = (IQueryable)take.MakeGenericMethod(t.ClrType).Invoke(null, new[] { set, (object)1 })!;
                foreach (var _ in (IEnumerable)q) { }
            }
            catch (Exception ex)
            {
                // 42P01 = la entidad no tiene tabla en producción (hoy: goals_configs y goals_progress_logs); no es un problema de permisos.
                if (ex.GetBaseException() is PostgresException { SqlState: "42P01" }) continue;
                failures.Add($"{t.GetTableName()}: {ex.GetBaseException().Message}");
            }
        }
        Assert.True(failures.Count == 0, "Sin permiso o con error:\n" + string.Join("\n", failures));
    }

    [Fact(DisplayName = "decatron_app puede insertar, actualizar y borrar (con secuencias)")]
    public void Role_CanWrite()
    {
        if (!Available) return;
        var options = new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(Conn).Options;
        using var ctx = new DecatronDbContext(options);
        var row = new Decatron.Core.Models.CommandCounter { ChannelName = "app_role", CommandName = "c" + Guid.NewGuid().ToString("N")[..8], UserId = 515151 };
        ctx.CommandCounters.Add(row);
        ctx.SaveChanges();
        Assert.True(row.Id > 0);
        row.CounterValue = 5;
        ctx.SaveChanges();
        ctx.CommandCounters.Remove(row);
        ctx.SaveChanges();
    }
}
