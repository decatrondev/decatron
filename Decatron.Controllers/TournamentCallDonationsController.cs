using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Decatron.Attributes;
using Decatron.Core.Helpers;
using Decatron.Data;
using Decatron.Services;
using Decatron.Services.Finance;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Decatron.Controllers;

/// <summary>Optional destination of the existing free donation. No tiers or general donations are changed.</summary>
[ApiController, Route("api/supporters/call-donations")]
public class TournamentCallDonationsController(TournamentCallContributionService service, DecatronDbContext db,
    IPaymentModeService paymentMode, ExchangeRate rate, IHttpClientFactory clients, ILogger<TournamentCallDonationsController> logger) : ControllerBase
{
    public record ReceiptRequest(string ReceiptKey);
    public record ChargeRequest(string ReceiptKey, string CulqiToken, string CulqiEmail, string? FirstName, string? LastName,
        string? DeviceFingerPrintId, Authentication3DsRequest? Authentication3Ds);
    public record RecoveryRequest(string ChargeId);

    [AllowAnonymous, HttpPost("prepare"), RequestSizeLimit(4 * 1024)]
    public Task<IActionResult> Prepare(CallDonationInput input) => Execute(async () => {
        var (publicKey, _, isTest) = await paymentMode.GetLlavesAsync();
        if (string.IsNullOrWhiteSpace(publicKey)) return StatusCode(503, new { code = "payment_unavailable" });
        var (intent, key) = await service.Prepare(input, await rate.PenPerUsdAsync(), DateTimeOffset.UtcNow, isTest, publicKey, await CurrentUserId());
        return Ok(new { receiptKey = key, intent.Reference, intent.AmountUsd, intent.AmountPen, publicKey, isTest });
    });

    /// <summary>Usuario activo de la sesion, o null si el aporte es anonimo.</summary>
    private async Task<long?> CurrentUserId() => long.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var own) &&
        await db.Users.AnyAsync(u => u.Id == own && u.IsActive) ? own : null;

    /// <summary>Aportes de la persona con sesion, por su cuenta y no por el recibo de una pestana.</summary>
    [Authorize, HttpGet("mine")]
    public Task<IActionResult> Mine() => Execute(async () => await CurrentUserId() is long id ? Ok(await service.Mine(id)) : Unauthorized());

    [AllowAnonymous, HttpPost("receipt"), RequestSizeLimit(1024)]
    public Task<IActionResult> Receipt(ReceiptRequest request) => Execute(async () => Ok(await service.Receipt(request.ReceiptKey)));

    [AllowAnonymous, HttpPost("withdraw-identity"), RequestSizeLimit(1024)]
    public Task<IActionResult> Withdraw(ReceiptRequest request) => Execute(async () => {
        await service.WithdrawConsent(request.ReceiptKey, DateTimeOffset.UtcNow); return Ok(await service.Receipt(request.ReceiptKey));
    });

    [AllowAnonymous, HttpPost("cancel"), RequestSizeLimit(1024)]
    public Task<IActionResult> Cancel(ReceiptRequest request) => Execute(async () => {
        await service.Cancel(request.ReceiptKey, DateTimeOffset.UtcNow); return Ok(await service.Receipt(request.ReceiptKey));
    });

    [AllowAnonymous, HttpPost("charge"), RequestSizeLimit(8 * 1024)]
    public Task<IActionResult> Charge(ChargeRequest request) => Execute(async () => {
        if (!TournamentCallApplicationRules.Text(request.CulqiToken, 255, true) ||
            !TournamentCallApplicationRules.Text(request.CulqiEmail, 254, true) ||
            !TournamentCallApplicationRules.Text(request.FirstName ?? "", 100) || !TournamentCallApplicationRules.Text(request.LastName ?? "", 100) ||
            !TournamentCallApplicationRules.Text(request.DeviceFingerPrintId ?? "", 255)) return BadRequest(new { code = "invalid_payment" });
        var (publicKey, secret, isTest) = await paymentMode.GetLlavesAsync();
        if (string.IsNullOrWhiteSpace(secret)) return StatusCode(503, new { code = "payment_unavailable" });
        var prepared = await service.FromReceipt(request.ReceiptKey);
        if (prepared.State != "charged" && (prepared.IsTest != isTest || prepared.PaymentKeyHash != TournamentCallContributionRules.Hash(publicKey)))
            return Conflict(new { code = "payment_configuration_changed" });
        var intent = await service.Claim(request.ReceiptKey, request.CulqiToken, request.DeviceFingerPrintId, request.Authentication3Ds != null, DateTimeOffset.UtcNow);
        if (intent.State == "charged") return Ok(new { success = true, receipt = await service.Receipt(request.ReceiptKey) });
        try
        {
            using var client = clients.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secret);
            var payload = new {
                amount = (int)(intent.AmountPen * 100), currency_code = "PEN", email = request.CulqiEmail, source_id = request.CulqiToken,
                capture = true, order_number = intent.Reference, description = intent.Reference,
                antifraud_details = Culqi3Ds.Antifraude(request.FirstName, request.LastName, request.DeviceFingerPrintId, null, "Donante"),
                metadata = new Dictionary<string,string> { ["type"] = "donation", ["call_reference"] = intent.Reference }
            };
            using var response = await client.PostAsync("https://api.culqi.com/v2/charges", new StringContent(
                Culqi3Ds.ArmarCuerpo(payload, request.Authentication3Ds), Encoding.UTF8, "application/json"));
            var body = await response.Content.ReadAsStringAsync();
            if (request.Authentication3Ds == null && response.IsSuccessStatusCode && Culqi3Ds.PideAutenticar(body))
            {
                await service.SetState(intent, "authenticating", DateTimeOffset.UtcNow);
                return Ok(new { requires3DS = true, amount = (int)(intent.AmountPen * 100), currency = "PEN" });
            }
            // Even an error can be ambiguous (duplicate, timeout upstream). Leave it for reconciliation, never re-charge.
            if (!response.IsSuccessStatusCode) {
                if ((int)response.StatusCode is >= 400 and < 500 && DefiniteDecline(body)) {
                    await service.SetState(intent, "failed", DateTimeOffset.UtcNow);
                    return BadRequest(new { code = "payment_declined" });
                }
                await service.SetState(intent, "uncertain", DateTimeOffset.UtcNow);
                return Conflict(new { code = "payment_review_required" });
            }
            using var document = JsonDocument.Parse(body);
            var charge = document.RootElement;
            if (!ValidCharge(charge, intent.Reference, intent.AmountPen)) throw new CallContributionException("payment_review_required");
            var chargeId = charge.GetProperty("id").GetString()!;
            var userId = await CurrentUserId();
            await service.Complete(intent, chargeId, CargoDePrueba.Es(isTest, chargeId), request.CulqiEmail,
                $"{request.FirstName} {request.LastName}".Trim(), userId, DateTimeOffset.UtcNow);
            return Ok(new { success = true, receipt = await service.Receipt(request.ReceiptKey) });
        }
        catch (Exception ex)
        {
            // A saved processing intent is already a durable recovery marker. Do not issue another provider request.
            logger.LogError("[CallDonation] Resultado pendiente de conciliación para {Reference}. Tipo: {ErrorType}", intent.Reference, ex.GetType().Name);
            return Conflict(new { code = "payment_review_required" });
        }
    });

    [Authorize, RequireSystemOwner, HttpPost("reconcile/{id:guid}"), RequestSizeLimit(1024)]
    public Task<IActionResult> Reconcile(Guid id, RecoveryRequest request) => Execute(async () => {
        if (request.ChargeId == null || !Regex.IsMatch(request.ChargeId, "^chr_(test|live)_[a-zA-Z0-9]+$")) return BadRequest(new { code = "invalid_payment" });
        var intent = await service.RecoveryIntent(id);
        if (intent.State == "charged") return Ok(new { success = true });
        var (_, secret, isTest) = await paymentMode.GetLlavesAsync();
        using var client = clients.CreateClient(); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secret);
        using var response = await client.GetAsync("https://api.culqi.com/v2/charges/" + request.ChargeId);
        if (!response.IsSuccessStatusCode) return BadRequest(new { code = "invalid_payment" });
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var charge = document.RootElement;
        if (!ValidCharge(charge, intent.Reference, intent.AmountPen) || charge.GetProperty("id").GetString() != request.ChargeId)
            return BadRequest(new { code = "invalid_payment" });
        await service.Complete(intent, request.ChargeId, CargoDePrueba.Es(isTest, request.ChargeId), "", "", null, DateTimeOffset.UtcNow);
        return Ok(new { success = true });
    });

    private static bool ValidCharge(JsonElement charge, string reference, decimal amount) =>
        charge.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.String && Regex.IsMatch(id.GetString() ?? "", "^chr_(test|live)_[a-zA-Z0-9]+$") &&
        charge.TryGetProperty("object", out var obj) && obj.GetString() == "charge" &&
        charge.TryGetProperty("amount", out var gross) && gross.TryGetInt64(out var cents) && cents == amount * 100 &&
        (charge.TryGetProperty("currency_code", out var currency) || charge.TryGetProperty("currency", out currency)) && currency.GetString() == "PEN" &&
        charge.TryGetProperty("capture", out var captured) && captured.ValueKind == JsonValueKind.True &&
        charge.TryGetProperty("amount_refunded", out var refund) && refund.TryGetInt64(out var refunded) && refunded == 0 &&
        (!charge.TryGetProperty("current_amount", out var current) || current.TryGetInt64(out var currentCents) && currentCents == amount * 100) &&
        (!charge.TryGetProperty("dispute", out var dispute) || dispute.ValueKind == JsonValueKind.False) &&
        charge.TryGetProperty("metadata", out var metadata) && metadata.TryGetProperty("call_reference", out var call) && call.GetString() == reference;

    private static bool DefiniteDecline(string body)
    {
        try {
            using var document = JsonDocument.Parse(body); var error = document.RootElement;
            return error.TryGetProperty("object", out var obj) && obj.GetString() == "error" &&
                error.TryGetProperty("type", out var type) && type.GetString() == "card_error" &&
                error.TryGetProperty("code", out var code) && code.GetString() == "card_declined" &&
                error.TryGetProperty("decline_code", out var decline) && decline.GetString() is
                    "expired_card" or "stolen_card" or "lost_card" or "insufficient_funds" or "invalid_cvv" or "incorrect_cvv" or
                    "invalid_card" or "contact_issuer" or "issuer_decline_operation" or "fraudulent" or "culqi_card";
        } catch { return false; }
    }

    private async Task<IActionResult> Execute(Func<Task<IActionResult>> action)
    {
        Response.Headers["Cache-Control"] = "no-store";
        try { return await action(); }
        catch (CallContributionException ex) { return StatusCode(ex.Code == "not_found" ? 404 : ex.Code == "channel_not_owned" ? 403 : ex.Code is "stale_revision" or "donations_closed" or "payment_review_required" or "duplicate_reference" ? 409 : 400, new { code = ex.Code }); }
        catch (Exception ex) {
            logger.LogError("[CallDonation] Operación no completada. Tipo: {ErrorType}", ex.GetType().Name);
            return StatusCode(503, new { code = "payment_unavailable" });
        }
    }
}
