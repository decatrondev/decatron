using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Decatron.Core.Interfaces;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>
/// Fase 3 (paso 6): las conexiones Npgsql directas nacen con app.tenant_id (parámetro de arranque), del ambiente o 1.
/// Las dos primeras pruebas no necesitan base; la tercera usa DECATRON_APP_CONN (decatron_schema/decatron_app) y se omite sin ella.
/// </summary>
public class TenantNpgsqlTests
{
    private const string Base = "Host=localhost;Database=x;Username=u;Password=p";

    [Fact(DisplayName = "La cadena lleva -c app.tenant_id con el tenant ambiente, o 1 sin ambiente")]
    public void ConnectionString_CarriesTenant()
    {
        Assert.Contains("app.tenant_id=1", TenantNpgsql.Create(Base).ConnectionString);
        using (TenantAmbient.Push(7))
            Assert.Contains("app.tenant_id=7", TenantNpgsql.Create(Base).ConnectionString);
        Assert.Contains("app.tenant_id=1", TenantNpgsql.Create(Base).ConnectionString);
    }

    [Fact(DisplayName = "Un app.tenant_id previo en Options se reemplaza y las otras opciones se conservan")]
    public void ConnectionString_ReplacesPrevious()
    {
        var cs = TenantNpgsql.Create(Base + ";Options=-c statement_timeout=5000 -c app.tenant_id=9", 3).ConnectionString;
        Assert.Contains("app.tenant_id=3", cs);
        Assert.DoesNotContain("app.tenant_id=9", cs);
        Assert.Contains("statement_timeout=5000", cs);
    }

    [Fact(DisplayName = "La sesión de PostgreSQL ve el tenant pedido (ambiente, explícito y por defecto)")]
    public void Session_SeesTenant()
    {
        var conn = Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
        if (string.IsNullOrWhiteSpace(conn)) return;

        static long Ask(NpgsqlConnection c)
        {
            c.Open();
            using var cmd = new NpgsqlCommand("select app_tenant_id()", c);
            return (long)cmd.ExecuteScalar()!;
        }

        using (var c = TenantNpgsql.Create(conn, 2)) Assert.Equal(2, Ask(c));
        using (TenantAmbient.Push(3))
        using (var c = TenantNpgsql.Create(conn)) Assert.Equal(3, Ask(c));
        using (var c = TenantNpgsql.Create(conn)) Assert.Equal(1, Ask(c));
    }

    [Fact(DisplayName = "La conexión que EF expone y se abre a mano (GetDbConnection) también nace con el tenant")]
    public void EfRawConnection_CarriesTenant()
    {
        var conn = Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
        if (string.IsNullOrWhiteSpace(conn)) return;
        var cfg = new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Platform:TenantContext:Rls"] = "context" }).Build();

        long Raw(long? ambient)
        {
            using var ctx = new Decatron.Data.DecatronDbContext(
                new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<Decatron.Data.DecatronDbContext>().UseNpgsql(conn).Options, cfg);
            using var _ = ambient is long a ? TenantAmbient.Push(a) : null;
            var c = ctx.Database.GetDbConnection();
            c.Open(); // a mano, sin pasar por ConnectionOpened
            using var cmd = c.CreateCommand();
            cmd.CommandText = "select app_tenant_id()";
            return (long)cmd.ExecuteScalar()!;
        }

        Assert.Equal(2, Raw(2));
        Assert.Equal(1, Raw(null));
    }
}
