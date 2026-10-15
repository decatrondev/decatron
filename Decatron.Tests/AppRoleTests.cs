using Microsoft.Extensions.Configuration;
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

/// <summary>
/// Fase 3 (paso 5): con las políticas reales aplicadas y RLS habilitado en una tabla, el rol de aplicación solo ve las filas del tenant
/// que el interceptor le fija, aunque el código pida todo (IgnoreQueryFilters). Usa command_counters de la copia desechable.
/// </summary>
public class RlsPoliciesEndToEndTests
{
    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static string? Admin => Environment.GetEnvironmentVariable("DECATRON_SCHEMA_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(App) && !string.IsNullOrWhiteSpace(Admin);

    private static void AdminExec(params string[] sqls)
    {
        using var c = new NpgsqlConnection(Admin); c.Open();
        foreach (var sql in sqls) { using var cmd = new NpgsqlCommand(sql, c); cmd.ExecuteNonQuery(); }
    }

    private static DecatronDbContext Ctx(string rls)
    {
        var cfg = new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Platform:TenantContext:Rls"] = rls }).Build();
        return new DecatronDbContext(new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(App).Options, cfg);
    }

    private static List<string> Names(DecatronDbContext c)
        => c.CommandCounters.IgnoreQueryFilters().Where(x => x.ChannelName.StartsWith("rls_")).Select(x => x.ChannelName).OrderBy(x => x).ToList();

    [Fact(DisplayName = "RLS + interceptor: cada tenant ve solo lo suyo; sin contexto no se ve nada; no se escribe en otro tenant")]
    public void Rls_IsolatesTenants()
    {
        if (!Available) return;
        AdminExec(
            "alter table command_counters disable row level security",
            "delete from command_counters where channel_name like 'rls_%'",
            "insert into command_counters (tenant_id, channel_name, user_id, command_name, counter_value, last_modified_at, created_at) values (1,'rls_t1',9101,'c',1,now(),now()),(2,'rls_t2',9102,'c',1,now(),now())",
            "alter table command_counters enable row level security",
            "alter table command_counters force row level security");
        try
        {
            // Sin interceptor (Rls=off): no se fija tenant -> la política devuelve 0 filas (falla cerrada)
            using (var off = Ctx("off")) Assert.Empty(Names(off));
            using (var t1 = Ctx("context")) Assert.Equal(new[] { "rls_t1" }, Names(t1));
            using (Decatron.Core.Interfaces.TenantAmbient.Push(2))
            using (var t2 = Ctx("context")) Assert.Equal(new[] { "rls_t2" }, Names(t2));
            // Escribir en otro tenant se rechaza
            using (var w = Ctx("context"))
            {
                w.CommandCounters.Add(new Decatron.Core.Models.CommandCounter { ChannelName = "rls_x", CommandName = "x", UserId = 9103 });
                w.Entry(w.CommandCounters.Local.First()).Property<long>("TenantId").CurrentValue = 2;
                var ex = Assert.ThrowsAny<Exception>(() => w.SaveChanges());
                Assert.Contains("row-level security", ex.GetBaseException().Message);
            }
        }
        finally
        {
            AdminExec("alter table command_counters no force row level security", "alter table command_counters disable row level security",
                      "delete from command_counters where channel_name like 'rls_%'");
        }
    }
}
