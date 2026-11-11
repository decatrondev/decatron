using Decatron.Core.Helpers;
using Decatron.Core.Models;
using Decatron.Data;
using Decatron.Services.PersonalPages;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Decatron.Tests;

/// <summary>Reglas puras de la página personal (subfase 5.1).</summary>
public class PersonalPageRulesTests
{
    private static readonly DateTimeOffset T0 = new(2026, 11, 10, 12, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData("kiravolta", null)]
    [InlineData("kira_volta-2", null)]
    [InlineData("ab", "length")]
    [InlineData("abcdefghijklmnopqrstuvwxyz", "length")]
    [InlineData("kira.volta", "chars")]
    [InlineData("kíra", "chars")]
    [InlineData("_kira", "edge")]
    [InlineData("kira-", "edge")]
    [InlineData("admin", "reserved")]
    [InlineData("sr", "length")]
    [InlineData("torneos", "reserved")]
    [InlineData("pagina-12", "reserved")]
    public void HandleShape(string handle, string? error) => Assert.Equal(error, PersonalPageRules.HandleError(handle));

    [Fact]
    public void AdminReservedListAddsToTheBuiltInOne()
    {
        Assert.Null(PersonalPageRules.HandleError("ibai"));
        Assert.Equal("reserved", PersonalPageRules.HandleError("ibai", new HashSet<string> { "ibai" }));
    }

    [Theory]
    [InlineData(" @KiraVolta ", "kiravolta")]
    [InlineData("Kira Volta!", "kiravolta")]
    [InlineData("__x__", "x")]
    [InlineData("a_very_long_twitch_login_name_123", "a_very_long_twitch_login")]
    public void SuggestionKeepsOnlyValidCharacters(string login, string expected) => Assert.Equal(expected, PersonalPageRules.SuggestHandle(login));

    [Fact]
    public void HandleChangesOnceEveryThirtyDays()
    {
        Assert.True(PersonalPageRules.CanChangeHandle(null, T0));
        Assert.False(PersonalPageRules.CanChangeHandle(T0, T0.AddDays(29).AddHours(23)));
        Assert.True(PersonalPageRules.CanChangeHandle(T0, T0.AddDays(30)));
        Assert.Equal(T0.AddDays(30), PersonalPageRules.NextHandleChange(T0, T0.AddDays(1)));
        Assert.Null(PersonalPageRules.NextHandleChange(T0, T0.AddDays(31)));
    }

    [Fact]
    public void RedirectExpiresAfterItsWindow()
    {
        var until = T0 + PersonalPageRules.RedirectWindow;
        Assert.True(PersonalPageRules.RedirectActive(until, T0.AddDays(29)));
        Assert.False(PersonalPageRules.RedirectActive(until, until));
    }

    [Theory]
    [InlineData("https://www.instagram.com/kira", "instagram", true)]
    [InlineData("https://evil.example/instagram.com", "instagram", false)]
    [InlineData("https://instagram.com.evil.example/kira", "instagram", false)]
    [InlineData("http://www.instagram.com/kira", "instagram", false)]
    [InlineData("https://onlyfans.com/kira", "onlyfans", true)]
    [InlineData("https://youtu.be/abc", "youtube", true)]
    [InlineData("https://twitter.com/kira", "x", true)]
    public void PlatformLinksMustPointToThatPlatform(string url, string kind, bool ok) =>
        Assert.Equal(ok, PersonalPageRules.SafeUrl(url, PersonalPageRules.Platform(kind)));

    [Theory]
    [InlineData("https://tienda.example/setup", true)]
    [InlineData("javascript:alert(1)", false)]
    [InlineData("data:text/html,hola", false)]
    [InlineData("https://user:pass@tienda.example/", false)]
    [InlineData("https://tienda.example:8443/", false)]
    [InlineData("https://localhost/", false)]
    [InlineData("//tienda.example/", false)]
    [InlineData("https://tienda.example/a b", false)]
    [InlineData("", false)]
    public void CustomLinksAreHttpsOnly(string url, bool ok) => Assert.Equal(ok, PersonalPageRules.SafeUrl(url));

    [Theory]
    [InlineData("", true)]
    [InlineData("/api/public/personal-pages/assets/7/avatar-0123456789abcdef0123456789abcdef.webp", true)]
    [InlineData("/api/public/personal-pages/assets/7/../secret.webp", false)]
    [InlineData("https://static-cdn.jtvnw.net/jtv_user_pictures/a.png", true)]
    [InlineData("https://files.kick.com/images/user/1/profile.webp", true)]
    [InlineData("https://evil.example/a.png", false)]
    public void AvatarIsOwnUploadOrChannelPhoto(string url, bool ok) => Assert.Equal(ok, PersonalPageRules.SafeAvatar(url));

