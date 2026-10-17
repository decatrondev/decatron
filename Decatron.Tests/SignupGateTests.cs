using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Registro del comprador por aprobación: solo «open» abre el registro; cualquier otra cosa lo cierra.</summary>
public class SignupGateTests
{
    private static IConfiguration Cfg(string? mode)
    {
        var d = new Dictionary<string, string?>();
        if (mode != null) d[SignupGate.ConfigKey] = mode;
        return new ConfigurationBuilder().AddInMemoryCollection(d).Build();
    }

    [Theory(DisplayName = "Sin ajuste o con un valor raro el registro exige aprobación; solo «open» lo abre")]
    [InlineData(null, true)]
    [InlineData("", true)]
    [InlineData("approval", true)]
    [InlineData("APPROVAL", true)]
    [InlineData("abierto", true)]
    [InlineData("false", true)]
    [InlineData("open", false)]
    [InlineData("OPEN", false)]
    [InlineData(" open ", false)]
    public void ModoDeRegistro(string? mode, bool requires)
    {
        Assert.Equal(requires, SignupGate.RequiresApproval(Cfg(mode)));
        Assert.Equal(requires ? "approval" : "open", SignupGate.Mode(Cfg(mode)));
    }

    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_SCHEMA_CONN");

    [Fact(DisplayName = "platform_approved_emails: el correo es la clave (sin duplicados) y el rol de la app puede aprobar y retirar")]
    public void TablaDeAprobados()
    {
        var app = Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
        if (string.IsNullOrWhiteSpace(app)) return;
        using var c = new NpgsqlConnection(app); c.Open();
        using (var who = new NpgsqlCommand("select current_database()", c)) if ((string)who.ExecuteScalar()! != "decatron_schema") return;
        void Exec(string sql) { using var cmd = new NpgsqlCommand(sql, c); cmd.ExecuteNonQuery(); }
        try
        {
            Exec("insert into platform_approved_emails (email, approved_by) values ('zz-gate@example.test', 'prueba')");
            var dup = Assert.Throws<PostgresException>(() => Exec("insert into platform_approved_emails (email, approved_by) values ('zz-gate@example.test', 'otra')"));
            Assert.Equal("23505", dup.SqlState);
            using var q = new NpgsqlCommand("select count(*) from platform_approved_emails where email = 'zz-gate@example.test'", c);
            Assert.Equal(1L, q.ExecuteScalar());
        }
        finally { Exec("delete from platform_approved_emails where email = 'zz-gate@example.test'"); }
    }
}
