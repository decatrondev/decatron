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
    /// <summary>Guarda la tarjeta de un token para cobrar después sin que el cliente esté presente (cliente + tarjeta en el proveedor). El token se consume.</summary>
    Task<ProviderCard> SaveCardAsync(ProviderCustomer customer, string token, CancellationToken ct = default);
    /// <summary>Borra la tarjeta guardada (cancelar el cobro automático). Mejor esfuerzo: false si el proveedor no la pudo borrar.</summary>
    Task<bool> DeleteCardAsync(string cardId, CancellationToken ct = default);
}

/// <param name="ExistingCustomerId">Si el comprador ya tiene cliente en el proveedor se reutiliza; si no, se crea con los demás datos.</param>
public sealed record ProviderCustomer(string? ExistingCustomerId, string FirstName, string LastName, string Email, string Address, string City, string CountryCode, string Phone);
public sealed record ProviderCard(bool Ok, string? CustomerId, string? CardId, string? Last4, string? Brand, string? UserMessage, bool IsTest);

public sealed record ProviderChargeRequest(int AmountCentavos, string Currency, string Email, string Token, string Description, string OrderNumber,
    string FirstName, string LastName, IReadOnlyDictionary<string, string> Metadata, bool Recurrent = false);

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
        using var msg0 = new HttpRequestMessage(HttpMethod.Post, "https://api.culqi.com/v2/charges") { Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json") };
        // Cobro sin el cliente presente (renovación automática con tarjeta guardada): se marca como recurrente para que el banco lo trate como tal.
        if (req.Recurrent) msg0.Headers.TryAddWithoutValidation("X-Charge-Channel", "recurrent");
        var response = await client.SendAsync(msg0, ct);
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

    public async Task<ProviderCard> SaveCardAsync(ProviderCustomer c, string token, CancellationToken ct = default)
    {
        var (_, secretKey, esTest) = await _mode.GetLlavesAsync(ct);
        using var client = _http.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secretKey);

        async Task<(bool Ok, JsonElement Root, string? Message)> Post(string path, object payload)
        {
            var resp = await client.PostAsync($"https://api.culqi.com/v2/{path}", new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"), ct);
            var text = await resp.Content.ReadAsStringAsync(ct);
            using var d = JsonDocument.Parse(string.IsNullOrWhiteSpace(text) ? "{}" : text);
            var root = d.RootElement.Clone();
            if (resp.IsSuccessStatusCode) return (true, root, null);
            _log.LogWarning("Culqi rechazó {Path} de plataforma: {Status}", path, (int)resp.StatusCode);
            string? m = root.TryGetProperty("user_message", out var um) && um.ValueKind == JsonValueKind.String ? um.GetString() : null;
            return (false, root, m);
        }

        try
        {
            var customerId = c.ExistingCustomerId;
            if (string.IsNullOrWhiteSpace(customerId))
            {
                var cust = await Post("customers", new { first_name = c.FirstName, last_name = c.LastName, email = c.Email, address = c.Address, address_city = c.City, country_code = c.CountryCode, phone_number = c.Phone });
                if (!cust.Ok || !cust.Root.TryGetProperty("id", out var cid) || cid.GetString() is not { Length: > 0 } cidS) return new ProviderCard(false, null, null, null, null, cust.Message ?? "No se pudo guardar la tarjeta", esTest);
                customerId = cidS;
            }
            var card = await Post("cards", new { customer_id = customerId, token_id = token });
            if (!card.Ok || !card.Root.TryGetProperty("id", out var cardId) || cardId.GetString() is not { Length: > 0 } cardS) return new ProviderCard(false, customerId, null, null, null, card.Message ?? "No se pudo guardar la tarjeta", esTest);
            string? last4 = null, brand = null;
            if (card.Root.TryGetProperty("source", out var src))
            {
                if (src.TryGetProperty("last_four", out var l4) && l4.ValueKind == JsonValueKind.String) last4 = l4.GetString();
                if (src.TryGetProperty("iin", out var iin) && iin.TryGetProperty("card_brand", out var br) && br.ValueKind == JsonValueKind.String) brand = br.GetString();
            }
            return new ProviderCard(true, customerId, cardS, last4, brand, null, CargoDePrueba.Es(esTest, cardS));
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException)
        {
            _log.LogError(ex, "No se pudo guardar la tarjeta en Culqi");
            return new ProviderCard(false, null, null, null, null, "No se pudo guardar la tarjeta", esTest);
        }
    }

    public async Task<bool> DeleteCardAsync(string cardId, CancellationToken ct = default)
    {
        try
        {
            var (_, secretKey, _) = await _mode.GetLlavesAsync(ct);
            using var client = _http.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secretKey);
            var resp = await client.DeleteAsync($"https://api.culqi.com/v2/cards/{Uri.EscapeDataString(cardId)}", ct);
            if (!resp.IsSuccessStatusCode) _log.LogWarning("Culqi no pudo borrar una tarjeta guardada: {Status}", (int)resp.StatusCode);
            return resp.IsSuccessStatusCode;
        }
        catch (HttpRequestException ex) { _log.LogWarning(ex, "No se pudo borrar una tarjeta guardada"); return false; }
    }
}
