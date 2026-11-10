using System.Text.Json;
using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.Tournament;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

public class TournamentCallApplicationRuleTests
{
    private static CallApplicationInput Offer(string type, decimal amount, string currency = "USD") =>
        new("collaborator", 1, "contact", "", type, amount, currency, false, true, false, false, "version", 0,
            true, false, TournamentCallApplicationRules.CustodyNoticeVersion);

    [Theory]
    [InlineData("money", 0, "USD", "invalid_contribution")]
    [InlineData("money", 10.123, "USD", "invalid_contribution")]
    [InlineData("vbucks", 10.5, "", "invalid_contribution")]
    [InlineData("money", 10, "usd", "invalid_currency")]
    [InlineData("giftcard", 10, "PEN", null)]
    [InlineData("vbucks", 800, "", null)]
    public void ContributionValidation(string type, double amount, string currency, string? error)
        => Assert.Equal(error, TournamentCallApplicationRules.Validate(Offer(type, (decimal)amount, currency)));

    [Fact]
    public void CustodyNeedsTheExactNoticeAndItsOwnConsent()
    {
        var gift = Offer("giftcard", 10);
        Assert.Null(TournamentCallApplicationRules.Validate(gift));
        Assert.Equal("custody_required", TournamentCallApplicationRules.Validate(gift with { AcceptedCustody = false }));
        Assert.Equal("notice_changed", TournamentCallApplicationRules.Validate(gift with { CustodyNoticeVersion = "old" }));
        Assert.Equal("public_offer_requires_listing", TournamentCallApplicationRules.Validate(gift with { PublicOffer = true }));
        Assert.Null(TournamentCallApplicationRules.Validate(gift with { PublicOffer = true, PublicListing = true }));
        // El dinero lo recibe el organizador: no pide aviso de custodia.
        Assert.Null(TournamentCallApplicationRules.Validate(Offer("money", 10) with { AcceptedCustody = false, CustodyNoticeVersion = "" }));
        Assert.True(TournamentCallApplicationRules.UnderCustody("vbucks")); Assert.False(TournamentCallApplicationRules.UnderCustody("money"));
    }

    [Fact]
    public void ParticipantMustAcceptRulesAndDeclareUsageAndStreaming()
    {
        var input = Offer("money", 10) with { Kind = "participant" };
        Assert.Equal("participant_requirements", TournamentCallApplicationRules.Validate(input));
        Assert.Null(TournamentCallApplicationRules.Validate(input with { UsesBot = true, WillStream = true }));
        Assert.Equal("accept_rules", TournamentCallApplicationRules.Validate(input with { AcceptedRules = false }));
    }

    [Fact]
    public void RejectsControlCharactersAndTracksPublishedVersion()
    {
        Assert.Equal("invalid_application", TournamentCallApplicationRules.Validate(Offer("money", 10) with { Contact = "a\0b" }));
        Assert.NotEqual(TournamentCallApplicationRules.Version("{\"rules\":\"old\"}"), TournamentCallApplicationRules.Version("{\"rules\":\"new\"}"));
        Assert.Equal(TournamentCallApplicationRules.Version("{\"a\":1,\"b\":2}"), TournamentCallApplicationRules.Version("{ \"b\":2, \"a\":1 }"));
    }
}

internal sealed class CallApplicationDbFactAttribute : FactAttribute
{
    public CallApplicationDbFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("DECATRON_APP_CONN")))
            Skip = "Requires DECATRON_APP_CONN pointing to decatron_schema; no production database is allowed.";
    }
}

