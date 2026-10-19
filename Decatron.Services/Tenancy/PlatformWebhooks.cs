using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Decatron.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Decatron.Services.Tenancy;

/// <summary>
/// Plataforma, Fase 7.5b: avisos (webhooks) de Culqi, como RED DE SEGURIDAD: el pago ya se confirma en el mismo momento en que se cobra. Culqi no documenta cómo firma sus avisos,
/// así que NADA del contenido se da por cierto: el aviso solo sirve para sacar los ids de cargo (<c>chr_live_…</c>/<c>chr_test_…</c>) y cada uno se consulta a Culqi con la llave secreta.
/// Con esa respuesta (la única fuente de verdad) se reconcilia el libro: (1) un cobro autorizado cuyo pago quedó pendiente o fallido (corte entre el cobro y la confirmación) se confirma,
/// (2) un cobro reembolsado en Culqi se marca <c>refunded</c> y se registra para anular el comprobante a mano. Solo se actúa sobre cargos con <c>metadata.platform = decatron-platform</c>
/// (la misma cuenta de Culqi cobra DecaCoins, créditos y Supporters con sus propios flujos). El endpoint lleva un secreto en la URL (<c>Platform:Billing:CulqiWebhookSecret</c>, ≥ 24 caracteres).
/// </summary>
public sealed class PlatformWebhooks
{
    private static readonly Regex ChargeId = new(@"chr_(?:live|test)_[A-Za-z0-9]{8,40}", RegexOptions.Compiled);
    public const int MaxBody = 64 * 1024;

    private readonly string? _cs;
    private readonly IConfiguration _cfg;
    private readonly PlatformCheckout _checkout;
    private readonly ILogger<PlatformWebhooks> _log;

    public PlatformWebhooks(IConfiguration cfg, PlatformCheckout checkout, ILogger<PlatformWebhooks> log)
    { _cs = cfg.GetConnectionString("DefaultConnection"); _cfg = cfg; _checkout = checkout; _log = log; }

    /// <summary>Sin secreto configurado (o muy corto) el endpoint no existe: nunca queda abierto por olvido.</summary>
    public bool SecretOk(string? given)
    {
        var secret = _cfg["Platform:Billing:CulqiWebhookSecret"];
        if (string.IsNullOrWhiteSpace(secret) || secret.Length < 24 || string.IsNullOrEmpty(given)) return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(given));
    }

    public static IReadOnlyList<string> ChargeIdsIn(string body) => ChargeId.Matches(body).Select(m => m.Value).Distinct().Take(3).ToList();

    /// <summary>Guarda el aviso, reconcilia cada cargo que menciona y deja anotado qué se hizo. Devuelve ese resumen.</summary>
    public async Task<string> HandleAsync(IPaymentProvider provider, string body, CancellationToken ct = default)
    {
        long eventId;
        await using (var c = TenantNpgsql.Create(_cs, 1))
        {
            await c.OpenAsync(ct);
            await using (var purge = new NpgsqlCommand("DELETE FROM platform_webhook_events WHERE received_at < now() - interval '30 days'", c)) await purge.ExecuteNonQueryAsync(ct);
            await using var ins = new NpgsqlCommand("INSERT INTO platform_webhook_events (body) VALUES (@b) RETURNING id", c);
            ins.Parameters.AddWithValue("b", body.Length <= 8000 ? body : body[..8000]);
            eventId = (long)(await ins.ExecuteScalarAsync(ct))!;
        }

        var results = new List<string>();
        foreach (var id in ChargeIdsIn(body))
        {
            try { results.Add(await ReconcileAsync(provider, id, ct)); }
            catch (Exception ex) when (ex is not OperationCanceledException) { _log.LogError(ex, "tenant.billing.webhook.error charge={Charge}", id); results.Add("error:" + ex.GetType().Name); }
        }
        var summary = results.Count == 0 ? "ignored:no_charge_id" : string.Join(",", results);
        await using (var c = TenantNpgsql.Create(_cs, 1))
        {
            await c.OpenAsync(ct);
            await using var up = new NpgsqlCommand("UPDATE platform_webhook_events SET result=@r WHERE id=@i", c);
            up.Parameters.AddWithValue("r", summary.Length <= 200 ? summary : summary[..200]); up.Parameters.AddWithValue("i", eventId);
            await up.ExecuteNonQueryAsync(ct);
        }
        return summary;
    }

    public async Task<string> ReconcileAsync(IPaymentProvider provider, string chargeId, CancellationToken ct = default)
    {
        var info = await provider.GetChargeAsync(chargeId, ct);
        if (info is null) return "unknown_charge";
        if (!info.Metadata.TryGetValue("platform", out var platform) || platform != "decatron-platform") return "ignored:other_product";
        if (!info.Metadata.TryGetValue("tenant_id", out var t) || !long.TryParse(t, out var tenantId) || tenantId <= 1
            || !info.Metadata.TryGetValue("payment_id", out var p) || !long.TryParse(p, out var paymentId)) return "ignored:no_metadata";

        string status; string? storedCharge; decimal? amountPen;
        await using (var c = TenantNpgsql.Create(_cs, tenantId))
        {
            await c.OpenAsync(ct);
            await using var q = new NpgsqlCommand("SELECT status, provider_charge_id, amount_pen FROM tenant_payments WHERE id=@i AND tenant_id=@t", c);
            q.Parameters.AddWithValue("i", paymentId); q.Parameters.AddWithValue("t", tenantId);
            await using var r = await q.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return "ignored:no_payment";
            status = r.GetString(0); storedCharge = r.IsDBNull(1) ? null : r.GetString(1); amountPen = r.IsDBNull(2) ? null : r.GetDecimal(2);
        }
        if (amountPen is null || PlatformPricing.ToCentimos(amountPen.Value) != info.AmountCentavos)
        {
            _log.LogError("tenant.billing.webhook.mismatch tenant={Tenant} payment={Payment} charge={Charge}: el monto del cargo no coincide con el pago. REVISAR A MANO", tenantId, paymentId, chargeId);
            return "mismatch";
        }

        if (info.Authorized && status != "paid" && status != "refunded")
        {
            if (storedCharge is not null && storedCharge != chargeId) return "conflict";
            var applied = await _checkout.ConfirmAsync(tenantId, paymentId, chargeId, info.IsTest, ct);
            _log.LogWarning("tenant.billing.webhook.recovered tenant={Tenant} payment={Payment} charge={Charge} applied={Applied}: un cobro autorizado estaba sin confirmar", tenantId, paymentId, chargeId, applied);
            return applied ? "recovered" : "ok";
        }
        if (status == "paid" && info.RefundedCentavos > 0)
        {
            await using var c = TenantNpgsql.Create(_cs, tenantId);
            await c.OpenAsync(ct);
            await using var up = new NpgsqlCommand("UPDATE tenant_payments SET status='refunded' WHERE id=@i AND tenant_id=@t AND status='paid'", c);
            up.Parameters.AddWithValue("i", paymentId); up.Parameters.AddWithValue("t", tenantId);
            var n = await up.ExecuteNonQueryAsync(ct);
            if (n > 0) _log.LogWarning("tenant.billing.webhook.refunded tenant={Tenant} payment={Payment} charge={Charge} refunded={Amount}: reembolso hecho en Culqi; falta la nota de crédito del comprobante", tenantId, paymentId, chargeId, info.RefundedCentavos);
            return n > 0 ? "refund_recorded" : "ok";
        }
        return status is "paid" or "refunded" ? "ok" : "noop:" + status;
    }
}
