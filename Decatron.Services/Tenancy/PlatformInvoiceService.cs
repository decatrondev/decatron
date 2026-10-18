using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Plataforma, Fase 7.6: comprobantes SUNAT de los pagos de plan, con la misma regla fiscal (<see cref="InvoiceDocumentBuilder"/>) y la misma empresa emisora que
/// tiers, DecaCoins y créditos. Un pago de prueba o sin importe nace sin <c>invoice_status</c> y nunca se factura. Recorre los tenants uno a uno porque
/// <c>tenant_payments</c> tiene RLS. Los datos del cliente salen del pago (congelados al comprar), no del perfil actual.
/// </summary>
public sealed class PlatformInvoiceService
{
    private const int MaxAttempts = 5;
    private readonly string? _cs;
    private readonly IConfiguration _cfg;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<PlatformInvoiceService> _log;

    public PlatformInvoiceService(IConfiguration cfg, IHttpClientFactory http, ILogger<PlatformInvoiceService> log)
    { _cs = cfg.GetConnectionString("DefaultConnection"); _cfg = cfg; _http = http; _log = log; }

    private bool Enabled => !string.IsNullOrWhiteSpace(_cfg["DecatronApi:ApiKey"]) && _cfg.GetValue("DecatronApi:Enabled", true);
    private string BaseUrl => (_cfg["DecatronApi:BaseUrl"] ?? "https://decatronapi.decatron.net").TrimEnd('/');

    /// <summary>La misma tabla que usan tiers y DecaCoins: cambiar la empresa en un lado la cambia en todos.</summary>
    private async Task<int?> CompanyIdAsync(CancellationToken ct)
    {
        await using var c = TenantNpgsql.Create(_cs);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT company_id FROM invoicing_settings WHERE id = 1", c);
        if (await cmd.ExecuteScalarAsync(ct) is int saved) return saved;
        return int.TryParse(_cfg["DecatronApi:CompanyId"], out var fromCfg) ? fromCfg : null;
    }

