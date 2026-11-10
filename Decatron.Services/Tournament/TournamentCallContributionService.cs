using System.Security.Cryptography;
using System.Text.Json;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Decatron.Services.Tournament;

public sealed class CallContributionException(string code) : Exception(code) { public string Code { get; } = code; }
public record CallPublicContribution(string DescriptionEs, string DescriptionEn, string Kind, string Currency,
    decimal Amount, string DisplayName, string ChannelUrl, string Custodian, string DeliveredBy);
public record CallDonationReceipt(string Reference, string State, bool IsTest, string ReviewStatus, bool PublicIdentity,
    decimal? ReceivedAmount, decimal? PrizeAmount, string Currency);

/// <summary>Global owner-managed ledger. Public projections never contain payment or donor identifiers.</summary>
public record CallMyContribution(long Id, string Reference, string Status, bool IsTest, bool PublicIdentity, string Currency,
    decimal? GrossAmount, decimal? ReceivedAmount, decimal? PrizeAmount, long? ApplicationId, DateTimeOffset CreatedAt);

public sealed class TournamentCallContributionService(DecatronDbContext db)
{
    // Sin estado: solo comparte el mismo contexto, asi la validacion de identidad y canales vive en un unico lugar.
    private readonly TournamentCallApplicationService applications = new(db);

    public async Task<object> List(int page)
    {
        page = Math.Clamp(page, 1, 1000000);
        var query = db.TournamentCallContributions.AsNoTracking();
        var items = await query.OrderByDescending(c => c.Id).Skip((page - 1) * 25).Take(25).ToArrayAsync();
        var ids = items.Select(c => c.Id).ToArray();
        var online = await db.TournamentCallDonationIntents.Where(i => i.ContributionId.HasValue && ids.Contains(i.ContributionId.Value))
            .Select(i => i.ContributionId!.Value).ToArrayAsync();
        var paymentIds = items.Where(c => c.PaymentId.HasValue).Select(c => c.PaymentId!.Value).ToArray();
        var testPayments = await db.SupporterPayments.Where(p => paymentIds.Contains(p.Id) && p.IsTest).Select(p => p.Id).ToArrayAsync();
        // Solo para el organizador: quien pago con sesion y su canal. Quien pago sin sesion sigue como anonimo.
        var payers = await db.SupporterPayments.AsNoTracking().Where(p => paymentIds.Contains(p.Id) && p.UserId != null)
            .Select(p => new { p.Id, UserId = p.UserId!.Value }).ToArrayAsync();
        var payerIds = payers.Select(p => p.UserId).ToArray();
        var names = await db.Users.AsNoTracking().Where(u => payerIds.Contains(u.Id))
            .Select(u => new { u.Id, Name = u.DisplayName != null && u.DisplayName != "" ? u.DisplayName : u.Login }).ToArrayAsync();
        var appIds = items.Where(c => c.ApplicationId.HasValue).Select(c => c.ApplicationId!.Value).ToArray();
        var channels = await db.TournamentCallApplications.AsNoTracking().Where(a => appIds.Contains(a.Id))
            .Select(a => new { a.Id, a.ChannelUrl }).ToArrayAsync();
        foreach (var item in items) {
            item.IsOnlineDonation = online.Contains(item.Id);
            item.IsTest = item.PaymentId.HasValue && testPayments.Contains(item.PaymentId.Value);
            var payer = item.PaymentId.HasValue ? payers.FirstOrDefault(p => p.Id == item.PaymentId.Value) : null;
            if (payer != null) item.PayerName = names.FirstOrDefault(n => n.Id == payer.UserId)?.Name ?? "";
            if (item.ApplicationId.HasValue) item.PayerChannelUrl = channels.FirstOrDefault(c => c.Id == item.ApplicationId.Value)?.ChannelUrl ?? "";
        }
        return new { items,
            total = await query.CountAsync(), page, pageSize = 25 };
    }

