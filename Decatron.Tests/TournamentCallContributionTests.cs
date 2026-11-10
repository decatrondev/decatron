using System.Text.Json;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.Tournament;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

public class TournamentCallContributionRuleTests
{
    internal static CallContributionInput Input(string reference = "receipt-1") => new(reference, null, null, "Private Donor",
        "https://twitch.tv/testdonor", "Aporte de prueba", "Test contribution", "money", "USD", 12, 10,
        "Organizer", "Organizer", "verified transfer", false, "", "confirmed");

    [Fact] public void OffersAndMissingReceiptCannotBeConfirmed()
    {
        Assert.Equal("receipt_required", TournamentCallContributionRules.Validate(Input() with { Evidence = "" }));
        Assert.Equal("receipt_required", TournamentCallContributionRules.Validate(Input() with { ReceivedAmount = null, PrizeAmount = null }));
        Assert.Null(TournamentCallContributionRules.Validate(Input() with { Status = "pending", ReceivedAmount = null, PrizeAmount = null }));
    }
    [Fact] public void SeparateAmountsAndCurrenciesAndRejectUnsafeChannel()
    {
        Assert.Equal("invalid_amount", TournamentCallContributionRules.Validate(Input() with { PrizeAmount = 13 }));
        Assert.Equal("invalid_currency", TournamentCallContributionRules.Validate(Input() with { Currency = "usd" }));
        Assert.Equal("invalid_contribution", TournamentCallContributionRules.Validate(Input() with { ChannelUrl = "javascript:alert(1)" }));
        Assert.Equal("invalid_contribution", TournamentCallContributionRules.Validate(Input() with { Evidence = "x\0y" }));
    }
    [Fact] public void ItemsAreWholeUnitsAndAnonymousIsDefault()
    {
        var item = Input() with { Kind = "item", Currency = "", ReceivedAmount = 2, PrizeAmount = 1 };
        Assert.Null(TournamentCallContributionRules.Validate(item));
        Assert.Null(TournamentCallContributionRules.Validate(item with { Status = "pending", ReceivedAmount = null, PrizeAmount = null }));
        Assert.Equal("invalid_amount", TournamentCallContributionRules.Validate(item with { PrizeAmount = 1.5m }));
        Assert.False(new CallDonationInput(10).PublicIdentity);
    }
    [Fact] public void SpecificConsentAndBilingualDescriptionsAreRequired()
    {
        Assert.Equal("consent_required", TournamentCallContributionRules.Validate(Input() with { PublicIdentity = true }));
        Assert.Null(TournamentCallContributionRules.Validate(Input() with { PublicIdentity = true, ConsentEvidence = "specific approval" }));
        Assert.Equal("invalid_contribution", TournamentCallContributionRules.Validate(Input() with { DescriptionEn = "" }));
        Assert.False(TournamentCallContributionRules.Donation(new(10, true)));
    }
    [Theory]
    [InlineData(0)] [InlineData(-1)] [InlineData(10.123)] [InlineData(10001)]
    public void InvalidDonationAmount(double amount) => Assert.False(TournamentCallContributionRules.Donation(new((decimal)amount)));
}

