using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.Tenancy;

/// <summary>Plataforma, Fase 7.5: un proveedor de pago por implementación (Culqi hoy; PayPal y Mercado Pago después). Solo cobra; no sabe de planes.</summary>
public interface IPaymentProvider
{
    string Name { get; }
    Task<ProviderCharge> ChargeAsync(ProviderChargeRequest req, CancellationToken ct = default);
}

public sealed record ProviderChargeRequest(int AmountCentavos, string Currency, string Email, string Token, string Description, string OrderNumber,
    string FirstName, string LastName, IReadOnlyDictionary<string, string> Metadata);

/// <param name="NeedsReview">El proveedor respondió bien pero sin id de cargo: puede haberse cobrado. Revisar a mano, no reintentar.</param>
public sealed record ProviderCharge(bool Ok, string? ChargeId, bool IsTest, string? UserMessage, bool NeedsReview);

public sealed class CulqiPaymentProvider : IPaymentProvider
{
    private readonly IPaymentModeService _mode;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<CulqiPaymentProvider> _log;

    public CulqiPaymentProvider(IPaymentModeService mode, IHttpClientFactory http, ILogger<CulqiPaymentProvider> log) { _mode = mode; _http = http; _log = log; }

    public string Name => "culqi";

    public async Task<ProviderCharge> ChargeAsync(ProviderChargeRequest req, CancellationToken ct = default)
    {
        var (_, secretKey, esTest) = await _mode.GetLlavesAsync(ct);
        using var client = _http.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secretKey);
        var payload = new
        {
            amount = req.AmountCentavos, currency_code = req.Currency, email = req.Email, source_id = req.Token, description = req.Description, order_number = req.OrderNumber,
            antifraud_details = new { first_name = req.FirstName, last_name = req.LastName }, metadata = req.Metadata,
        };
        var response = await client.PostAsync("https://api.culqi.com/v2/charges", new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"), ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            _log.LogWarning("Culqi rechazó el cobro de plataforma: {Status}", (int)response.StatusCode);
            string msg = "Error al procesar el pago con tarjeta";
            try
            {
                using var d = JsonDocument.Parse(body);
                if (d.RootElement.TryGetProperty("user_message", out var um) && um.GetString() is { Length: > 0 } s) msg = s;
                else if (d.RootElement.TryGetProperty("merchant_message", out var mm) && mm.GetString() is { Length: > 0 } s2) msg = s2;
            }
            catch { }
            return new ProviderCharge(false, null, esTest, msg, false);
        }
        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("id", out var idEl) || idEl.GetString() is not { Length: > 0 } id)
        {
            _log.LogError("Culqi respondió {Code} sin id de cargo en un cobro de plataforma. REVISAR A MANO.", (int)response.StatusCode);
            return new ProviderCharge(false, null, esTest, null, true);
        }
        return new ProviderCharge(true, id, CargoDePrueba.Es(esTest, id), null, false); // el id del cargo manda sobre el modo: un chr_test_ nunca es real
    }
}