    public async Task<TournamentCallContribution> Save(long? id, long actor, CallContributionInput input, DateTimeOffset now)
    {
        var error = TournamentCallContributionRules.Validate(input);
        if (error != null) throw new CallContributionException(error);
        var row = id.HasValue ? await db.TournamentCallContributions.SingleOrDefaultAsync(c => c.Id == id) : null;
        if (id.HasValue && row == null) throw new CallContributionException("not_found");
        if ((row?.Revision ?? 0) != input.Revision) throw new CallContributionException("stale_revision");
        if (await db.TournamentCallDonationIntents.AnyAsync(i => i.Reference == input.Reference.Trim() &&
            (!i.ContributionId.HasValue || i.ContributionId != id))) throw new CallContributionException("duplicate_reference");
        if (row?.Status == "reversed" && input.Status != "reversed") throw new CallContributionException("already_reversed");
        var intent = row == null ? null : await db.TournamentCallDonationIntents.SingleOrDefaultAsync(i => i.ContributionId == row.Id);
        // Reparar la union automatica si fallo al pagar: asi confirmar sigue aprobando y publicando la ficha.
        if (row != null && intent != null && !row.ApplicationId.HasValue && !input.ApplicationId.HasValue)
        {
            await TryLinkApplication(intent, row, "", now);
            if (row.ApplicationId.HasValue) input = input with { ApplicationId = row.ApplicationId };
        }
        if (intent != null && (input.PaymentId != row!.PaymentId || input.Reference.Trim() != row.Reference ||
            input.PublicIdentity != intent.PublicIdentity || input.DonorName.Trim() != row.DonorName || input.ChannelUrl != ""))
            throw new CallContributionException("payment_identity_locked");
        // Attaching a payment cannot steal an in-flight/recorded call donation or count a test/tier payment.
        SupporterPayment? payment = null;
        if (input.PaymentId.HasValue)
        {
            payment = await db.SupporterPayments.AsNoTracking().SingleOrDefaultAsync(p => p.Id == input.PaymentId);
            if (payment == null || string.IsNullOrWhiteSpace(payment.Provider) || string.IsNullOrWhiteSpace(payment.PaypalOrderId) ||
                (payment.IsTest && input.Status == "confirmed") || payment.PaymentType != "donation" ||
                input.Kind != "money" || payment.ChargedCurrency != input.Currency || payment.ChargedAmount is not > 0 ||
                input.ReceivedAmount > payment.ChargedAmount) throw new CallContributionException("invalid_payment");
            if (await db.TournamentCallDonationIntents.AnyAsync(i => i.ChargeId == payment.PaypalOrderId &&
                (!i.ContributionId.HasValue || i.ContributionId != id))) throw new CallContributionException("duplicate_reference");
        }
        if (input.ApplicationId.HasValue && !await db.TournamentCallApplications.AnyAsync(a => a.Id == input.ApplicationId && a.Kind == "collaborator"))
            throw new CallContributionException("invalid_application");
        if (row != null && row.PaymentId.HasValue && row.PaymentId != input.PaymentId) throw new CallContributionException("payment_identity_locked");
        if (row == null)
        {
            row = new TournamentCallContribution { CreatedAt = now };
            db.TournamentCallContributions.Add(row);
        }
        row.Reference = input.Reference.Trim(); row.PaymentId = input.PaymentId; row.ApplicationId = input.ApplicationId;
        row.IsOnlineDonation = intent != null; row.IsTest = payment?.IsTest ?? false;
        row.PaymentReference = payment == null ? "" : payment.Provider!.ToLowerInvariant() + ":" + payment.PaypalOrderId;
        row.DonorName = input.DonorName.Trim(); row.ChannelUrl = input.ChannelUrl;
        row.DescriptionEs = input.DescriptionEs.Trim(); row.DescriptionEn = input.DescriptionEn.Trim();
        row.Kind = input.Kind; row.Currency = input.Currency; row.GrossAmount = payment?.ChargedAmount;
        row.ReceivedAmount = input.ReceivedAmount; row.PrizeAmount = input.PrizeAmount;
        row.Custodian = input.Custodian.Trim(); row.DeliveredBy = input.DeliveredBy.Trim(); row.Evidence = input.Evidence.Trim();
        row.PublicIdentity = input.PublicIdentity;
        // Online consent is immutable here; only the receipt holder can withdraw it.
        if (intent == null) row.ConsentEvidence = input.ConsentEvidence.Trim();
        row.Status = input.Status;
        if (input.Status == "confirmed") { row.ConfirmedAt = now; row.ConfirmedBy = actor; }
        row.Revision++; row.UpdatedAt = now;
        await ApplyToApplication(row, actor, now);
        Audit(row, actor, id.HasValue ? "review" : "manual", now);
        await Commit(); return row;
    }