    private static PersonalPageContent Valid() => new("Kira Volta", "Juego de noche.", "", "scene", "dark", "#5B8CFF", "archivo", new()
    {
        new("tw", "twitch", "https://twitch.tv/kira", "", true),
        new("shop", "custom", "https://tienda.example/setup", "Mi setup", true),
    });

    [Fact]
    public void ValidContentHasNoErrors()
    {
        Assert.Empty(PersonalPageRules.Errors(Valid(), forPublish: true));
    }

    [Fact]
    public void DraftMaySaveWithoutNameButPublishNeedsIt()
    {
        var noName = Valid() with { DisplayName = "" };
        Assert.Empty(PersonalPageRules.Errors(noName, forPublish: false));
        Assert.Contains("display_name_required", PersonalPageRules.Errors(noName, forPublish: true));
    }

    [Fact]
    public void ReportsEachBadFieldWithItsIndex()
    {
        var c = Valid() with
        {
            Bio = new string('a', PersonalPageRules.BioMax + 1), Accent = "red", Font = "comic", Theme = "pink", Template = "cartel",
            Links = new()
            {
                new("a", "instagram", "https://evil.example/", "", true),
                new("a", "twitch", "https://twitch.tv/x", "", true),
                new("c", "custom", "https://tienda.example/", "", true),
                new("d", "myspace", "https://myspace.com/x", "", true),
                new("e", "twitch", "https://twitch.tv/x", "", true, "gigante"),
            },
        };
        var errors = PersonalPageRules.Errors(c, forPublish: false);
        Assert.Contains("bio_length", errors); Assert.Contains("accent", errors); Assert.Contains("font", errors);
        Assert.Contains("theme", errors); Assert.Contains("template", errors);
        Assert.Contains("link_url:0", errors); Assert.Contains("link_id:1", errors); Assert.Contains("link_title:2", errors); Assert.Contains("link_kind:3", errors); Assert.Contains("link_size:4", errors);
    }

    [Fact]
    public void TooManyLinksIsRejected()
    {
        var links = Enumerable.Range(0, PersonalPageRules.LinksMax + 1).Select(i => new PersonalPageLink($"l{i}", "twitch", "https://twitch.tv/x", "", true)).ToList();
        Assert.Contains("links_count", PersonalPageRules.Errors(Valid() with { Links = links }, forPublish: false));
    }

    [Fact]
    public void NormalizeCleansTextAndKeys()
    {
        var raw = Valid() with
        {
            DisplayName = "  Kira\u0007 Volta ", Bio = "linea 1\r\n\n\n\nlinea 2", Accent = "#abcdef", Font = " ARCHIVO ",
            Links = new() { new(" tw ", " TWITCH ", " https://twitch.tv/kira ", " Hola\u0000 ", true) },
        };
        var c = PersonalPageRules.Normalize(raw);
        Assert.Equal("Kira Volta", c.DisplayName);
        Assert.Equal("linea 1\n\nlinea 2", c.Bio);
        Assert.Equal("#ABCDEF", c.Accent);
        Assert.Equal("archivo", c.Font);
        Assert.Equal(new PersonalPageLink("tw", "twitch", "https://twitch.tv/kira", "Hola", true, "normal"), c.Links![0]);
    }

    [Theory]
    [InlineData("scene")] [InlineData("badge")] [InlineData("channel")] [InlineData("inventory")] [InlineData("poster")]
    public void AllFiveTemplatesAreValid(string template) => Assert.DoesNotContain("template", PersonalPageRules.Errors(Valid() with { Template = template }, forPublish: true));

    [Theory]
    [InlineData("normal")] [InlineData("wide")] [InlineData("big")]
    public void LinkSizesAreValid(string size)
    {
        var c = PersonalPageRules.Normalize(Valid() with { Links = new() { new("a", "twitch", "https://twitch.tv/x", "", true, size.ToUpperInvariant()) } });
        Assert.Empty(PersonalPageRules.Errors(c, forPublish: true));
    }

    [Fact]
    public void AdultPlatformsAreMarked()
    {
        Assert.True(PersonalPageRules.Platform("onlyfans")!.Adult);
        Assert.True(PersonalPageRules.Platform("fansly")!.Adult);
        Assert.False(PersonalPageRules.Platform("instagram")!.Adult);
    }

