using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Decatron.Attributes;
using Decatron.Controllers;
using Decatron.Data;
using Decatron.Services;
using Decatron.Services.Tournament;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Decatron.Tests;

public class TournamentCallDonationTransportTests
{
    private sealed class PaymentMode : IPaymentModeService
    {
        public bool Test { get; set; }
        public string PublicKey => Test ? "pk_test_qa" : "pk_live_qa";
        public Task<ModoCobro> GetModoAsync(CancellationToken ct = default) => Task.FromResult(new ModoCobro(Test));
        public Task<(string PublicKey, string SecretKey, bool EsTest)> GetLlavesAsync(CancellationToken ct = default) => Task.FromResult((PublicKey, "sk_fake_not_a_secret", Test));
        public Task<(bool Ok, string? Error)> CambiarModoAsync(bool esTest, string? quien, CancellationToken ct = default) => throw new NotSupportedException();
    }
    private sealed class Provider(Func<HttpRequestMessage, int, Task<HttpResponseMessage>> response) : HttpMessageHandler, IHttpClientFactory
    {
        public int Calls { get; private set; }
        public List<string> Bodies { get; } = [];
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Assert.Equal("api.culqi.com", request.RequestUri!.Host);
            Bodies.Add(request.Content == null ? "" : await request.Content.ReadAsStringAsync(ct));
            return await response(request, ++Calls);
        }
        public HttpClient CreateClient(string name) => new(this, false);
    }
    private static HttpResponseMessage Json(object body, HttpStatusCode status = HttpStatusCode.Created) =>
        new(status) { Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json") };
    private static object Charge(string reference, string id, int amount = 4560, int refund = 0, bool capture = true, string currency = "PEN") =>
        new { id, @object = "charge", amount, amount_refunded = refund, currency_code = currency, capture,
            metadata = new { call_reference = reference } };
    private static TournamentCallDonationsController Controller(TournamentCallContributionService service, DecatronDbContext db, PaymentMode mode, Provider provider) =>
        new(service, db, mode, null!, provider, NullLogger<TournamentCallDonationsController>.Instance) { ControllerContext = new() { HttpContext = new DefaultHttpContext() } };
    private static TournamentCallDonationsController.ChargeRequest Request(string key, bool authenticated = false) =>
        new(key, "tkn_fake_qa", "qa@example.org", "Test", "Donor", "device-qa", authenticated ? new Authentication3DsRequest { Eci = "05", Xid = "qa", Cavv = "qa", ProtocolVersion = "2.1.0", DirectoryServerTransactionId = "qa" } : null);

    [Fact] public Task SuccessfulChargeUsesStoredAmountAndReplayNeverCallsProvider() => TournamentCallContributionDbTests.WithDb(async db => {
        var service = new TournamentCallContributionService(db); var mode = new PaymentMode();
        var (intent, key) = await service.Prepare(new(12), 3.8m, DateTimeOffset.UtcNow, false, mode.PublicKey);
        var provider = new Provider((r, _) => Task.FromResult(Json(Charge(intent.Reference, "chr_live_qa" + Guid.NewGuid().ToString("N")))));
        var controller = Controller(service, db, mode, provider);
        Assert.IsType<OkObjectResult>(await controller.Charge(Request(key)));
        Assert.IsType<OkObjectResult>(await controller.Charge(Request(key)));
        Assert.Equal(1, provider.Calls);
        using var body = JsonDocument.Parse(Assert.Single(provider.Bodies));
        Assert.Equal(4560, body.RootElement.GetProperty("amount").GetInt32());
        Assert.Equal(intent.Reference, body.RootElement.GetProperty("order_number").GetString());
        Assert.DoesNotContain(key, provider.Bodies[0]); Assert.Equal("charged", (await service.Receipt(key)).State);
        Assert.Empty(await service.Public());
    });

    [Fact] public Task ThreeDsChallengeReusesSourceDeviceAndReference() => TournamentCallContributionDbTests.WithDb(async db => {
        var service = new TournamentCallContributionService(db); var mode = new PaymentMode();
        var (intent, key) = await service.Prepare(new(12), 3.8m, DateTimeOffset.UtcNow, false, mode.PublicKey);
        var provider = new Provider((r, number) => Task.FromResult(number == 1 ? Json(new { action_code = "REVIEW" }, HttpStatusCode.OK) : Json(Charge(intent.Reference, "chr_live_qa" + Guid.NewGuid().ToString("N")))));
        var controller = Controller(service, db, mode, provider);
        Assert.IsType<OkObjectResult>(await controller.Charge(Request(key))); Assert.Equal("authenticating", intent.State);
        Assert.IsType<OkObjectResult>(await controller.Charge(Request(key, true))); Assert.Equal("charged", intent.State);
        Assert.Equal(2, provider.Calls);
        using var first = JsonDocument.Parse(provider.Bodies[0]); using var second = JsonDocument.Parse(provider.Bodies[1]);
        foreach (var field in new[] { "amount", "source_id", "order_number", "antifraud_details" })
            Assert.Equal(first.RootElement.GetProperty(field).ToString(), second.RootElement.GetProperty(field).ToString());
        Assert.True(second.RootElement.TryGetProperty("authentication_3DS", out _));
        Assert.IsType<OkObjectResult>(await controller.Charge(Request(key, true))); Assert.Equal(2, provider.Calls);
    });

    [Fact] public Task NetworkFailureLeavesDurableIntentAndCannotChargeAgain() => TournamentCallContributionDbTests.WithDb(async db => {
        var service = new TournamentCallContributionService(db); var mode = new PaymentMode();
        var (intent, key) = await service.Prepare(new(12), 3.8m, DateTimeOffset.UtcNow, false, mode.PublicKey);
        var provider = new Provider((r, _) => throw new HttpRequestException("simulated transport failure"));
        var controller = Controller(service, db, mode, provider);
        Assert.IsType<ConflictObjectResult>(await controller.Charge(Request(key)));
        Assert.IsType<ObjectResult>(await controller.Charge(Request(key))); Assert.Equal(1, provider.Calls);
        Assert.Equal("processing", intent.State); Assert.Empty(await service.Public());
    });

    [Theory]
    [InlineData("insufficient_funds", "failed")]
    [InlineData("issuer_not_available", "uncertain")]
    [InlineData("processing_error", "uncertain")]
    public Task OnlyDefiniteCardDeclinesAllowAnExplicitNewAttempt(string decline, string state) => TournamentCallContributionDbTests.WithDb(async db => {
        var service = new TournamentCallContributionService(db); var mode = new PaymentMode();
        var (intent, key) = await service.Prepare(new(12), 3.8m, DateTimeOffset.UtcNow, false, mode.PublicKey);
        var provider = new Provider((r, _) => Task.FromResult(Json(new { @object = "error", type = "card_error", code = "card_declined", decline_code = decline }, HttpStatusCode.PaymentRequired)));
        var controller = Controller(service, db, mode, provider);
        var result = await controller.Charge(Request(key)); Assert.IsAssignableFrom<ObjectResult>(result);
        Assert.Equal(state, intent.State); Assert.Null(intent.ContributionId); Assert.Empty(await service.Public());
        await controller.Charge(Request(key)); Assert.Equal(1, provider.Calls);
    });

    [Theory]
    [InlineData("wrong_reference")] [InlineData("wrong_currency")] [InlineData("wrong_amount")]
    [InlineData("refunded")] [InlineData("not_captured")] [InlineData("missing_charge")]
    public Task InvalidProviderResponseNeverBecomesReceived(string scenario) => TournamentCallContributionDbTests.WithDb(async db => {
        var service = new TournamentCallContributionService(db); var mode = new PaymentMode();
        var (intent, key) = await service.Prepare(new(12), 3.8m, DateTimeOffset.UtcNow, false, mode.PublicKey);
        var provider = new Provider((r, _) => Task.FromResult(Json(scenario == "missing_charge" ? new { message = "unknown" } :
            Charge(scenario == "wrong_reference" ? "other" : intent.Reference, "chr_live_qa" + Guid.NewGuid().ToString("N"),
                scenario == "wrong_amount" ? 4500 : 4560, scenario == "refunded" ? 100 : 0, scenario != "not_captured", scenario == "wrong_currency" ? "USD" : "PEN"))));
        Assert.IsType<ConflictObjectResult>(await Controller(service, db, mode, provider).Charge(Request(key)));
        Assert.Null(intent.ContributionId); Assert.NotEqual("charged", intent.State); Assert.Equal(1, provider.Calls);
    });

    [Fact] public Task PaymentModeChangeStopsBeforeProviderAndTestIdIsAlwaysExcluded() => TournamentCallContributionDbTests.WithDb(async db => {
        var service = new TournamentCallContributionService(db); var mode = new PaymentMode();
        var (intent, key) = await service.Prepare(new(12), 3.8m, DateTimeOffset.UtcNow, false, mode.PublicKey);
        var provider = new Provider((r, _) => Task.FromResult(Json(Charge(intent.Reference, "chr_test_qa" + Guid.NewGuid().ToString("N")))));
        var controller = Controller(service, db, mode, provider); mode.Test = true;
        Assert.IsType<ConflictObjectResult>(await controller.Charge(Request(key))); Assert.Equal(0, provider.Calls);
        mode.Test = false; Assert.IsType<OkObjectResult>(await controller.Charge(Request(key)));
        Assert.True((await service.Receipt(key)).IsTest); Assert.Empty(await service.Public());
        Assert.True((await db.SupporterPayments.SingleAsync(p => p.Id == intent.Contribution!.PaymentId)).IsTest);
    });

    [Fact] public Task ReconciliationOnlyFetchesExistingMatchingCharge() => TournamentCallContributionDbTests.WithDb(async db => {
        var service = new TournamentCallContributionService(db); var mode = new PaymentMode();
        var (intent, key) = await service.Prepare(new(12), 3.8m, DateTimeOffset.UtcNow, false, mode.PublicKey);
        await service.Claim(key, "token", null, false, DateTimeOffset.UtcNow);
        var chargeId = "chr_live_qa" + Guid.NewGuid().ToString("N");
        var provider = new Provider((r, _) => { Assert.Equal(HttpMethod.Get, r.Method); return Task.FromResult(Json(Charge(intent.Reference, chargeId), HttpStatusCode.OK)); });
        Assert.IsType<OkObjectResult>(await Controller(service, db, mode, provider).Reconcile(intent.Id, new(chargeId)));
        Assert.Equal("charged", intent.State); Assert.Equal(1, provider.Calls); Assert.Empty(await service.Public());
    });

    [Fact] public Task ActualOwnerFilterRejectsAnonymousAndNonOwner() => TournamentCallContributionDbTests.WithDb(async db => {
        using var services = new ServiceCollection().AddSingleton(db).BuildServiceProvider();
        var filter = new RequireSystemOwnerAttribute();
        foreach (var authenticated in new[] { false, true }) {
            var http = new DefaultHttpContext { RequestServices = services };
            if (authenticated) http.User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("login", "qa_not_an_owner") }, "test"));
            var context = new AuthorizationFilterContext(new ActionContext(http, new RouteData(), new ActionDescriptor()), []);
            await filter.OnAuthorizationAsync(context);
            if (authenticated) Assert.IsType<ForbidResult>(context.Result); else Assert.IsType<UnauthorizedResult>(context.Result);
        }
        var own = await TournamentCallContributionDbTests.Person(db);
        db.SystemAdmins.Add(new() { Username = own.Login, UserId = own.Id, Role = "owner" }); await db.SaveChangesAsync();
        var ownerHttp = new DefaultHttpContext { RequestServices = services,
            User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("login", own.Login) }, "test")) };
        var ownerContext = new AuthorizationFilterContext(new ActionContext(ownerHttp, new RouteData(), new ActionDescriptor()), []);
        await filter.OnAuthorizationAsync(ownerContext); Assert.Null(ownerContext.Result);
    });
}
