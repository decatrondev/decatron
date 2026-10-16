using System.IO.Compression;
using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 5.6: exportación sin secretos y borrado acotado al tenant. Corre sobre decatron_schema con el tenant 9103 (fijo, solo para estas pruebas).</summary>
[Collection("entitlements-db")]
public class TenantDataAdminTests : IDisposable
{
    private static string? Conn => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(Conn);
    private const long T = 9103, Other = 9101, Uid = 990103;
    private readonly IConfiguration _cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = Conn }).Build();

    private static NpgsqlConnection Open(long tenant) { var c = TenantNpgsql.Create(Conn, tenant); c.Open(); return c; }
    private static void Exec(long tenant, string sql) { using var c = Open(tenant); using var cmd = new NpgsqlCommand(sql, c); cmd.ExecuteNonQuery(); }
    private static long Count(long tenant, string sql) { using var c = Open(tenant); using var cmd = new NpgsqlCommand(sql, c); return Convert.ToInt64(cmd.ExecuteScalar()); }

    private (TenantDataAdmin d, Entitlements e) Make()
    {
        var e = new Entitlements(_cfg, NullLogger<Entitlements>.Instance);
        return (new TenantDataAdmin(_cfg, e, NullLogger<TenantDataAdmin>.Instance), e);
    }

    public TenantDataAdminTests()
    {
        if (!Available) return;
        if (Count(1, "select count(*) from tenants where id=9103") == 0) return; // sin el tenant fijo las pruebas se omiten
        Dispose();
        Exec(1, "UPDATE tenants SET status='active' WHERE id=9103");
        Exec(1, $@"INSERT INTO users (id, twitch_id, login, display_name, email, profile_image_url, offline_image_url, broadcaster_type, view_count, description,
            access_token, refresh_token, token_expiration, created_at, updated_at, is_active, unique_id)
            VALUES ({Uid}, 'zz-tw-{Uid}', 'zzborrado', 'Z', '', '', '', '', 0, '', 'a', 'b', now(), now(), now(), true, 'zz-uid-{Uid}')");
        Exec(T, $"INSERT INTO channels (tenant_id, platform, external_id, user_id, login) VALUES ({T}, 'twitch', 'zz-tw-{Uid}', {Uid}, 'zzborrado')");
        Exec(T, $"INSERT INTO tenant_members (tenant_id, user_id, role) VALUES ({T}, {Uid}, 'viewer')");
        Exec(T, $"INSERT INTO chat_overlay_configs (user_id, config) VALUES ({Uid}, '{{\"a\":1}}')");
        Exec(Other, $"INSERT INTO chat_overlay_configs (user_id, config) VALUES ({Uid}, '{{\"otro\":1}}')");
    }

    public void Dispose()
    {
        if (!Available) return;
        if (Count(1, "select count(*) from tenants where id=9103") == 0) return;
        Exec(T, "DELETE FROM chat_overlay_configs; DELETE FROM tenant_subscriptions; DELETE FROM tenant_members; DELETE FROM channels");
        Exec(Other, $"DELETE FROM chat_overlay_configs WHERE user_id={Uid}");
        Exec(1, $"DELETE FROM users WHERE id={Uid}");
    }

    private static bool Ready => Available && Count(1, "select count(*) from tenants where id=9103") == 1;

    [Fact(DisplayName = "Exportar: zip con las tablas del tenant, sin credenciales ni tokens, y sin filas de otro tenant")]
    public async Task Exporta_SinSecretos()
    {
        if (!Ready) return;
        var (d, _) = Make();
        using var ms = new MemoryStream();
        var r = await d.ExportAsync(T, ms, "test");
        Assert.True(r.Ok);
        using var zip = new ZipArchive(new MemoryStream(ms.ToArray()), ZipArchiveMode.Read);
        var names = zip.Entries.Select(e => e.FullName).ToList();
        Assert.Contains("MANIFEST.json", names);
        Assert.Contains("chat_overlay_configs.jsonl", names);
        Assert.Contains("users.jsonl", names);
        Assert.DoesNotContain("tenant_credentials.jsonl", names);
        Assert.DoesNotContain("tenant_keys.jsonl", names);
        using var rd = new StreamReader(zip.GetEntry("chat_overlay_configs.jsonl")!.Open());
        var text = await rd.ReadToEndAsync();
        Assert.Contains($"\"user_id\":{Uid}", text);                                  // contenido propio presente
        Assert.DoesNotContain("otro", text);                                          // el de otro tenant no
        using var ur = new StreamReader(zip.GetEntry("users.jsonl")!.Open());
        var users = await ur.ReadToEndAsync();
        Assert.Contains("zzborrado", users);
        Assert.DoesNotContain("access_token", users);
    }

    [Fact(DisplayName = "Borrar: confirmación obligatoria, no borra un tenant operativo, y borra solo lo suyo (cuentas propias incluidas)")]
    public async Task Borra_Acotado()
    {
        if (!Ready) return;
        var (d, e) = Make();
        Assert.Equal(400, (await d.PurgeAsync(1, "decatron", "test")).Status);                // el #1 jamás
        Assert.Equal(400, (await d.PurgeAsync(T, "otro-slug", "test")).Status);               // confirmación equivocada
        Exec(T, $"INSERT INTO tenant_subscriptions (tenant_id, plan_id, status) SELECT {T}, id, 'active' FROM plans LIMIT 1");
        e.Invalidate(T);
        if (Count(T, "select count(*) from tenant_subscriptions") == 1)                         // solo si hay algún plan en el catálogo de pruebas
            Assert.Equal(409, (await d.PurgeAsync(T, "zz-c", "test")).Status);                  // operativo: no se borra
        Exec(T, "DELETE FROM tenant_subscriptions");
        e.Invalidate(T);

        var r = await d.PurgeAsync(T, "zz-c", "test");
        Assert.True(r.Ok, r.Code);
        Assert.Equal(0, Count(T, "select count(*) from chat_overlay_configs"));
        Assert.Equal(0, Count(T, "select count(*) from channels"));
        Assert.Equal(0, Count(T, "select count(*) from tenant_members"));
        Assert.Equal(1, Count(Other, $"select count(*) from chat_overlay_configs where user_id={Uid}")); // lo de otro tenant sigue
        Assert.Equal(0, Count(1, $"select count(*) from users where id={Uid}"));                    // la cuenta era solo de este tenant
        using var c = Open(1); using var q = new NpgsqlCommand("select status from tenants where id=9103", c);
        Assert.Equal("closed", q.ExecuteScalar());
    }
}