    /// <summary>
    /// Una ficha creada por pago se aprueba al confirmar la recepcion (un solo paso del organizador) y vuelve a pendiente si el aporte
    /// se revierte y no queda otro confirmado. Las fichas enviadas por formulario nunca se aprueban solas.
    /// </summary>
    private async Task ApplyToApplication(TournamentCallContribution row, long actor, DateTimeOffset now)
    {
        if (!row.ApplicationId.HasValue) return;
        var app = await db.TournamentCallApplications.SingleOrDefaultAsync(a => a.Id == row.ApplicationId);
        if (app == null || app.Origin != "payment") return;
        if (row.Status == "confirmed" && app.Status == "pending")
        { app.Status = "approved"; app.ReviewedBy = actor; app.ReviewedAt = now; app.UpdatedAt = now; app.Revision++; }
        else if (row.Status == "reversed" && app.Status == "approved" && !await db.TournamentCallContributions
            .AnyAsync(c => c.ApplicationId == app.Id && c.Id != row.Id && c.Status == "confirmed"))
        { app.Status = "pending"; app.ReviewedBy = null; app.ReviewedAt = null; app.UpdatedAt = now; app.Revision++; }
    }

    /// <summary>
    /// Une el pago a la ficha de colaborador de la persona. Es accesorio: si falla, el pago ya esta registrado y el
    /// organizador sigue viendo quien pago; nunca rompe ni repite el cobro.
    /// </summary>
    private async Task TryLinkApplication(TournamentCallDonationIntent intent, TournamentCallContribution row, string email, DateTimeOffset now)
    {
        if (!intent.UserId.HasValue || !intent.ChannelUserId.HasValue || row.ApplicationId.HasValue) return;
        try
        {
            var id = await applications.EnsureCollaboratorForPayment(intent.UserId.Value, intent.ChannelUserId.Value, intent.PublicIdentity,
                email, intent.AmountUsd, now);
            if (!id.HasValue) return;
            row.ApplicationId = id; row.Revision++; row.UpdatedAt = now; Audit(row, null, "application_linked", now);
            await Commit();
        }
        catch (Exception)
        {
            // Dejar el contexto limpio para que un guardado posterior de la misma peticion no reintente cambios a medias.
            foreach (var entry in db.ChangeTracker.Entries().Where(e => e.State != EntityState.Unchanged && e.Entity is not null &&
                (e.Entity is TournamentCallApplication || ReferenceEquals(e.Entity, row))).ToList())
                entry.State = EntityState.Detached;
        }
    }

    private void Audit(TournamentCallContribution row, long? actor, string action, DateTimeOffset now) =>
        db.TournamentCallContributionEvents.Add(new() { Contribution = row, ActorId = actor, Action = action,
            Snapshot = JsonSerializer.Serialize(row), CreatedAt = now });

    public async Task<CallPublicContribution[]> Public()
    {
        var rows = await db.TournamentCallContributions.AsNoTracking()
            .Where(c => c.Status == "confirmed" && c.PrizeAmount > 0 &&
                (!c.PaymentId.HasValue || db.SupporterPayments.Any(p => p.Id == c.PaymentId && !p.IsTest && p.PaymentType == "donation")))
            .OrderBy(c => c.Id).ToArrayAsync();
        return rows.Select(c => new CallPublicContribution(c.DescriptionEs, c.DescriptionEn, c.Kind, c.Currency,
            c.PrizeAmount!.Value, c.PublicIdentity ? c.DonorName : "", c.PublicIdentity ? c.ChannelUrl : "", c.Custodian, c.DeliveredBy)).ToArray();
    }

    /// <summary>Aportes de la persona con sesion, por su cuenta: no dependen del recibo guardado en una pestana.</summary>
    public async Task<CallMyContribution[]> Mine(long userId)
    {
        var ids = await applications.PersonUserIds(userId);
        var rows = await db.TournamentCallContributions.AsNoTracking().Where(c =>
            (c.PaymentId.HasValue && db.SupporterPayments.Any(p => p.Id == c.PaymentId && p.UserId.HasValue && ids.Contains(p.UserId.Value))) ||
            (c.ApplicationId.HasValue && db.TournamentCallApplications.Any(a => a.Id == c.ApplicationId && ids.Contains(a.UserId))))
            .OrderByDescending(c => c.Id).Take(100).ToArrayAsync();
        var paymentIds = rows.Where(c => c.PaymentId.HasValue).Select(c => c.PaymentId!.Value).ToArray();
        var tests = await db.SupporterPayments.AsNoTracking().Where(p => paymentIds.Contains(p.Id) && p.IsTest).Select(p => p.Id).ToArrayAsync();
        // Montos recibidos y de premios solo cuando el organizador confirmo la recepcion.
        return rows.Select(c => new CallMyContribution(c.Id, c.Reference, c.Status, c.PaymentId.HasValue && tests.Contains(c.PaymentId.Value),
            c.PublicIdentity, c.Currency, c.GrossAmount, c.Status == "confirmed" ? c.ReceivedAmount : null,
            c.Status == "confirmed" ? c.PrizeAmount : null, c.ApplicationId, c.CreatedAt)).ToArray();
    }

