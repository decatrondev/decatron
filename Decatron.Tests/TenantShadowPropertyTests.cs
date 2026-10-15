using Microsoft.Extensions.Configuration;
using System.Collections;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>
/// Fase 3 (paso 3): la propiedad sombra "TenantId" de DecatronDbContext debe cuadrar con el esquema REAL de producción.
/// Usa `decatron_schema`, una copia solo-esquema (sin datos) de decatron_prod; cadena en DECATRON_SCHEMA_CONN.
/// </summary>
public class TenantShadowPropertyTests
{
    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_SCHEMA_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(Conn);

    private static DecatronDbContext NewContext()
    {
        using (var c = new NpgsqlConnection(Conn))
        {
            c.Open();
            using var cmd = new NpgsqlCommand("select current_database()", c);
            var db = (string)cmd.ExecuteScalar()!;
            if (db != "decatron_schema") throw new InvalidOperationException($"Base inesperada: {db}");
        }
        var options = new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(Conn).Options;
        return new DecatronDbContext(options);
    }

    [Fact(DisplayName = "Las 216 tablas con tenant_id tienen su propiedad TenantId mapeada a tenant_id")]
    public void AllTenantTables_HaveTenantIdProperty()
    {
        if (!Available) return;
        using var ctx = NewContext();
        var mapped = ctx.Model.GetEntityTypes()
            .Where(t => t.BaseType == null && t.GetTableName() != null)
            .Where(t => t.GetProperties().Any(p => p.GetColumnName() == "tenant_id"))
            .Select(t => t.GetTableName()!)
            .ToHashSet();
        var missing = TenantTables.Names.Where(n => !mapped.Contains(n)).OrderBy(n => n).ToList();
        // Una tabla sin entidad en EF (solo SQL crudo) no necesita la propiedad; se listan para revisarlas.
        var withoutEntity = TenantTables.Names.Where(n => !ctx.Model.GetEntityTypes().Any(t => t.GetTableName() == n)).ToHashSet();
        var reallyMissing = missing.Where(n => !withoutEntity.Contains(n)).ToList();
        Assert.True(reallyMissing.Count == 0, "Tablas con entidad pero sin TenantId: " + string.Join(", ", reallyMissing));
    }

    [Fact(DisplayName = "La propiedad TenantId no se envía en los INSERT (se conserva el DEFAULT 1)")]
    public void TenantId_IsDatabaseGenerated()
    {
        if (!Available) return;
        using var ctx = NewContext();
        foreach (var t in ctx.Model.GetEntityTypes().Where(t => t.BaseType == null))
        {
            var p = t.GetProperties().FirstOrDefault(x => x.GetColumnName() == "tenant_id");
            // Solo las propiedades sombra que agrega el contexto; las entidades de la plataforma (Channel, TenantMember) la declaran ellas.
            if (p == null || !p.IsShadowProperty()) continue;
            Assert.Equal(ValueGenerated.OnAdd, p.ValueGenerated);
            Assert.Equal("1", p.GetDefaultValueSql());
        }
    }

    [Fact(DisplayName = "Todas las entidades con tenant_id se pueden consultar contra el esquema real")]
    public void EveryTenantEntity_CanBeQueried()
    {
        if (!Available) return;
        using var ctx = NewContext();
        var setMethod = typeof(DbContext).GetMethods().First(m => m.Name == "Set" && m.GetParameters().Length == 0 && m.IsGenericMethodDefinition);
        var take = typeof(Queryable).GetMethods().First(m => m.Name == "Take" && m.GetParameters()[1].ParameterType == typeof(int));
        var failures = new List<string>();
        foreach (var t in ctx.Model.GetEntityTypes().Where(t => t.BaseType == null && t.GetTableName() != null && t.GetProperties().Any(p => p.GetColumnName() == "tenant_id")))
        {
            try
            {
                var set = setMethod.MakeGenericMethod(t.ClrType).Invoke(ctx, null)!;
                var q = (IQueryable)take.MakeGenericMethod(t.ClrType).Invoke(null, new[] { set, (object)1 })!;
                foreach (var _ in (IEnumerable)q) { }
            }
            catch (Exception ex)
            {
                failures.Add($"{t.GetTableName()} ({t.ClrType.Name}): {ex.GetBaseException().Message}");
            }
        }
        Assert.True(failures.Count == 0, "Consultas que fallan:\n" + string.Join("\n", failures));
    }