    [Fact]
    public void AccentComesFromTheMostPresentSaturatedColor()
    {
        var pixels = new List<(byte, byte, byte, byte)>();
        pixels.AddRange(Enumerable.Repeat(((byte)250, (byte)250, (byte)250, (byte)255), 500)); // fondo casi blanco: se ignora
        pixels.AddRange(Enumerable.Repeat(((byte)20, (byte)20, (byte)20, (byte)255), 300));   // casi negro: se ignora
        pixels.AddRange(Enumerable.Repeat(((byte)220, (byte)40, (byte)60, (byte)255), 200));   // rojo, el más presente con color
        pixels.AddRange(Enumerable.Repeat(((byte)40, (byte)90, (byte)220, (byte)255), 50));    // azul
        var hex = PersonalPageAccent.FromPixels(pixels);
        var r = Convert.ToInt32(hex[1..3], 16); var b = Convert.ToInt32(hex[5..7], 16);
        Assert.True(r > 180 && b < 100, hex);
    }

    [Fact]
    public void GreyPhotoFallsBackToDefaultAccent()
    {
        var pixels = Enumerable.Repeat(((byte)128, (byte)128, (byte)128, (byte)255), 400);
        Assert.Equal(PersonalPageAccent.Fallback, PersonalPageAccent.FromPixels(pixels));
    }

    [Fact]
    public void InitialContentUsesChannelNameAndAccent()
    {
        var c = PersonalPageRules.Initial(new string('K', 80), "#00ff88");
        Assert.Equal(PersonalPageRules.DisplayNameMax, c.DisplayName.Length);
        Assert.Equal("#00FF88", c.Accent);
        Assert.Equal("scene", c.Template);
        Assert.Equal("#5B8CFF", PersonalPageRules.Initial("Kira", "rojo").Accent);
    }
}

internal sealed class PersonalPageDbFactAttribute : FactAttribute
{
    public PersonalPageDbFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("DECATRON_APP_CONN")))
            Skip = "Requires DECATRON_APP_CONN pointing to decatron_schema; no production database is allowed.";
    }
}