public class TournamentCallApplicationDbTests
{
    private const string Published = "{\"es\":{\"rules\":\"Reglas publicadas\"},\"en\":{\"rules\":\"Published rules\"}}";
    private static readonly DateTimeOffset Now = DateTimeOffset.UtcNow;
    private static async Task WithDb(Func<DecatronDbContext, Task> test)
    {
        var connection = Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
        if (new NpgsqlConnectionStringBuilder(connection).Database != "decatron_schema")
            throw new InvalidOperationException("These tests only allow decatron_schema.");
        await using var sql = Decatron.Core.Interfaces.TenantNpgsql.Create(connection, 1);
        await using var db = new DecatronDbContext(new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(sql).Options);
        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            var page = await db.TournamentCallPages.SingleAsync(p => p.Id == 1);
            page.Published = Published; page.ApplicationsOpen = true;
            await db.SaveChangesAsync();
            await test(db);
        }
        finally { await transaction.RollbackAsync(); }
    }

    private static async Task<User> Person(DecatronDbContext db, long? accountId = null)
    {
        var name = "callqa" + Guid.NewGuid().ToString("N")[..12];
        var user = new User { Login = name, DisplayName = name, TwitchId = name, Email = "private@example.org", ProfileImageUrl = "https://example.org/avatar.png",
            OfflineImageUrl = "", BroadcasterType = "", ViewCount = 0, Description = "", AccessToken = "", RefreshToken = "", TokenExpiration = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, UniqueId = Guid.NewGuid().ToString("N"), AccountId = accountId };
        db.Users.Add(user); await db.SaveChangesAsync(); return user;
    }
    private static CallApplicationInput Request(User user, string kind = "participant") =>
        new(kind, user.Id, "private-contact", "private-notes", kind == "collaborator" ? "giftcard" : "money", 10, "USD", true, true, true, true,
            TournamentCallApplicationRules.Version(Published), 0, true, false, TournamentCallApplicationRules.CustodyNoticeVersion);

    [CallApplicationDbFact]
    public Task OwnIdentityRejectsAnotherPersonsChannel() => WithDb(async db => {
        var own = await Person(db); var other = await Person(db);
        var service = new TournamentCallApplicationService(db);
        var me = await service.Me(own.Id);
        Assert.Single(me.Channels); Assert.Equal(own.Id, me.Channels[0].Id);
        var error = await Assert.ThrowsAsync<CallApplicationException>(() => service.Submit(own.Id, Request(other), Now));
        Assert.Equal("channel_not_owned", error.Code);
        Assert.Empty((await service.Me(own.Id)).Applications);
    });

    [CallApplicationDbFact]
    public Task LinkedChannelsCannotCreateDuplicateApplications() => WithDb(async db => {
        var account = new Account { CreatedAt = DateTime.UtcNow }; db.Accounts.Add(account); await db.SaveChangesAsync();
        var first = await Person(db, account.Id); var second = await Person(db, account.Id);
        var service = new TournamentCallApplicationService(db);
        var saved = await service.Submit(first.Id, Request(first), Now);
        var error = await Assert.ThrowsAsync<CallApplicationException>(() => service.Submit(second.Id, Request(second), Now));
        Assert.Equal("stale_revision", error.Code);
        Assert.Equal(saved.Id, Assert.Single((await service.Me(second.Id)).Applications).Id);
    });

    [CallApplicationDbFact]
    public Task ApprovalPublishesOnlyConsentedProfileAndEditRequiresNewReview() => WithDb(async db => {
        var own = await Person(db); var service = new TournamentCallApplicationService(db);
        var request = Request(own, "collaborator");
        var saved = await service.Submit(own.Id, request, Now);
        Assert.DoesNotContain(await service.PublicProfiles(), p => p.ChannelUrl == saved.ChannelUrl);
        var approved = await service.Review(saved.Id, own.Id, new("approved", "Review complete", saved.Revision), Now);
        var visible = Assert.Single((await service.PublicProfiles()).Where(p => p.ChannelUrl == saved.ChannelUrl));
        var json = JsonSerializer.Serialize(visible);
        Assert.DoesNotContain("private-contact", json); Assert.DoesNotContain("private-notes", json); Assert.DoesNotContain("Amount", json);
        var edited = await service.Submit(own.Id, request with { Revision = approved.Revision }, Now);
        Assert.Equal("pending", edited.Status);
        Assert.DoesNotContain(await service.PublicProfiles(), p => p.ChannelUrl == saved.ChannelUrl);
    });

    [CallApplicationDbFact]
    public Task NoPublicListingWithoutConsentAndWithdrawalSurvivesClosedApplications() => WithDb(async db => {
        var own = await Person(db); var service = new TournamentCallApplicationService(db);
        var saved = await service.Submit(own.Id, Request(own) with { PublicListing = false }, Now);
        var reviewed = await service.Review(saved.Id, own.Id, new("approved", "", saved.Revision), Now);
        Assert.DoesNotContain(await service.PublicProfiles(), p => p.ChannelUrl == saved.ChannelUrl);
        (await db.TournamentCallPages.SingleAsync()).ApplicationsOpen = false; await db.SaveChangesAsync();
        var withdrawn = await service.Withdraw(own.Id, "participant", reviewed.Revision, Now);
        Assert.Equal("withdrawn", withdrawn.Status);
        var error = await Assert.ThrowsAsync<CallApplicationException>(() => service.Review(saved.Id, own.Id, new("approved", "", withdrawn.Revision), Now));
        Assert.Equal("application_withdrawn", error.Code);
    });

    [CallApplicationDbFact]
    public Task ClosedOrChangedRulesPreventSubmission() => WithDb(async db => {
        var own = await Person(db); var service = new TournamentCallApplicationService(db);
        var changed = await Assert.ThrowsAsync<CallApplicationException>(() => service.Submit(own.Id, Request(own) with { PageVersion = "old" }, Now));
        Assert.Equal("rules_changed", changed.Code);
        (await db.TournamentCallPages.SingleAsync()).ApplicationsOpen = false; await db.SaveChangesAsync();
        var closed = await Assert.ThrowsAsync<CallApplicationException>(() => service.Submit(own.Id, Request(own), Now));
        Assert.Equal("applications_closed", closed.Code);
    });

    [CallApplicationDbFact]
    public Task ApplicationCrudUsesTheProductionApplicationRole() => WithDb(async db => {
        var own = await Person(db);
        await db.Database.ExecuteSqlRawAsync("SET LOCAL ROLE decatron_app");
        var service = new TournamentCallApplicationService(db);
        var saved = await service.Submit(own.Id, Request(own), Now);
        Assert.Equal(saved.Id, Assert.Single((await service.Me(own.Id)).Applications).Id);
        var withdrawn = await service.Withdraw(own.Id, "participant", saved.Revision, Now);
        Assert.Equal("withdrawn", withdrawn.Status);
    });

    [CallApplicationDbFact]
    public Task ApplicationsDoNotBlockExistingAccountRemoval() => WithDb(async db => {
        var own = await Person(db); var reviewer = await Person(db);
        var service = new TournamentCallApplicationService(db);
        var saved = await service.Submit(own.Id, Request(own), Now);
        await service.Review(saved.Id, reviewer.Id, new("approved", "", saved.Revision), Now);
        db.Users.Remove(reviewer); await db.SaveChangesAsync();
        Assert.Null(await db.TournamentCallApplications.AsNoTracking().Where(a => a.Id == saved.Id).Select(a => a.ReviewedBy).SingleAsync());
        db.Users.Remove(own); await db.SaveChangesAsync();
        Assert.False(await db.TournamentCallApplications.AsNoTracking().AnyAsync(a => a.Id == saved.Id));
    });

    [CallApplicationDbFact]
    public Task ConcurrentReviewDoesNotOverwriteNewerRevision() => WithDb(async db => {
        var own = await Person(db); var service = new TournamentCallApplicationService(db);
        var saved = await service.Submit(own.Id, Request(own), Now);
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE tournament_call_applications SET revision = revision + 1 WHERE id = {saved.Id}");
        var conflict = await Assert.ThrowsAsync<CallApplicationException>(() => service.Review(saved.Id, own.Id, new("approved", "", saved.Revision), Now));
        Assert.Equal("stale_revision", conflict.Code);
    });

    [CallApplicationDbFact]
    public Task NewMoneyOffersGoThroughPaymentButExistingOnesSurvive() => WithDb(async db => {
        var own = await Person(db); var other = await Person(db); var service = new TournamentCallApplicationService(db);
        var money = Request(own, "collaborator") with { ContributionType = "money", AcceptedCustody = false, CustodyNoticeVersion = "" };
        Assert.Equal("money_via_payment", (await Assert.ThrowsAsync<CallApplicationException>(() => service.Submit(own.Id, money, Now))).Code);
        Assert.Empty((await service.Me(own.Id)).Applications);
        // Una solicitud de dinero que ya existia se puede seguir editando: nada existente se quita.
        db.TournamentCallApplications.Add(new TournamentCallApplication { IdentityKey = "user:" + other.Id, UserId = other.Id, ChannelUserId = other.Id,
            Kind = "collaborator", DisplayName = "x", ChannelUrl = "https://www.twitch.tv/x", Contact = "c", ContributionType = "money", Amount = 5, Currency = "USD",
            AcceptedAt = Now, RulesSnapshot = "{}", CreatedAt = Now, UpdatedAt = Now, Revision = 1 });
        await db.SaveChangesAsync();
        var edited = await service.Submit(other.Id, money with { ChannelUserId = other.Id, Revision = 1 }, Now);
        Assert.Equal("money", edited.ContributionType); Assert.Equal("form", edited.Origin);
    });

    [CallApplicationDbFact]
    public Task CustodyRequiresNoticeAndOfferIsPublicOnlyWithItsOwnConsentAfterApproval() => WithDb(async db => {
        var own = await Person(db); var service = new TournamentCallApplicationService(db);
        var request = Request(own, "collaborator") with { ContributionType = "vbucks", Amount = 1000, Currency = "" };
        Assert.Equal("custody_required", (await Assert.ThrowsAsync<CallApplicationException>(() => service.Submit(own.Id, request with { AcceptedCustody = false }, Now))).Code);
        Assert.Equal("notice_changed", (await Assert.ThrowsAsync<CallApplicationException>(() => service.Submit(own.Id, request with { CustodyNoticeVersion = "old" }, Now))).Code);
        var saved = await service.Submit(own.Id, request, Now);
        Assert.True(saved.CustodyAccepted); Assert.False(saved.PublicOffer);
        var approved = await service.Review(saved.Id, own.Id, new("approved", "", saved.Revision), Now);
        Assert.Empty(await service.CustodyOffers()); // ficha publica no equivale a mostrar la cantidad
        var edited = await service.Submit(own.Id, request with { PublicOffer = true, Revision = approved.Revision }, Now);
        Assert.Empty(await service.CustodyOffers()); // editar vuelve a pendiente
        approved = await service.Review(saved.Id, own.Id, new("approved", "", edited.Revision), Now);
        var offer = Assert.Single(await service.CustodyOffers()); Assert.Equal(1000, offer.Amount); Assert.Equal("vbucks", offer.ContributionType);
        var json = JsonSerializer.Serialize(offer);
        Assert.DoesNotContain("private-contact", json); Assert.DoesNotContain("private-notes", json);
        await service.Withdraw(own.Id, "collaborator", approved.Revision, Now);
        Assert.Empty(await service.CustodyOffers());
        Assert.False((await service.Me(own.Id)).Applications.Single().PublicOffer);
    });

    [CallApplicationDbFact]
    public Task PaymentCreatesPendingCollaboratorOnlyOnceAndNeverRewritesAnExistingOne() => WithDb(async db => {
        var own = await Person(db); var service = new TournamentCallApplicationService(db);
        var id = await service.EnsureCollaboratorForPayment(own.Id, own.Id, true, "payer@example.org", 12, Now);
        var created = Assert.Single((await service.Me(own.Id)).Applications);
        Assert.Equal(id, created.Id); Assert.Equal("payment", created.Origin); Assert.Equal("pending", created.Status);
        Assert.True(created.PublicListing); Assert.Equal("money", created.ContributionType); Assert.Equal(12, created.Amount);
        Assert.Equal("private@example.org", created.Contact); // el correo de la cuenta pesa mas que el del checkout
        Assert.Equal(id, await service.EnsureCollaboratorForPayment(own.Id, own.Id, false, "other@example.org", 99, Now));
        var again = Assert.Single((await service.Me(own.Id)).Applications);
        Assert.Equal(12, again.Amount); Assert.True(again.PublicListing); Assert.Equal(created.Revision, again.Revision);
        var stranger = await Person(db);
        Assert.Equal("channel_not_owned", (await Assert.ThrowsAsync<CallApplicationException>(() => service.EnsureCollaboratorForPayment(own.Id, stranger.Id, true, "", 1, Now))).Code);
    });
}