    [Fact(DisplayName = "Un INSERT por EF deja tenant_id = 1 (DEFAULT) sin enviarlo")]
    public void Insert_UsesDefaultTenant()
    {
        if (!Available) return;
        // La base es una copia desechable: se quita la FK a users para no sembrar un usuario completo.
        using (var c = new NpgsqlConnection(Conn))
        {
            c.Open();
            using var drop = new NpgsqlCommand("alter table command_counters drop constraint if exists fk_command_counters_user_id", c);
            drop.ExecuteNonQuery();
        }
        using var ctx = NewContext();
        var row = new Decatron.Core.Models.CommandCounter { ChannelName = "prueba", CommandName = "cmd" + Guid.NewGuid().ToString("N")[..8], UserId = 424242 };
        ctx.CommandCounters.Add(row);
        ctx.SaveChanges();
        using var c2 = new NpgsqlConnection(Conn); c2.Open();
        using var cmd = new NpgsqlCommand($"select tenant_id from command_counters where id = {row.Id}", c2);
        Assert.Equal(1L, (long)cmd.ExecuteScalar()!);
    }
}

/// <summary>Modo estricto: el filtro global por tenant (apagado en producción hasta el paso 7 de la Fase 3).</summary>
public class TenantStrictFilterTests
{
    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_SCHEMA_CONN");

    private static DecatronDbContext Ctx(string mode, Decatron.Core.Interfaces.ITenantContext? tenant = null)
    {
        var cfg = new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Platform:TenantContext:Mode"] = mode }).Build();
        var options = new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(Conn).Options;
        return new DecatronDbContext(options, cfg, tenant);
    }

    private sealed class FixedTenant : Decatron.Core.Interfaces.ITenantContext
    {
        public FixedTenant(long id) { TenantId = id; }
        public long TenantId { get; private set; }
        public bool IsResolved => true;
        public Decatron.Core.Interfaces.TenantSource Source => Decatron.Core.Interfaces.TenantSource.User;
        public void Set(Decatron.Core.Interfaces.TenantResolution r) { }
    }

    private static void Seed()
    {
        using var c = new NpgsqlConnection(Conn); c.Open();
        using (var cmd = new NpgsqlCommand("select current_database()", c))
            if ((string)cmd.ExecuteScalar()! != "decatron_schema") throw new InvalidOperationException("Base inesperada");
        foreach (var sql in new[]
        {
            "alter table command_counters drop constraint if exists fk_command_counters_user_id",
            "delete from command_counters where channel_name in ('strict_t1','strict_t2')",
            "insert into command_counters (tenant_id, channel_name, user_id, command_name, counter_value, last_modified_at, created_at) values (1,'strict_t1',9001,'c',1,now(),now()),(2,'strict_t2',9002,'c',1,now(),now())"
        })
        {
            using var cmd = new NpgsqlCommand(sql, c);
            cmd.ExecuteNonQuery();
        }
    }

    private static List<string> Names(DecatronDbContext ctx)
        => ctx.CommandCounters.Where(x => x.ChannelName.StartsWith("strict_")).Select(x => x.ChannelName).OrderBy(x => x).ToList();

    [Fact(DisplayName = "Modo estricto: cada tenant solo ve sus filas; apagado ve todas")]
    public void Strict_FiltersByTenant()
    {
        if (string.IsNullOrWhiteSpace(Conn)) return;
        Seed();
        using (var off = Ctx("off")) Assert.Equal(new[] { "strict_t1", "strict_t2" }, Names(off));
        using (var shadow = Ctx("shadow")) Assert.Equal(new[] { "strict_t1", "strict_t2" }, Names(shadow));
        using (var t1 = Ctx("strict", new FixedTenant(1))) Assert.Equal(new[] { "strict_t1" }, Names(t1));
        using (var t2 = Ctx("strict", new FixedTenant(2))) Assert.Equal(new[] { "strict_t2" }, Names(t2));
        // El tenant ambiente de una tarea de fondo manda sobre el del request
        using (Decatron.Core.Interfaces.TenantAmbient.Push(2))
        using (var amb = Ctx("strict", new FixedTenant(1))) Assert.Equal(new[] { "strict_t2" }, Names(amb));
        // Sin contexto cae al 1, nunca a "todo"
        using (var none = Ctx("strict")) Assert.Equal(new[] { "strict_t1" }, Names(none));
    }
}
