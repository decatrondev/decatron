using System.Net;
using System.Text;
using Decatron.Core.Interfaces;
using Decatron.Services.Tenancy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Fase 7.6: comprobantes de los pagos de plan. Corre sobre decatron_schema (tenant 9101); DecatronAPI es un doble: no se emite nada real.</summary>
[Collection("entitlements-db")]
public class PlatformInvoiceTests : IDisposable
{
    private static string? App => Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
    private static string? Owner => Environment.GetEnvironmentVariable("DECATRON_SCHEMA_CONN");
    private static bool Available => !string.IsNullOrWhiteSpace(App) && !string.IsNullOrWhiteSpace(Owner);
    private const long A = 9101;

    private sealed class FakeHandler : HttpMessageHandler
    {
        public readonly List<(string Url, string Body)> Calls = new();
        public HttpStatusCode Status = HttpStatusCode.OK;
        public string Response = "{\"document\":{\"id\":55,\"series\":\"B001\",\"number\":7,\"type\":\"boleta\",\"sunatStatus\":\"ACCEPTED\"}}";
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            Calls.Add((req.RequestUri!.ToString(), req.Content is null ? "" : await req.Content.ReadAsStringAsync(ct)));
            return new HttpResponseMessage(Status) { Content = new StringContent(Response, Encoding.UTF8, "application/json") };
        }
    }

    private sealed class Factory : IHttpClientFactory
    {
        private readonly HttpMessageHandler _h; public Factory(HttpMessageHandler h) { _h = h; }
        public HttpClient CreateClient(string name) => new(_h, disposeHandler: false);
    }

    private static PlatformInvoiceService Make(FakeHandler h, bool enabled = true)
    {
        var d = new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = App, ["DecatronApi:CompanyId"] = "1", ["DecatronApi:BaseUrl"] = "https://api.example.test" };
        if (enabled) d["DecatronApi:ApiKey"] = "clave-de-prueba";
        return new PlatformInvoiceService(new ConfigurationBuilder().AddInMemoryCollection(d).Build(), new Factory(h), NullLogger<PlatformInvoiceService>.Instance);
    }

    private static void Exec(string conn, long? tenant, string sql)
    {
        using var c = tenant is long t ? TenantNpgsql.Create(conn, t) : new NpgsqlConnection(conn);
        c.Open(); new NpgsqlCommand(sql, c).ExecuteNonQuery();
    }

    private static T Scalar<T>(string sql)
    {
        using var c = TenantNpgsql.Create(App, A); c.Open();
        var v = new NpgsqlCommand(sql, c).ExecuteScalar();
        return v is null or DBNull ? default! : (T)v;
    }

    public PlatformInvoiceTests() { if (Available) Dispose(); }

    public void Dispose()
    {
        if (!Available) return;
        Exec(Owner!, null, "DELETE FROM tenant_payments WHERE tenant_id = 9101");
    }

    private static long Pay(string country, bool test = false, string status = "PENDING", decimal pen = 72.20m, string? docType = "DNI", string? docNum = "12345678", bool factura = false)
    {
        using var c = TenantNpgsql.Create(App, A); c.Open();
        var cmd = new NpgsqlCommand(@"INSERT INTO tenant_payments (purpose, period_months, provider, amount_usd, amount_pen, tax_country, status, is_test, paid_at, invoice_status,
              customer_name, customer_doc_type, customer_doc_number, prefer_factura) VALUES ('plan', 1, 'culqi', 19, @pen, @cc, 'paid', @t, now(), @st, 'Cliente Prueba', @dt, @dn, @pf) RETURNING id", c);
        cmd.Parameters.AddWithValue("pen", pen); cmd.Parameters.AddWithValue("cc", country); cmd.Parameters.AddWithValue("t", test);
        cmd.Parameters.AddWithValue("st", (object?)status ?? DBNull.Value); cmd.Parameters.AddWithValue("dt", (object?)docType ?? DBNull.Value);
        cmd.Parameters.AddWithValue("dn", (object?)docNum ?? DBNull.Value); cmd.Parameters.AddWithValue("pf", factura);
        return (long)cmd.ExecuteScalar()!;
    }

    [Fact(DisplayName = "Un pago de Peru sale como boleta con el id propio y guarda la serie y el estado")]
    public async Task Boleta()
    {
        if (!Available) return;
        var id = Pay("PE");
        var h = new FakeHandler();
        Assert.True(await Make(h).EmitAsync(A, id));
        var call = Assert.Single(h.Calls);
        Assert.EndsWith("/api/v1/facturacion/documents/boleta", call.Url);
        Assert.Contains($"plat-{A}-{id}", call.Body);
        Assert.Equal("ACCEPTED", Scalar<string>($"SELECT invoice_status FROM tenant_payments WHERE id={id}"));
        Assert.Equal("B001", Scalar<string>($"SELECT invoice_series FROM tenant_payments WHERE id={id}"));
        Assert.Equal(7, Scalar<int>($"SELECT invoice_number FROM tenant_payments WHERE id={id}"));
    }

    [Fact(DisplayName = "Fuera de Peru es factura de exportacion sin IGV")]
    public async Task Exportacion()
    {
        if (!Available) return;
        var id = Pay("US", docType: null, docNum: null);
        var h = new FakeHandler();
        await Make(h).EmitAsync(A, id);
        Assert.EndsWith("/documents/factura", h.Calls[0].Url);
        Assert.Contains("0201", h.Calls[0].Body);
    }

    [Fact(DisplayName = "Un pago de prueba o sin importe nunca llama a DecatronAPI")]
    public async Task Prueba_no_se_factura()
    {
        if (!Available) return;
        var h = new FakeHandler();
        Assert.False(await Make(h).EmitAsync(A, Pay("PE", test: true)));
        Assert.False(await Make(h).EmitAsync(A, Pay("PE", pen: 0m)));
        Assert.Empty(h.Calls);
    }

    [Fact(DisplayName = "Sin clave de DecatronAPI no hace nada")]
    public async Task Deshabilitado()
    {
        if (!Available) return;
        var id = Pay("PE");
        var h = new FakeHandler();
        Assert.Equal(0, await Make(h, enabled: false).ProcessPendingAsync());
        Assert.Empty(h.Calls);
        Assert.Equal("PENDING", Scalar<string>($"SELECT invoice_status FROM tenant_payments WHERE id={id}"));
    }

    [Fact(DisplayName = "Un 4xx queda en ERROR; un 5xx sigue PENDING y cuenta el intento")]
    public async Task Errores()
    {
        if (!Available) return;
        var a = Pay("PE"); var b = Pay("PE");
        var h = new FakeHandler { Status = HttpStatusCode.BadRequest, Response = "{\"message\":\"documento invalido\"}" };
        await Make(h).EmitAsync(A, a);
        Assert.Equal("ERROR", Scalar<string>($"SELECT invoice_status FROM tenant_payments WHERE id={a}"));
        h.Status = HttpStatusCode.BadGateway; h.Response = "{}";
        await Make(h).EmitAsync(A, b);
        Assert.Equal("PENDING", Scalar<string>($"SELECT invoice_status FROM tenant_payments WHERE id={b}"));
        Assert.Equal(1, Scalar<int>($"SELECT invoice_attempts FROM tenant_payments WHERE id={b}"));
    }

    [Fact(DisplayName = "El recorrido emite los pendientes de los tenants")]
    public async Task Recorrido()
    {
        if (!Available) return;
        var id = Pay("PE");
        var h = new FakeHandler();
        Assert.Equal(1, await Make(h).ProcessPendingAsync());
        Assert.Equal("ACCEPTED", Scalar<string>($"SELECT invoice_status FROM tenant_payments WHERE id={id}"));
    }
}