    public async Task<int> ProcessPendingAsync(CancellationToken ct = default)
    {
        if (!Enabled) return 0;
        var tenants = new List<long>();
        await using (var c = TenantNpgsql.Create(_cs, 1))
        {
            await c.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand("SELECT id FROM tenants WHERE id<>1 ORDER BY id", c);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct)) tenants.Add(r.GetInt64(0));
        }
        var done = 0;
        foreach (var t in tenants)
        {
            if (ct.IsCancellationRequested) break;
            var ids = new List<long>();
            await using (var c = TenantNpgsql.Create(_cs, t))
            {
                await c.OpenAsync(ct);
                await using var cmd = new NpgsqlCommand(@"SELECT id FROM tenant_payments WHERE invoice_status = 'PENDING' AND invoice_attempts < @max
                      AND (invoice_last_attempt_at IS NULL OR invoice_last_attempt_at < now() - interval '5 minutes') ORDER BY id LIMIT 20", c);
                cmd.Parameters.AddWithValue("max", MaxAttempts);
                await using var r = await cmd.ExecuteReaderAsync(ct);
                while (await r.ReadAsync(ct)) ids.Add(r.GetInt64(0));
            }
            foreach (var id in ids) if (await EmitAsync(t, id, ct)) done++;
        }
        return done;
    }

    public async Task<bool> EmitAsync(long tenantId, long paymentId, CancellationToken ct = default)
    {
        if (!Enabled) return false;
        string? slug = null, plan = null, name = null, country = null, docType = null, docNum = null, currency = "PEN"; decimal pen = 0; short months = 0; DateTime paidAt = default;
        bool preferFactura = false, isTest = false; int addons = 0;
        await using (var c = TenantNpgsql.Create(_cs, tenantId))
        {
            await c.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand(@"SELECT t.slug, pl.name, p.customer_name, p.tax_country, p.customer_doc_type, p.customer_doc_number, COALESCE(p.amount_pen, 0),
                  p.period_months, COALESCE(p.paid_at, p.created_at), p.prefer_factura, p.is_test, COALESCE(array_length(p.addons, 1), 0)
                  FROM tenant_payments p JOIN tenants t ON t.id = p.tenant_id LEFT JOIN plans pl ON pl.id = p.plan_id WHERE p.id = @i AND p.status = 'paid'", c);
            cmd.Parameters.AddWithValue("i", paymentId);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return false;
            slug = r.GetString(0); plan = r.IsDBNull(1) ? null : r.GetString(1); name = r.IsDBNull(2) ? null : r.GetString(2); country = r.IsDBNull(3) ? null : r.GetString(3);
            docType = r.IsDBNull(4) ? null : r.GetString(4); docNum = r.IsDBNull(5) ? null : r.GetString(5); pen = r.GetDecimal(6); months = r.GetInt16(7);
            paidAt = r.GetDateTime(8); preferFactura = r.GetBoolean(9); isTest = r.GetBoolean(10); addons = r.GetInt32(11);
        }
        // Segunda barrera: una venta de prueba o sin importe nunca se declara.
        if (isTest || pen <= 0) { await MarkAsync(tenantId, paymentId, null, isTest ? "Pago de prueba, no se emite" : "Sin importe cobrado", ct); return false; }

        var companyId = await CompanyIdAsync(ct);
        if (companyId is null) { _log.LogWarning("No hay empresa emisora configurada; el pago {Id} queda pendiente", paymentId); return false; }

        var desc = $"Decatron Plataforma - plan {plan} ({months} {(months == 1 ? "mes" : "meses")}){(addons > 0 ? $" + {addons} módulo(s)" : "")} - {slug}";
        var (endpoint, body) = InvoiceDocumentBuilder.Armar(new VentaParaComprobante($"plat-{tenantId}-{paymentId}", desc, pen, currency, paidAt, name, country, docType, docNum, preferFactura), companyId.Value);
        try
        {
            using var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(60);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _cfg["DecatronApi:ApiKey"]);
            var response = await client.PostAsync($"{BaseUrl}/api/v1/facturacion/documents/{endpoint}", new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"), ct);
            var text = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;

            // Un 4xx es un problema del contenido: reintentar igual fallaría; queda en ERROR para revisarlo.
            if (!response.IsSuccessStatusCode && (int)response.StatusCode < 500)
            {
                var msg = root.TryGetProperty("message", out var m) ? m.GetString() : text;
                _log.LogError("Comprobante del pago {Id} rechazado: {Msg}", paymentId, msg);
                await MarkAsync(tenantId, paymentId, "ERROR", msg, ct);
                return false;
            }
            if (!response.IsSuccessStatusCode) { await NoteAttemptAsync(tenantId, paymentId, $"HTTP {(int)response.StatusCode}", ct); return false; }
            if (!root.TryGetProperty("document", out var d)) { await NoteAttemptAsync(tenantId, paymentId, "Respuesta sin documento", ct); return false; }

            int? docId = d.TryGetProperty("id", out var i) ? i.GetInt32() : null;
            var series = d.TryGetProperty("series", out var s) ? s.GetString() : null;
            int? number = d.TryGetProperty("number", out var n) ? n.GetInt32() : null;
            var type = d.TryGetProperty("type", out var t) ? t.GetString() : null;
            var status = d.TryGetProperty("sunatStatus", out var st) ? st.GetString() : "PENDING";
            var err = root.TryGetProperty("error", out var er) ? er.GetString() : null;
            await SaveAsync(tenantId, paymentId, status, docId, type, series, number, err, ct);
            _log.LogInformation("Pago de plan {Id}: comprobante {Type} {Series}-{Number} -> {Status}", paymentId, type, series, number, status);
            return status == "ACCEPTED";
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error emitiendo el comprobante del pago {Id}", paymentId);
            await NoteAttemptAsync(tenantId, paymentId, ex.Message, ct);
            return false;
        }
    }

    private async Task Run(long tenant, string sql, Action<NpgsqlParameterCollection> bind, CancellationToken ct)
    {
        await using var c = TenantNpgsql.Create(_cs, tenant);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand(sql, c);
        bind(cmd.Parameters);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private Task SaveAsync(long tenant, long id, string? status, int? docId, string? type, string? series, int? number, string? error, CancellationToken ct)
        => Run(tenant, @"UPDATE tenant_payments SET invoice_status=@s, invoice_document_id=@d, invoice_type=@t, invoice_series=@se, invoice_number=@n, invoice_error=@e,
              invoice_attempts = invoice_attempts + 1, invoice_last_attempt_at = now() WHERE id=@i", p =>
        {
            p.AddWithValue("i", id); p.AddWithValue("s", (object?)status ?? DBNull.Value); p.AddWithValue("d", (object?)docId ?? DBNull.Value);
            p.AddWithValue("t", (object?)type ?? DBNull.Value); p.AddWithValue("se", (object?)series ?? DBNull.Value);
            p.AddWithValue("n", (object?)number ?? DBNull.Value); p.AddWithValue("e", (object?)error ?? DBNull.Value);
        }, ct);

    private Task MarkAsync(long tenant, long id, string? status, string? error, CancellationToken ct)
        => Run(tenant, "UPDATE tenant_payments SET invoice_status=@s, invoice_error=@e, invoice_attempts = invoice_attempts + 1, invoice_last_attempt_at = now() WHERE id=@i", p =>
        { p.AddWithValue("i", id); p.AddWithValue("s", (object?)status ?? DBNull.Value); p.AddWithValue("e", (object?)error ?? DBNull.Value); }, ct);

    /// <summary>Sigue PENDING para reintentar, salvo que se agoten los intentos: ahí pasa a ERROR para que alguien lo mire.</summary>
    private Task NoteAttemptAsync(long tenant, long id, string? error, CancellationToken ct)
        => Run(tenant, @"UPDATE tenant_payments SET invoice_error=@e, invoice_attempts = invoice_attempts + 1, invoice_last_attempt_at = now(),
              invoice_status = CASE WHEN invoice_attempts + 1 >= @max THEN 'ERROR' ELSE invoice_status END WHERE id=@i", p =>
        { p.AddWithValue("i", id); p.AddWithValue("max", MaxAttempts); p.AddWithValue("e", (object?)error ?? DBNull.Value); }, ct);
}