    public Task<TournamentCallContributionEvent[]> History(long id) => db.TournamentCallContributionEvents.AsNoTracking()
        .Where(e => e.ContributionId == id).OrderByDescending(e => e.Id).ToArrayAsync();

    private async Task EnsureOpen()
    {
        if (!await db.TournamentCallPages.AnyAsync(p => p.Id == 1 && p.Published != null && p.DonationsOpen))
            throw new CallContributionException("donations_closed");
    }

    public async Task<(TournamentCallDonationIntent Intent, string Key)> Prepare(CallDonationInput input, decimal rate, DateTimeOffset now,
        bool isTest = false, string publicKey = "", long? userId = null)
    {
        if (!TournamentCallContributionRules.Donation(input) || rate <= 0 || rate > 1000) throw new CallContributionException("invalid_amount");
        await EnsureOpen();
        // Con sesion, el canal se valida contra las cuentas de esa persona; sin sesion el aporte es anonimo y no lleva canal.
        long? channel = null;
        if (userId.HasValue)
        {
            try { channel = await applications.ResolveChannel(userId.Value, input.ChannelUserId); }
            catch (CallApplicationException ex) { throw new CallContributionException(ex.Code); }
        }
        var key = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var id = Guid.NewGuid();
        var intent = new TournamentCallDonationIntent { Id = id, ReceiptHash = TournamentCallContributionRules.Hash(key),
            Reference = "CALL-" + id.ToString("N"), AmountUsd = input.AmountUsd,
            AmountPen = decimal.Round(input.AmountUsd * rate, 2), PublicIdentity = input.PublicIdentity,
            DisplayName = input.PublicIdentity ? input.DisplayName.Trim() : "", ConsentedAt = input.PublicIdentity ? now : null,
            IsTest = isTest, PaymentKeyHash = TournamentCallContributionRules.Hash(publicKey),
            UserId = userId, ChannelUserId = channel, CreatedAt = now, UpdatedAt = now, Revision = 1 };
        // Culqi's documented charge limits are 300–999900 centavos. Enforce the actual converted amount.
        if (intent.AmountPen is < 3 or > 9999) throw new CallContributionException("provider_amount_limit");
        db.TournamentCallDonationIntents.Add(intent); await Commit(); return (intent, key);
    }

    public async Task<TournamentCallDonationIntent> FromReceipt(string key)
    {
        if (!TournamentCallContributionRules.Receipt(key)) throw new CallContributionException("not_found");
        var hash = TournamentCallContributionRules.Hash(key);
        return await db.TournamentCallDonationIntents.SingleOrDefaultAsync(i => i.ReceiptHash == hash) ?? throw new CallContributionException("not_found");
    }

    public async Task<CallDonationReceipt> Receipt(string key)
    {
        var i = await FromReceipt(key);
        var row = i.ContributionId.HasValue ? await db.TournamentCallContributions.AsNoTracking().SingleAsync(c => c.Id == i.ContributionId) : null;
        return new(i.Reference, i.State, i.IsTest, row?.Status ?? "pending", i.PublicIdentity,
            row?.Status == "confirmed" ? row.ReceivedAmount : null, row?.Status == "confirmed" ? row.PrizeAmount : null, row?.Currency ?? "PEN");
    }

    public async Task<TournamentCallDonationIntent> Claim(string key, string token, string? device, bool hasAuthentication, DateTimeOffset now)
    {
        var i = await FromReceipt(key);
        if (i.State == "charged") return i;
        await EnsureOpen();
        if (now - i.CreatedAt > TimeSpan.FromHours(1)) throw new CallContributionException("intent_expired");
        var tokenHash = TournamentCallContributionRules.Hash(token);
        var deviceHash = TournamentCallContributionRules.Hash(device ?? "");
        if (i.State == "prepared" && hasAuthentication || i.State == "authenticating" &&
            (!hasAuthentication || i.TokenHash != tokenHash || i.DeviceHash != deviceHash)) throw new CallContributionException("invalid_retry");
        if (i.State is not ("prepared" or "authenticating")) throw new CallContributionException("payment_review_required");
        i.TokenHash = tokenHash; i.DeviceHash = deviceHash; i.State = "processing"; i.UpdatedAt = now; i.Revision++;
        await Commit(); return i;
    }