/// <summary>Página personal contra decatron_schema (nunca prod); cada prueba revierte lo que escribe.</summary>
public class PersonalPageDbTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 10, 12, 0, 0, TimeSpan.Zero);

    private static async Task WithDb(Func<DecatronDbContext, Task> test)
    {
        var connection = Environment.GetEnvironmentVariable("DECATRON_APP_CONN");
        if (new NpgsqlConnectionStringBuilder(connection).Database != "decatron_schema")
            throw new InvalidOperationException("These tests only allow decatron_schema.");
        await using var sql = Decatron.Core.Interfaces.TenantNpgsql.Create(connection, 1);
        await using var db = new DecatronDbContext(new DbContextOptionsBuilder<DecatronDbContext>().UseNpgsql(sql).Options);
        await using var transaction = await db.Database.BeginTransactionAsync();
        try { await test(db); }
        finally { await transaction.RollbackAsync(); }
    }

    private static async Task<User> Channel(DecatronDbContext db)
    {
        var name = "ppqa" + Guid.NewGuid().ToString("N")[..12];
        var user = new User { Login = name, DisplayName = name, TwitchId = name, Email = "private@example.org", ProfileImageUrl = "",
            OfflineImageUrl = "", BroadcasterType = "", ViewCount = 0, Description = "", AccessToken = "", RefreshToken = "", TokenExpiration = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, UniqueId = Guid.NewGuid().ToString("N") };
        db.Users.Add(user); await db.SaveChangesAsync(); return user;
    }

    private static string Handle() => "pp" + Guid.NewGuid().ToString("N")[..10];
    private static PersonalPageContent Initial() => PersonalPageRules.Initial("Kira", "#5B8CFF");

    [PersonalPageDbFact]
    public Task FirstToRegisterKeepsTheHandle() => WithDb(async db =>
    {
        var a = await Channel(db); var b = await Channel(db); var handle = Handle();
        var service = new PersonalPageService(db);
        await service.CreateAsync(a.Id, handle, Initial(), Now);
        var error = await Assert.ThrowsAsync<PersonalPageException>(() => service.CreateAsync(b.Id, handle, Initial(), Now));
        Assert.Equal("taken", error.Code);
        var again = await Assert.ThrowsAsync<PersonalPageException>(() => service.CreateAsync(a.Id, Handle(), Initial(), Now));
        Assert.Equal("already_exists", again.Code);
    });

    [PersonalPageDbFact]
    public Task DatabaseRejectsDuplicateHandlesEvenIfTheCheckIsSkipped() => WithDb(async db =>
    {
        var a = await Channel(db); var b = await Channel(db); var handle = Handle();
        db.PersonalPages.Add(new PersonalPage { ChannelUserId = a.Id, Handle = handle });
        await db.SaveChangesAsync();
        db.PersonalPages.Add(new PersonalPage { ChannelUserId = b.Id, Handle = handle });
        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        Assert.Equal(PostgresErrorCodes.UniqueViolation, (ex.InnerException as PostgresException)?.SqlState);
    });

    [PersonalPageDbFact]
    public Task DraftIsNotPublicUntilPublishAndDiscardRestores() => WithDb(async db =>
    {
        var a = await Channel(db); var service = new PersonalPageService(db);
        var page = await service.CreateAsync(a.Id, Handle(), Initial(), Now);
        Assert.Null(page.Published);
        Assert.True(PersonalPageService.HasUnpublishedChanges(page));
        await service.PublishAsync(page, page.Revision, Now);
        Assert.False(PersonalPageService.HasUnpublishedChanges(page));
        var edited = PersonalPageService.Read(page.Draft) with { Bio = "Bio nueva" };
        await service.SaveDraftAsync(page, edited, page.Revision, Now);
        Assert.Equal("", PersonalPageService.Read(page.Published).Bio);
        Assert.True(PersonalPageService.HasUnpublishedChanges(page));
        await service.DiscardAsync(page, page.Revision, Now);
        Assert.Equal("", PersonalPageService.Read(page.Draft).Bio);
        var stale = await Assert.ThrowsAsync<PersonalPageException>(() => service.PublishAsync(page, page.Revision - 1, Now));
        Assert.Equal("stale_revision", stale.Code);
    });

    [PersonalPageDbFact]
    public Task PublishRequiresDisplayName() => WithDb(async db =>
    {
        var a = await Channel(db); var service = new PersonalPageService(db);
        var page = await service.CreateAsync(a.Id, Handle(), Initial() with { DisplayName = "" }, Now);
        var error = await Assert.ThrowsAsync<PersonalPageException>(() => service.PublishAsync(page, page.Revision, Now));
        Assert.Equal("incomplete_content", error.Code);
        Assert.Contains("display_name_required", error.Details);
    });

    [PersonalPageDbFact]
    public Task HandleChangeWaitsThirtyDaysAndOldNameRedirects() => WithDb(async db =>
    {
        var a = await Channel(db); var b = await Channel(db); var service = new PersonalPageService(db);
        var oldHandle = Handle(); var newHandle = Handle();
        var page = await service.CreateAsync(a.Id, oldHandle, Initial(), Now);
        await service.ChangeHandleAsync(page, newHandle, page.Revision, Now);
        var cooldown = await Assert.ThrowsAsync<PersonalPageException>(() => service.ChangeHandleAsync(page, Handle(), page.Revision, Now.AddDays(10)));
        Assert.Equal("cooldown", cooldown.Code);

        var resolved = await service.ResolveAsync(oldHandle, Now.AddDays(5));
        Assert.Null(resolved.Page); Assert.Equal(newHandle, resolved.RedirectTo);
        Assert.Equal("redirecting", await service.AvailabilityAsync(oldHandle, null, Now.AddDays(5)));
        var takenByOther = await Assert.ThrowsAsync<PersonalPageException>(() => service.CreateAsync(b.Id, oldHandle, Initial(), Now.AddDays(5)));
        Assert.Equal("redirecting", takenByOther.Code);

        // Vencida la redirección, el nombre viejo queda libre
        Assert.Null((await service.ResolveAsync(oldHandle, Now.AddDays(31))).RedirectTo);
        Assert.Null(await service.AvailabilityAsync(oldHandle, null, Now.AddDays(31)));
    });

    [PersonalPageDbFact]
    public Task OwnerCanReclaimOwnOldNameAfterCooldown() => WithDb(async db =>
    {
        var a = await Channel(db); var service = new PersonalPageService(db);
        var first = Handle(); var second = Handle();
        var page = await service.CreateAsync(a.Id, first, Initial(), Now);
        await service.ChangeHandleAsync(page, second, page.Revision, Now);
        Assert.Null(await service.AvailabilityAsync(first, page.Id, Now.AddDays(20)));
        await service.ChangeHandleAsync(page, first, page.Revision, Now.AddDays(30));
        Assert.Equal(first, page.Handle);
        Assert.Equal(first, (await service.ResolveAsync(second, Now.AddDays(31))).RedirectTo);
    });

    [PersonalPageDbFact]
    public Task AdminReservedHandleCannotBeTaken() => WithDb(async db =>
    {
        var a = await Channel(db); var service = new PersonalPageService(db); var handle = Handle();
        await service.AddReservedAsync(handle, "marca", a.Id, Now);
        var error = await Assert.ThrowsAsync<PersonalPageException>(() => service.CreateAsync(a.Id, handle, Initial(), Now));
        Assert.Equal("reserved", error.Code);
    });

    [PersonalPageDbFact]
    public Task AppealTransferGivesHandleAndOwnerChoosesAnother() => WithDb(async db =>
    {
        var owner = await Channel(db); var claimant = await Channel(db); var third = await Channel(db);
        var service = new PersonalPageService(db); var handle = Handle();
        var ownerPage = await service.CreateAsync(owner.Id, handle, Initial(), Now);

        var own = await Assert.ThrowsAsync<PersonalPageException>(() => service.AppealAsync(owner.Id, owner.Id, handle, "Es mi nombre de siempre", Now));
        Assert.Equal("own_handle", own.Code);
        var shortMsg = await Assert.ThrowsAsync<PersonalPageException>(() => service.AppealAsync(claimant.Id, claimant.Id, handle, "corto", Now));
        Assert.Equal("appeal_message", shortMsg.Code);

        var appeal = await service.AppealAsync(claimant.Id, claimant.Id, handle, "Es mi nombre en Twitch desde 2019", Now);
        var dup = await Assert.ThrowsAsync<PersonalPageException>(() => service.AppealAsync(claimant.Id, claimant.Id, handle, "Otra vez el mismo pedido", Now));
        Assert.Equal("appeal_pending", dup.Code);
        var otherAppeal = await service.AppealAsync(third.Id, third.Id, handle, "Yo también lo quiero usar", Now);

        await service.TransferAsync(appeal.Id, owner.Id, "Verificado", _ => Task.FromResult(Initial()), Now);

        var claimantPage = await service.ForChannelAsync(claimant.Id);
        Assert.Equal(handle, claimantPage!.Handle);
        await db.Entry(ownerPage).ReloadAsync();
        Assert.Equal($"pagina-{ownerPage.Id}", ownerPage.Handle);
        Assert.True(ownerPage.NeedsNewHandle);
        Assert.Null((await service.ResolveAsync(handle, Now)).RedirectTo);
        Assert.Equal(handle, (await service.ResolveAsync(handle, Now)).Page!.Handle);
        Assert.Equal("rejected", (await db.PersonalPageHandleAppeals.AsNoTracking().SingleAsync(a => a.Id == otherAppeal.Id)).Status);

        // Quien perdió el nombre elige otro sin esperar 30 días
        await service.ChangeHandleAsync(ownerPage, Handle(), ownerPage.Revision, Now.AddMinutes(1));
        Assert.False(ownerPage.NeedsNewHandle);
    });

    [PersonalPageDbFact]
    public Task RejectAndWithdrawCloseAppeals() => WithDb(async db =>
    {
        var owner = await Channel(db); var claimant = await Channel(db); var service = new PersonalPageService(db); var handle = Handle();
        await service.CreateAsync(owner.Id, handle, Initial(), Now);
        var appeal = await service.AppealAsync(claimant.Id, claimant.Id, handle, "Es mi nombre en Twitch desde 2019", Now);
        await service.RejectAppealAsync(appeal.Id, owner.Id, "Sin pruebas", Now);
        var closed = await Assert.ThrowsAsync<PersonalPageException>(() => service.WithdrawAppealAsync(claimant.Id, appeal.Id, Now));
        Assert.Equal("appeal_closed", closed.Code);
        var second = await service.AppealAsync(claimant.Id, claimant.Id, handle, "Ahora con pruebas adjuntas", Now);
        await service.WithdrawAppealAsync(claimant.Id, second.Id, Now);
        Assert.Equal("withdrawn", (await db.PersonalPageHandleAppeals.AsNoTracking().SingleAsync(a => a.Id == second.Id)).Status);
    });

    [PersonalPageDbFact]
    public Task HiddenPageKeepsReason() => WithDb(async db =>
    {
        var a = await Channel(db); var service = new PersonalPageService(db);
        var page = await service.CreateAsync(a.Id, Handle(), Initial(), Now);
        await service.SetHiddenAsync(page.Id, true, "Denuncia revisada", Now);
        await db.Entry(page).ReloadAsync();
        Assert.Equal("hidden", page.Status); Assert.Equal("Denuncia revisada", page.HiddenReason);
        await service.SetHiddenAsync(page.Id, false, "", Now);
        await db.Entry(page).ReloadAsync();
        Assert.Equal("active", page.Status); Assert.Equal("", page.HiddenReason);
    });
}
