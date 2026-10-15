using Npgsql;

namespace Decatron.Tests;

/// <summary>
/// Base desechable `decatron_test` (cadena en DECATRON_TEST_CONN). Cada prueba empieza de un esquema limpio.
/// Sin la variable, <see cref="Available"/> es false y las pruebas se omiten (no fallan).
/// </summary>
public static class TestDb
{
    public static string? Conn => Environment.GetEnvironmentVariable("DECATRON_TEST_CONN");
    public static bool Available => !string.IsNullOrWhiteSpace(Conn);

    public static string Skip => Available ? "" : "DECATRON_TEST_CONN no definida";

    public static NpgsqlConnection Open()
    {
        var c = new NpgsqlConnection(Conn);
        c.Open();
        // Salvaguarda: jamás correr contra una base que no sea la desechable.
        using var cmd = new NpgsqlCommand("select current_database()", c);
        var db = (string)cmd.ExecuteScalar()!;
        if (db != "decatron_test") { c.Dispose(); throw new InvalidOperationException($"Base inesperada: {db}"); }
        return c;
    }

    public static void Exec(NpgsqlConnection c, string sql)
    {
        using var cmd = new NpgsqlCommand(sql, c);
        cmd.ExecuteNonQuery();
    }

    public static T? Scalar<T>(NpgsqlConnection c, string sql)
    {
        using var cmd = new NpgsqlCommand(sql, c);
        var o = cmd.ExecuteScalar();
        return o is null or DBNull ? default : (T)Convert.ChangeType(o, typeof(T));
    }
}