public class TournamentCallContributionDbTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.UtcNow;
    internal static async Task WithDb(Func<DecatronDbContext, Task> test)
    {
        var connection = Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
        if (string.IsNullOrWhiteSpace(connection) || new NpgsqlConnectionStringBuilder(connection).Database != "decatron_schema")
            throw new InvalidOperationException("Tests require DECATRON_APP_CONN pointing to decatron_schema; they must not silently skip.");
        await using var sql = Decatron.Core.Interfaces.TenantNpgsql.Create(connection, 1);
        await using var db = new DecatronDbContext(new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(sql).Options);
        await using var transaction = await db.Database.BeginTransactionAsync();
        try {
            var page = await db.TournamentCallPages.SingleAsync(p => p.Id == 1); page.Published = "{}"; page.DonationsOpen = true;
            await db.SaveChangesAsync(); await test(db);
        } finally { await transaction.RollbackAsync(); }
    }
    internal static async Task<User> Person(DecatronDbContext db)
    {
        var name = "callfundqa" + Guid.NewGuid().ToString("N")[..12];
        var user = new User { Login = name, DisplayName = name, TwitchId = name, Email = "private@example.org", ProfileImageUrl = "",
            OfflineImageUrl = "", BroadcasterType = "", Description = "", AccessToken = "", RefreshToken = "", TokenExpiration = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, UniqueId = Guid.NewGuid().ToString("N") };
        db.Users.Add(user); await db.SaveChangesAsync(); return user;
    }
    private static CallContributionInput Input(string? reference = null) => TournamentCallContributionRuleTests.Input(reference ?? Guid.NewGuid().ToString("N"));
    private static CallContributionInput Edit(TournamentCallContribution c) => new(c.Reference, c.PaymentId, c.ApplicationId, c.DonorName,
        c.ChannelUrl, c.DescriptionEs, c.DescriptionEn, c.Kind, c.Currency, c.ReceivedAmount, c.PrizeAmount, c.Custodian,
        c.DeliveredBy, c.Evidence, c.PublicIdentity, c.ConsentEvidence, c.Status, c.Revision);

    [Fact] public Task PendingNeverCountsAndConfirmationIsNotAnIncrement() => WithDb(async db => {
        var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var row = await service.Save(null, actor.Id, Input() with { Status = "pending" }, Now);
        Assert.Empty(await service.Public());
        row = await service.Save(row.Id, actor.Id, Edit(row) with { Status = "confirmed" }, Now);
        Assert.Equal(10, Assert.Single(await service.Public()).Amount);
        row = await service.Save(row.Id, actor.Id, Edit(row), Now);
        Assert.Equal(10, Assert.Single(await service.Public()).Amount);
        Assert.Equal(3, (await service.History(row.Id)).Length);
    });

    [Fact] public Task PublicResponseRedactsIdentityReferencesEvidenceAndPayment() => WithDb(async db => {
        var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var row = await service.Save(null, actor.Id, Input(), Now);
        var item = Assert.Single(await service.Public()); Assert.Equal("", item.DisplayName); Assert.Equal("", item.ChannelUrl);
        var json = JsonSerializer.Serialize(item);
        foreach (var secret in new[] { row.Reference, row.DonorName, row.ChannelUrl, row.Evidence, "PaymentId", "ApplicationId", "ConsentEvidence", "ActorId" })
            Assert.DoesNotContain(secret, json);
        row = await service.Save(row.Id, actor.Id, Edit(row) with { PublicIdentity = true, ConsentEvidence = "explicit specific consent" }, Now);
        Assert.Equal(row.DonorName, Assert.Single(await service.Public()).DisplayName);
    });

    [Fact] public Task UniqueReferenceAndStaleRevisionPreventDuplicateConfirmation() => WithDb(async db => {
        var actor = await Person(db); var service = new TournamentCallContributionService(db); var input = Input();
        var row = await service.Save(null, actor.Id, input, Now);
        Assert.Equal("stale_revision", (await Assert.ThrowsAsync<CallContributionException>(() => service.Save(row.Id, actor.Id, input, Now))).Code);
        Assert.Equal("duplicate_reference", (await Assert.ThrowsAsync<CallContributionException>(() => service.Save(null, actor.Id, input, Now))).Code);
    });

    [Fact] public Task EfConcurrencyRollsBackAuditAndState() => WithDb(async db => {
        var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var row = await service.Save(null, actor.Id, Input() with { Status = "pending" }, Now);
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE tournament_call_contributions SET revision=revision+1 WHERE id={row.Id}");
        Assert.Equal("stale_revision", (await Assert.ThrowsAsync<CallContributionException>(() => service.Save(row.Id, actor.Id, Edit(row) with { Status = "confirmed" }, Now))).Code);
        db.ChangeTracker.Clear();
        Assert.Equal("pending", (await db.TournamentCallContributions.SingleAsync(c => c.Id == row.Id)).Status);
        Assert.Single(await service.History(row.Id));
    });

    [Fact] public Task ReversalRemovesPrizeAndCannotBeReactivated() => WithDb(async db => {
        var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var row = await service.Save(null, actor.Id, Input(), Now);
        row = await service.Save(row.Id, actor.Id, Edit(row) with { Status = "reversed" }, Now);
        Assert.Empty(await service.Public()); Assert.Equal(2, (await service.History(row.Id)).Length);
        Assert.Equal("already_reversed", (await Assert.ThrowsAsync<CallContributionException>(() => service.Save(row.Id, actor.Id, Edit(row) with { Status = "confirmed" }, Now))).Code);
    });

    [Fact] public Task DonationIsPersistentlyAttributedBeforeChargeAndReplaysDoNotRecharge() => WithDb(async db => {
        var service = new TournamentCallContributionService(db); var (intent, key) = await service.Prepare(new(12), 3.8m, Now);
        Assert.Equal(45.60m, intent.AmountPen); Assert.Equal("", intent.DisplayName);
        Assert.NotEqual(key, intent.ReceiptHash); Assert.False((await service.Receipt(key)).PublicIdentity);
        await service.Claim(key, "token", "device", false, Now);
        Assert.Equal("payment_review_required", (await Assert.ThrowsAsync<CallContributionException>(() => service.Claim(key, "token", "device", false, Now))).Code);
        await service.Complete(intent, "chr_live_qa" + Guid.NewGuid().ToString("N"), false, "private@example.org", "private payer", null, Now);
        Assert.Empty(await service.Public());
        Assert.Equal("charged", (await service.Claim(key, "token", "device", false, Now)).State);
        await service.Complete(intent, intent.ChargeId, false, "", "", null, Now);
        Assert.Single(await db.SupporterPayments.Where(p => p.PaypalOrderId == intent.ChargeId).ToArrayAsync());
        Assert.Single(await db.TournamentCallContributions.Where(c => c.Reference == intent.Reference).ToArrayAsync());
    });

    [Fact] public Task ThreeDsRequiresSameTokenAndDeviceAndClaimsOnce() => WithDb(async db => {
        var service = new TournamentCallContributionService(db); var (intent, key) = await service.Prepare(new(10), 3.8m, Now);
        await service.Claim(key, "token", "device", false, Now); await service.SetState(intent, "authenticating", Now);
        foreach (var pair in new[] { ("other", "device"), ("token", "other") })
            Assert.Equal("invalid_retry", (await Assert.ThrowsAsync<CallContributionException>(() => service.Claim(key, pair.Item1, pair.Item2, true, Now))).Code);
        Assert.Equal("processing", (await service.Claim(key, "token", "device", true, Now)).State);
        Assert.Equal("payment_review_required", (await Assert.ThrowsAsync<CallContributionException>(() => service.Claim(key, "token", "device", true, Now))).Code);
    });

    [Fact] public Task UnknownChargeAndClosedDestinationCannotBeRetriedOrReattributed() => WithDb(async db => {
        var service = new TournamentCallContributionService(db); var (intent, key) = await service.Prepare(new(10), 3.8m, Now);
        var page = await db.TournamentCallPages.SingleAsync(p => p.Id == 1); page.DonationsOpen = false; await db.SaveChangesAsync();
        Assert.Equal("donations_closed", (await Assert.ThrowsAsync<CallContributionException>(() => service.Claim(key, "token", null, false, Now))).Code);
        Assert.Equal("donations_closed", (await Assert.ThrowsAsync<CallContributionException>(() => service.Prepare(new(10), 3.8m, Now))).Code);
        page.DonationsOpen = true; await db.SaveChangesAsync();
        await service.Claim(key, "token", null, false, Now); await service.SetState(intent, "uncertain", Now);
        Assert.Equal("payment_review_required", (await Assert.ThrowsAsync<CallContributionException>(() => service.Claim(key, "token", null, false, Now))).Code);
        Assert.Equal("payment_review_required", (await Assert.ThrowsAsync<CallContributionException>(() => service.Cancel(key, Now))).Code);
    });

    [Fact] public Task OnlineIdentityCannotBeOverriddenAndWithdrawalKeepsAvailablePrize() => WithDb(async db => {
        var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var (intent, key) = await service.Prepare(new(12, true, "Consenting Donor"), 3.8m, Now);
        await service.Claim(key, "token", null, false, Now);
        await service.Complete(intent, "chr_live_qa" + Guid.NewGuid().ToString("N"), false, "", "", null, Now);
        var row = await db.TournamentCallContributions.SingleAsync(c => c.Id == intent.ContributionId);
        var input = Edit(row) with { Status = "confirmed", ReceivedAmount = 40, PrizeAmount = 38, Custodian = "Organizer", DeliveredBy = "Organizer", Evidence = "net checked" };
        Assert.Equal("payment_identity_locked", (await Assert.ThrowsAsync<CallContributionException>(() => service.Save(row.Id, actor.Id, input with { DonorName = "Other" }, Now))).Code);
        row = await service.Save(row.Id, actor.Id, input, Now); Assert.Equal("Consenting Donor", Assert.Single(await service.Public()).DisplayName);
        await service.WithdrawConsent(key, Now);
        var item = Assert.Single(await service.Public()); Assert.Equal(38, item.Amount); Assert.Equal("", item.DisplayName);
        Assert.False((await service.Receipt(key)).PublicIdentity);
        Assert.Equal(40, (await service.Receipt(key)).ReceivedAmount);
        Assert.Equal(38, (await service.Receipt(key)).PrizeAmount);
        Assert.Equal("not_found", (await Assert.ThrowsAsync<CallContributionException>(() => service.Receipt(new string('A', 64)))).Code);
    });

    [Fact] public Task TestAndTierPaymentsNeverBecomeAvailablePrizes() => WithDb(async db => {
        var actor = await Person(db); var service = new TournamentCallContributionService(db);
        foreach (var type in new[] { "donation", "tier" }) {
            var payment = new SupporterPayment { PaymentType = type, Provider = "culqi", PaypalOrderId = "chr_test_qa" + Guid.NewGuid().ToString("N"), Amount = 10, ChargedAmount = 38, ChargedCurrency = "PEN", IsTest = type == "donation" };
            db.SupporterPayments.Add(payment); await db.SaveChangesAsync();
            Assert.Equal("invalid_payment", (await Assert.ThrowsAsync<CallContributionException>(() => service.Save(null, actor.Id,
                Input() with { PaymentId = payment.Id, Currency = "PEN" }, Now))).Code);
        }
        var (intent, key) = await service.Prepare(new(10), 3.8m, Now); await service.Claim(key, "token", null, false, Now);
        await service.Complete(intent, "chr_test_qa" + Guid.NewGuid().ToString("N"), true, "", "", null, Now);
        Assert.True((await service.Receipt(key)).IsTest); Assert.Empty(await service.Public());
        var listed = JsonSerializer.SerializeToElement(await service.List(1), new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.True(listed.GetProperty("items")[0].GetProperty("isTest").GetBoolean());
        using var history = JsonDocument.Parse(Assert.Single(await service.History(intent.ContributionId!.Value)).Snapshot);
        Assert.True(history.RootElement.GetProperty("IsTest").GetBoolean());
    });

    [Fact] public Task ExistingDonationCannotBeCountedTwiceAndGrossIsNotNet() => WithDb(async db => {
        var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var payment = new SupporterPayment { PaymentType = "donation", Provider = "culqi", PaypalOrderId = "chr_live_qa" + Guid.NewGuid().ToString("N"), Amount = 12, ChargedAmount = 45.6m, ChargedCurrency = "PEN" };
        db.SupporterPayments.Add(payment); await db.SaveChangesAsync();
        var input = Input() with { PaymentId = payment.Id, Currency = "PEN", ReceivedAmount = 40, PrizeAmount = 38 };
        var row = await service.Save(null, actor.Id, input, Now); Assert.Equal(45.6m, row.GrossAmount);
        Assert.Equal("invalid_payment", (await Assert.ThrowsAsync<CallContributionException>(() => service.Save(row.Id, actor.Id, Edit(row) with { ReceivedAmount = 46 }, Now))).Code);
        Assert.Equal("duplicate_reference", (await Assert.ThrowsAsync<CallContributionException>(() => service.Save(null, actor.Id, input with { Reference = Guid.NewGuid().ToString("N") }, Now))).Code);
    });

    [Fact] public Task ExistingPaymentReferenceIsUniqueInDatabase() => WithDb(async db => {
        var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var charge = "chr_live_qa" + Guid.NewGuid().ToString("N");
        var payments = Enumerable.Range(0, 2).Select(_ => new SupporterPayment { PaymentType = "donation", Provider = "culqi", PaypalOrderId = charge,
            Amount = 12, ChargedAmount = 45.6m, ChargedCurrency = "PEN" }).ToArray();
        db.SupporterPayments.Add(payments[0]); await db.SaveChangesAsync();
        await service.Save(null, actor.Id, Input() with { PaymentId = payments[0].Id, Currency = "PEN" }, Now);
        db.SupporterPayments.Add(payments[1]);
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.UniqueViolation, Assert.IsType<PostgresException>(error.InnerException).SqlState);
        Assert.Equal(10, Assert.Single(await service.Public()).Amount);
    });

    [Fact] public Task ManualEntryCannotOccupyReservedOnlinePaymentReference() => WithDb(async db => {
        var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var (intent, _) = await service.Prepare(new(12), 3.8m, Now);
        Assert.Equal("duplicate_reference", (await Assert.ThrowsAsync<CallContributionException>(() => service.Save(null, actor.Id, Input(intent.Reference), Now))).Code);
        Assert.Empty(await service.Public());
    });

    [Fact] public Task CancelOnlyBeforeChargeAndAmountsAreBoundToIntent() => WithDb(async db => {
        var service = new TournamentCallContributionService(db); var (intent, key) = await service.Prepare(new(12), 3.8m, Now);
        await service.Cancel(key, Now); Assert.Equal("failed", (await service.Receipt(key)).State);
        Assert.Equal("payment_review_required", (await Assert.ThrowsAsync<CallContributionException>(() => service.Claim(key, "token", null, false, Now))).Code);
        Assert.Equal("provider_amount_limit", (await Assert.ThrowsAsync<CallContributionException>(() => service.Prepare(new(10000), 3.8m, Now))).Code);
        var (_, expiredKey) = await service.Prepare(new(10), 3.8m, Now);
        Assert.Equal("intent_expired", (await Assert.ThrowsAsync<CallContributionException>(() => service.Claim(expiredKey, "token", null, false, Now.AddHours(2)))).Code);
    });

    [Fact] public Task PrizeDonationsAndTestPaymentsDoNotIncreaseGeneralSupportersProgress() => WithDb(async db => {
        async Task<decimal> Total() {
            await using var command = new NpgsqlCommand(Decatron.Services.SupportersService.MonthlyRaisedQuery,
                (NpgsqlConnection)db.Database.GetDbConnection(), (NpgsqlTransaction)db.Database.CurrentTransaction!.GetDbTransaction());
            return Convert.ToDecimal(await command.ExecuteScalarAsync());
        }
        var before = await Total();
        db.SupporterPayments.AddRange(new SupporterPayment { Amount = 10, PaymentType = "donation" },
            new SupporterPayment { Amount = 20, PaymentType = "tier" }, new SupporterPayment { Amount = 100, PaymentType = "donation", IsTest = true });
        await db.SaveChangesAsync(); Assert.Equal(before + 30, await Total());
        var service = new TournamentCallContributionService(db); var (intent, key) = await service.Prepare(new(12), 3.8m, Now);
        await service.Claim(key, "token", null, false, Now);
        await service.Complete(intent, "chr_live_qa" + Guid.NewGuid().ToString("N"), false, "", "", null, Now);
        Assert.Equal(before + 30, await Total());
    });

    [Fact] public Task ApplicationRoleCanWriteLedgerButCannotRewriteAudit() => WithDb(async db => {
        var actor = await Person(db); var service = new TournamentCallContributionService(db);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL ROLE decatron_app");
        var row = await service.Save(null, actor.Id, Input(), Now);
        Assert.Single(await service.History(row.Id));
        Assert.Equal(10, Assert.Single(await service.Public()).Amount);
        var (intent, key) = await service.Prepare(new(12), 3.8m, Now);
        await service.Claim(key, "token", null, false, Now);
        await service.Complete(intent, "chr_live_qa" + Guid.NewGuid().ToString("N"), false, "qa@example.org", "QA", actor.Id, Now);
        Assert.Equal("charged", (await service.Receipt(key)).State);
        await using var cmd = new NpgsqlCommand("SELECT has_table_privilege(current_user,'tournament_call_contribution_events','UPDATE'), has_table_privilege(current_user,'tournament_call_contribution_events','DELETE'), has_table_privilege(current_user,'tournament_call_contributions','DELETE')",
            (NpgsqlConnection)db.Database.GetDbConnection(), (NpgsqlTransaction)db.Database.CurrentTransaction!.GetDbTransaction());
        await using var reader = await cmd.ExecuteReaderAsync(); Assert.True(await reader.ReadAsync());
        Assert.False(reader.GetBoolean(0)); Assert.False(reader.GetBoolean(1)); Assert.False(reader.GetBoolean(2));
    });
}

public class TournamentCallDirectContributionDbTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.UtcNow;
    private static Task WithDb(Func<DecatronDbContext, Task> test) => TournamentCallContributionDbTests.WithDb(test);
    private static Task<User> Person(DecatronDbContext db) => TournamentCallContributionDbTests.Person(db);
    private static CallContributionInput Confirm(TournamentCallContribution c) => new(c.Reference, c.PaymentId, c.ApplicationId, c.DonorName,
        c.ChannelUrl, c.DescriptionEs, c.DescriptionEn, c.Kind, c.Currency, 10, 10, "Organizer", "Organizer", "verified in Culqi",
        c.PublicIdentity, c.ConsentEvidence, "confirmed", c.Revision);
    private static CallContributionInput Status(TournamentCallContribution c, string status) => Confirm(c) with { Status = status,
        ReceivedAmount = c.ReceivedAmount ?? 10, PrizeAmount = c.PrizeAmount ?? 10 };

    /// <summary>Paga como lo hace el controlador: prepara con la sesion, reclama y completa.</summary>
    private static async Task<(TournamentCallContribution Row, string Key)> Pay(DecatronDbContext db, TournamentCallContributionService service,
        long? userId, bool publicIdentity = false, long? channel = null, bool test = false)
    {
        var (intent, key) = await service.Prepare(new(12, publicIdentity, publicIdentity ? "Public Name" : "", channel), 3.8m, Now, test, "pk_test", userId);
        await service.Claim(key, "token", null, false, Now);
        await service.Complete(intent, "chr_" + (test ? "test" : "live") + "_qa" + Guid.NewGuid().ToString("N"), test, "payer@example.org", "Payer", null, Now);
        db.ChangeTracker.Clear();
        return (await db.TournamentCallContributions.SingleAsync(c => c.Reference == intent.Reference), key);
    }

    [Fact] public Task PaymentWithSessionLinksOnePendingCollaboratorAndTheOrganizerSeesWhoPaid() => WithDb(async db => {
        var user = await Person(db); var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var (row, _) = await Pay(db, service, user.Id, publicIdentity: true);
        var app = await db.TournamentCallApplications.SingleAsync(a => a.Id == row.ApplicationId);
        Assert.Equal("payment", app.Origin); Assert.Equal("pending", app.Status); Assert.True(app.PublicListing); Assert.Equal(user.Id, app.UserId);
        Assert.Equal(user.Id, (await db.SupporterPayments.SingleAsync(p => p.Id == row.PaymentId)).UserId);
        var listed = (await ListItems(service)).Single(c => c.Id == row.Id);
        Assert.Equal(user.DisplayName, listed.PayerName); Assert.Equal(app.ChannelUrl, listed.PayerChannelUrl);
        Assert.Equal("Public Name", row.DonorName);
        // Mientras no se confirma, no es publico ni suma.
        Assert.Empty(await service.Public()); Assert.Empty(await new TournamentCallApplicationService(db).PublicProfiles());
    });

    private static async Task<TournamentCallContribution[]> ListItems(TournamentCallContributionService service)
    {
        var json = JsonSerializer.Serialize(await service.List(1));
        return JsonSerializer.Deserialize<ListShape>(json)!.items;
    }
    private sealed record ListShape(TournamentCallContribution[] items);

    [Fact] public Task ConfirmingReceiptApprovesAndPublishesOnlyWithConsentAndReversalHidesIt() => WithDb(async db => {
        var user = await Person(db); var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var applications = new TournamentCallApplicationService(db);
        var (row, _) = await Pay(db, service, user.Id, publicIdentity: true);
        row = await service.Save(row.Id, actor.Id, Confirm(row) with { ConsentEvidence = row.ConsentEvidence }, Now);
        var app = await db.TournamentCallApplications.AsNoTracking().SingleAsync(a => a.Id == row.ApplicationId);
        Assert.Equal("approved", app.Status); Assert.Equal(actor.Id, app.ReviewedBy);
        Assert.Single(await applications.PublicProfiles(), p => p.ChannelUrl == app.ChannelUrl);
        row = await service.Save(row.Id, actor.Id, Status(row, "reversed"), Now);
        Assert.Equal("pending", (await db.TournamentCallApplications.AsNoTracking().SingleAsync(a => a.Id == app.Id)).Status);
        Assert.DoesNotContain(await applications.PublicProfiles(), p => p.ChannelUrl == app.ChannelUrl);
    });

    [Fact] public Task SessionWithoutPublicConsentIsPrivateEvenAfterConfirmation() => WithDb(async db => {
        var user = await Person(db); var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var (row, _) = await Pay(db, service, user.Id, publicIdentity: false);
        row = await service.Save(row.Id, actor.Id, Confirm(row), Now);
        var app = await db.TournamentCallApplications.AsNoTracking().SingleAsync(a => a.Id == row.ApplicationId);
        Assert.Equal("approved", app.Status); Assert.False(app.PublicListing);
        Assert.DoesNotContain(await new TournamentCallApplicationService(db).PublicProfiles(), p => p.ChannelUrl == app.ChannelUrl);
        var item = Assert.Single(await service.Public()); Assert.Equal("", item.DisplayName); // el aporte suma como anonimo
    });

    [Fact] public Task AnonymousPaymentCreatesNoCollaboratorAndStaysAnonymousForTheOrganizer() => WithDb(async db => {
        var service = new TournamentCallContributionService(db);
        var (row, _) = await Pay(db, service, null);
        Assert.Null(row.ApplicationId);
        Assert.Equal("", (await ListItems(service)).Single(c => c.Id == row.Id).PayerName);
        Assert.Equal("", (await ListItems(service)).Single(c => c.Id == row.Id).PayerChannelUrl);
    });

    [Fact] public Task PaymentNeverRewritesOrAutoApprovesAnApplicationSentThroughTheForm() => WithDb(async db => {
        var user = await Person(db); var actor = await Person(db); var service = new TournamentCallContributionService(db);
        db.TournamentCallApplications.Add(new TournamentCallApplication { IdentityKey = "user:" + user.Id, UserId = user.Id, ChannelUserId = user.Id,
            Kind = "collaborator", DisplayName = "x", ChannelUrl = "https://www.twitch.tv/x", Contact = "c", ContributionType = "giftcard", Amount = 25,
            Currency = "USD", AcceptedAt = Now, RulesSnapshot = "{}", CreatedAt = Now, UpdatedAt = Now, Revision = 1 });
        await db.SaveChangesAsync();
        var existing = await db.TournamentCallApplications.AsNoTracking().SingleAsync(a => a.UserId == user.Id);
        var (row, _) = await Pay(db, service, user.Id, publicIdentity: true);
        Assert.Equal(existing.Id, row.ApplicationId);
        row = await service.Save(row.Id, actor.Id, Confirm(row), Now);
        var after = await db.TournamentCallApplications.AsNoTracking().SingleAsync(a => a.Id == existing.Id);
        Assert.Equal("pending", after.Status); Assert.Equal("giftcard", after.ContributionType); Assert.Equal(25, after.Amount);
        Assert.Equal(existing.Revision, after.Revision); Assert.Equal("form", after.Origin);
    });

    [Fact] public Task TestPaymentsLinkButCanNeverBeConfirmedOrApproveAnyone() => WithDb(async db => {
        var user = await Person(db); var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var (row, _) = await Pay(db, service, user.Id, publicIdentity: true, test: true);
        Assert.NotNull(row.ApplicationId);
        Assert.Equal("invalid_payment", (await Assert.ThrowsAsync<CallContributionException>(() => service.Save(row.Id, actor.Id, Confirm(row), Now))).Code);
        Assert.Equal("pending", (await db.TournamentCallApplications.AsNoTracking().SingleAsync(a => a.Id == row.ApplicationId)).Status);
        Assert.True((await ListItems(service)).Single(c => c.Id == row.Id).IsTest);
    });

    [Fact] public Task ChannelMustBelongToThePayerAndDefaultsToTheOwnOne() => WithDb(async db => {
        var user = await Person(db); var stranger = await Person(db); var service = new TournamentCallContributionService(db);
        Assert.Equal("channel_not_owned", (await Assert.ThrowsAsync<CallContributionException>(() =>
            service.Prepare(new(12, false, "", stranger.Id), 3.8m, Now, false, "pk", user.Id))).Code);
        var (intent, _) = await service.Prepare(new(12), 3.8m, Now, false, "pk", user.Id);
        Assert.Equal(user.Id, intent.UserId); Assert.Equal(user.Id, intent.ChannelUserId);
        var (anonymous, _) = await service.Prepare(new(12, false, "", stranger.Id), 3.8m, Now);
        Assert.Null(anonymous.UserId); Assert.Null(anonymous.ChannelUserId); // sin sesion no se guarda canal ajeno
    });

    [Fact] public Task LinkingFailureNeverBreaksThePaymentAndConfirmingRepairsTheLink() => WithDb(async db => {
        var user = await Person(db); var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var account = new Account { CreatedAt = DateTime.UtcNow }; db.Accounts.Add(account); await db.SaveChangesAsync();
        var second = await Person(db); user.AccountId = account.Id; second.AccountId = account.Id; await db.SaveChangesAsync();
        // Identidad ambigua (dos fichas para la misma persona): el pago se registra igual y no se adivina a quien ligar.
        db.TournamentCallApplications.AddRange(
            new TournamentCallApplication { IdentityKey = "account:" + account.Id, UserId = user.Id, ChannelUserId = user.Id, Kind = "collaborator", DisplayName = "a",
                ChannelUrl = "https://www.twitch.tv/a", Contact = "c", ContributionType = "giftcard", Amount = 1, Currency = "USD", AcceptedAt = Now, RulesSnapshot = "{}", CreatedAt = Now, UpdatedAt = Now, Revision = 1 },
            new TournamentCallApplication { IdentityKey = "user:" + second.Id, UserId = second.Id, ChannelUserId = second.Id, Kind = "collaborator", DisplayName = "b",
                ChannelUrl = "https://www.twitch.tv/b", Contact = "c", ContributionType = "giftcard", Amount = 1, Currency = "USD", AcceptedAt = Now, RulesSnapshot = "{}", CreatedAt = Now, UpdatedAt = Now, Revision = 1 });
        await db.SaveChangesAsync();
        var (row, key) = await Pay(db, service, user.Id);
        Assert.Null(row.ApplicationId); Assert.Equal("charged", (await service.Receipt(key)).State);
        Assert.Equal(user.DisplayName, (await ListItems(service)).Single(c => c.Id == row.Id).PayerName); // el organizador igual ve quien pago
    });

    [Fact] public Task ConfirmingRepairsAMissingLinkFromTheIntent() => WithDb(async db => {
        var user = await Person(db); var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var (row, _) = await Pay(db, service, user.Id, publicIdentity: true);
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE tournament_call_contributions SET application_id = NULL WHERE id = {row.Id}");
        db.ChangeTracker.Clear();
        row = await db.TournamentCallContributions.SingleAsync(c => c.Id == row.Id); Assert.Null(row.ApplicationId);
        row = await service.Save(row.Id, actor.Id, Confirm(row), Now);
        Assert.NotNull(row.ApplicationId);
        Assert.Equal("approved", (await db.TournamentCallApplications.AsNoTracking().SingleAsync(a => a.Id == row.ApplicationId)).Status);
    });

    [Fact] public Task WithdrawingConsentHidesOnlyTheProfileBornFromThePayment() => WithDb(async db => {
        var user = await Person(db); var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var applications = new TournamentCallApplicationService(db);
        var (row, key) = await Pay(db, service, user.Id, publicIdentity: true);
        row = await service.Save(row.Id, actor.Id, Confirm(row), Now);
        var app = await db.TournamentCallApplications.AsNoTracking().SingleAsync(a => a.Id == row.ApplicationId);
        Assert.Single(await applications.PublicProfiles(), p => p.ChannelUrl == app.ChannelUrl);
        await service.WithdrawConsent(key, Now);
        Assert.DoesNotContain(await applications.PublicProfiles(), p => p.ChannelUrl == app.ChannelUrl);
        Assert.Equal("", Assert.Single(await service.Public()).DisplayName); // el aporte sigue sumando, sin identidad
    });

    [Fact] public Task MineListsOnlyMyContributionsAndAmountsOnlyAfterConfirmation() => WithDb(async db => {
        var me = await Person(db); var other = await Person(db); var actor = await Person(db); var service = new TournamentCallContributionService(db);
        var (mine, _) = await Pay(db, service, me.Id); var (theirs, _) = await Pay(db, service, other.Id); await Pay(db, service, null);
        var list = await service.Mine(me.Id);
        var item = Assert.Single(list); Assert.Equal(mine.Id, item.Id); Assert.Null(item.ReceivedAmount); Assert.Null(item.PrizeAmount);
        Assert.DoesNotContain(list, c => c.Id == theirs.Id);
        await service.Save(mine.Id, actor.Id, Confirm(mine), Now);
        item = Assert.Single(await service.Mine(me.Id)); Assert.Equal(10, item.ReceivedAmount); Assert.Equal("confirmed", item.Status);
        var json = JsonSerializer.Serialize(item);
        foreach (var secret in new[] { "Evidence", "ConsentEvidence", "PaymentReference", "Custodian", "token" }) Assert.DoesNotContain(secret, json);
    });
}

