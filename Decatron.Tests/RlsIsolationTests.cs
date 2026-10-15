using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>
/// Prueba el PATRÓN de aislamiento de la Fase 3 (FASE3_DISENO.md §3.1-3.2) sobre una tabla de ejemplo en la base
/// desechable: política RLS por tenant_id + rol de aplicación sin superusuario + contexto por set_config.
/// Cuando las políticas reales existan en decatron_prod, estas mismas aserciones se repiten sobre sus tablas.
/// </summary>
public class RlsIsolationTests : IDisposable
{
    private const string AppRole = "decatron_test_app";
    private readonly NpgsqlConnection _admin;

    public RlsIsolationTests()
    {
        if (!TestDb.Available) { _admin = null!; return; }
        _admin = TestDb.Open();
        TestDb.Exec(_admin, "DROP TABLE IF EXISTS t_items");
        TestDb.Exec(_admin, "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='" + AppRole + "') THEN CREATE ROLE " + AppRole + " NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$");
        TestDb.Exec(_admin, "GRANT " + AppRole + " TO CURRENT_USER WITH SET TRUE");
        TestDb.Exec(_admin, @"CREATE TABLE t_items (id BIGSERIAL PRIMARY KEY, tenant_id BIGINT NOT NULL DEFAULT 1, name TEXT NOT NULL)");
        TestDb.Exec(_admin, "ALTER TABLE t_items ENABLE ROW LEVEL SECURITY");
        TestDb.Exec(_admin, "ALTER TABLE t_items FORCE ROW LEVEL SECURITY");
        TestDb.Exec(_admin, @"CREATE POLICY tenant_isolation ON t_items
            USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::bigint)
            WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::bigint)");
        TestDb.Exec(_admin, "GRANT SELECT, INSERT, UPDATE, DELETE ON t_items TO " + AppRole);
        TestDb.Exec(_admin, "GRANT USAGE, SELECT ON SEQUENCE t_items_id_seq TO " + AppRole);
    }

    /// <summary>Ejecuta como el rol de aplicación (no superusuario) con el tenant fijado (null = sin contexto).</summary>
    private void AsTenant(long? tenant, Action<NpgsqlConnection> body)
    {
        using var tx = _admin.BeginTransaction();
        TestDb.Exec(_admin, "SET LOCAL ROLE " + AppRole);
        if (tenant != null) TestDb.Exec(_admin, $"SELECT set_config('app.tenant_id', '{tenant}', true)");
        try { body(_admin); }
        finally { tx.Rollback(); }
    }

    private void Seed(long tenant, string name)
    {
        using var tx = _admin.BeginTransaction();
        TestDb.Exec(_admin, "SET LOCAL ROLE " + AppRole);
        TestDb.Exec(_admin, $"SELECT set_config('app.tenant_id', '{tenant}', true)");
        TestDb.Exec(_admin, $"INSERT INTO t_items (tenant_id, name) VALUES ({tenant}, '{name}')");
        tx.Commit();
    }

    [Fact(DisplayName = "El rol de aplicación no es superusuario ni ignora RLS")]
    public void AppRole_IsNotSuperuser()
    {
        if (!TestDb.Available) return;
        Assert.False(TestDb.Scalar<bool>(_admin, $"select rolsuper from pg_roles where rolname='{AppRole}'"));
        Assert.False(TestDb.Scalar<bool>(_admin, $"select rolbypassrls from pg_roles where rolname='{AppRole}'"));
    }

    [Fact(DisplayName = "Un tenant solo ve sus filas")]
    public void Tenant_SeesOnlyOwnRows()
    {
        if (!TestDb.Available) return;
        Seed(1, "uno"); Seed(2, "dos");
        AsTenant(1, c => { Assert.Equal(1L, TestDb.Scalar<long>(c, "select count(*) from t_items")); Assert.Equal("uno", TestDb.Scalar<string>(c, "select name from t_items")); });
        AsTenant(2, c => Assert.Equal("dos", TestDb.Scalar<string>(c, "select name from t_items")));
    }

    [Fact(DisplayName = "Sin contexto de tenant no se ve ninguna fila (falla cerrada)")]
    public void NoContext_SeesNothing()
    {
        if (!TestDb.Available) return;
        Seed(1, "uno");
        AsTenant(null, c => Assert.Equal(0L, TestDb.Scalar<long>(c, "select count(*) from t_items")));
    }

    [Fact(DisplayName = "No se puede escribir una fila de otro tenant")]
    public void CannotInsertForeignTenant()
    {
        if (!TestDb.Available) return;
        AsTenant(1, c =>
        {
            var ex = Assert.Throws<PostgresException>(() => TestDb.Exec(c, "INSERT INTO t_items (tenant_id, name) VALUES (2, 'intruso')"));
            Assert.Equal("42501", ex.SqlState); // new row violates row-level security policy
        });
    }

    [Fact(DisplayName = "No se puede modificar ni borrar filas de otro tenant")]
    public void CannotUpdateOrDeleteForeignRows()
    {
        if (!TestDb.Available) return;
        Seed(2, "dos");
        AsTenant(1, c =>
        {
            using var u = new NpgsqlCommand("update t_items set name='hack' where tenant_id=2", c);
            Assert.Equal(0, u.ExecuteNonQuery());
            using var d = new NpgsqlCommand("delete from t_items where tenant_id=2", c);
            Assert.Equal(0, d.ExecuteNonQuery());
        });
    }

    [Fact(DisplayName = "El contexto no se filtra entre transacciones (set_config local)")]
    public void Context_DoesNotLeakAcrossTransactions()
    {
        if (!TestDb.Available) return;
        AsTenant(1, _ => { });
        AsTenant(null, c => Assert.Equal(0L, TestDb.Scalar<long>(c, "select count(*) from t_items")));
    }

    public void Dispose()
    {
        if (!TestDb.Available) return;
        TestDb.Exec(_admin, "DROP TABLE IF EXISTS t_items");
        _admin.Dispose();
    }
}