    public async Task SetState(TournamentCallDonationIntent i, string state, DateTimeOffset now)
    { i.State = state; i.UpdatedAt = now; i.Revision++; await Commit(); }

    public async Task Complete(TournamentCallDonationIntent i, string chargeId, bool isTest, string email, string name,
        long? userId, DateTimeOffset now)
    {
        if (i.State == "charged") return;
        if (i.State is not ("processing" or "uncertain" or "authenticating")) throw new CallContributionException("invalid_retry");
        if (string.IsNullOrWhiteSpace(chargeId)) throw new CallContributionException("payment_review_required");
        // Single SaveChanges transaction: payment + pending contribution + audit + receipt link.
        var row = new TournamentCallContribution { Reference = i.Reference, DonorName = i.PublicIdentity ? i.DisplayName : "Anonymous",
            IsOnlineDonation = true, IsTest = isTest,
            PaymentReference = "culqi:" + chargeId,
            DescriptionEs = "Aporte monetario", DescriptionEn = "Monetary contribution", Kind = "money", Currency = "PEN",
            GrossAmount = i.AmountPen, PublicIdentity = i.PublicIdentity,
            ConsentEvidence = i.PublicIdentity ? $"checkout:{i.ConsentedAt:O};identity-and-contribution:v1" : "",
            CreatedAt = now, UpdatedAt = now, Revision = 1,
            Payment = new SupporterPayment { UserId = i.UserId ?? userId, Amount = i.AmountUsd, Currency = "USD", ChargedAmount = i.AmountPen,
                ChargedCurrency = "PEN", PaypalOrderId = chargeId, Provider = "culqi", PaymentType = "donation", BillingType = "donation",
                IsTest = isTest, CustomerEmail = email, CustomerName = name, CapturedAt = now.UtcDateTime } };
        i.ChargeId = chargeId; i.IsTest = isTest; i.Contribution = row; i.State = "charged"; i.UpdatedAt = now; i.Revision++;
        db.TournamentCallContributions.Add(row); Audit(row, null, "payment_received", now);
        await Commit();
        await TryLinkApplication(i, row, email, now);
    }

    public async Task WithdrawConsent(string key, DateTimeOffset now)
    {
        var i = await FromReceipt(key); i.PublicIdentity = false; i.Revision++; i.UpdatedAt = now;
        if (i.ContributionId.HasValue)
        {
            var row = await db.TournamentCallContributions.SingleAsync(c => c.Id == i.ContributionId);
            row.PublicIdentity = false; row.Revision++; row.UpdatedAt = now; Audit(row, null, "identity_withdrawn", now);
            // Retirar el consentimiento tambien oculta la ficha que nacio de este pago (una ficha enviada por formulario no se toca).
            var app = row.ApplicationId.HasValue ? await db.TournamentCallApplications.SingleOrDefaultAsync(a => a.Id == row.ApplicationId && a.Origin == "payment") : null;
            if (app != null && app.PublicListing) { app.PublicListing = false; app.UpdatedAt = now; app.Revision++; }
        }
        await Commit();
    }

    public async Task Cancel(string key, DateTimeOffset now)
    {
        var i = await FromReceipt(key);
        if (i.State is not ("prepared" or "authenticating")) throw new CallContributionException("payment_review_required");
        await SetState(i, "failed", now);
    }

    public async Task<object[]> Recovery() => (await db.TournamentCallDonationIntents.AsNoTracking()
        .Where(i => i.State == "processing" || i.State == "uncertain" || i.State == "authenticating")
        .OrderBy(i => i.CreatedAt).Take(100).ToArrayAsync()).Select(i => (object)new { i.Id, i.Reference, i.State, i.AmountPen, i.CreatedAt }).ToArray();

    public async Task<TournamentCallDonationIntent> RecoveryIntent(Guid id) =>
        await db.TournamentCallDonationIntents.SingleOrDefaultAsync(i => i.Id == id) ?? throw new CallContributionException("not_found");

    private async Task Commit()
    {
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { throw new CallContributionException("stale_revision"); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { throw new CallContributionException("duplicate_reference"); }
    }
}
