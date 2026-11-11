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
    // ---------- Subfase 5.2: +18, dominios, acortadores y denuncias ----------

    private static PersonalPageDomainPolicy Policy(string[]? adult = null, string[]? blocked = null) =>
        new((adult ?? Array.Empty<string>()).ToHashSet(), (blocked ?? Array.Empty<string>()).ToHashSet());

    [Theory]
    [InlineData("pornhub.com", "pornhub.com", true)]
    [InlineData("m.pornhub.com", "pornhub.com", true)]
    [InlineData("notpornhub.com", "pornhub.com", false)]
    [InlineData("pornhub.com.evil.net", "pornhub.com", false)]
    [InlineData("", "pornhub.com", false)]
    public void DomainMatchesOnlyTheDomainAndItsSubdomains(string host, string domain, bool ok) => Assert.Equal(ok, PersonalPageRules.DomainMatches(host, domain));

    [Theory]
    [InlineData("https://www.Sitio.com/ruta?x=1", "sitio.com")]
    [InlineData("sitio.com", "sitio.com")]
    [InlineData("  SUB.sitio.co.uk ", "sub.sitio.co.uk")]
    [InlineData("https://usuario:clave@sitio.com", null)]
    [InlineData("no es un dominio", null)]
    [InlineData("localhost", null)]
    [InlineData("", null)]
    public void AdminDomainsAreNormalized(string input, string? expected) => Assert.Equal(expected, PersonalPageRules.NormalizeDomain(input));

    [Theory]
    [InlineData("instagram.com", true)]
    [InlineData("youtu.be", true)]
    [InlineData("decatron.net", true)]
    [InlineData("onlyfans.com", false)]
    [InlineData("sitio-raro.xyz", false)]
    public void PlatformHostsCannotBeBlocked(string domain, bool isProtected) => Assert.Equal(isProtected, PersonalPageRules.IsProtectedHost(domain));

    [Fact]
    public void ShortenersAreRejectedInCustomLinks()
    {
        var c = Valid() with { Links = new() { new("a", "custom", "https://bit.ly/abc", "Mi tienda"), new("b", "custom", "https://mi-tienda.com", "Tienda") } };
        var errors = PersonalPageRules.Errors(c, forPublish: false);
        Assert.Contains("link_shortener:0", errors);
        Assert.DoesNotContain("link_shortener:1", errors);
    }

    [Fact]
    public void BlockedDomainsCannotBeSavedButOthersCan()
    {
        var c = Valid() with { Links = new() { new("a", "custom", "https://login.estafa.example/x", "Premio"), new("b", "custom", "https://bueno.example", "Bueno") } };
        var errors = PersonalPageRules.Errors(c, forPublish: false, Policy(blocked: new[] { "estafa.example" }));
        Assert.Contains("link_blocked:0", errors);
        Assert.DoesNotContain("link_blocked:1", errors);
        Assert.Empty(PersonalPageRules.Errors(c, forPublish: false));
    }

    [Fact]
    public void AdultIsForcedByPlatformKnownSiteOrAdminDomain()
    {
        var policy = Policy(adult: new[] { "nuevo-adulto.example" });
        Assert.True(PersonalPageRules.ForcedAdult(new("a", "onlyfans", "https://onlyfans.com/kira"), policy));
        Assert.True(PersonalPageRules.ForcedAdult(new("b", "custom", "https://es.pornhub.com/model/x", "Canal"), policy));
        Assert.True(PersonalPageRules.ForcedAdult(new("c", "custom", "https://nuevo-adulto.example/kira", "Otro"), policy));
        Assert.False(PersonalPageRules.ForcedAdult(new("d", "instagram", "https://instagram.com/kira"), policy));
    }

    [Fact]
    public void ApplyForcedMarksLinksAndKeepsOwnerMarks()
    {
        var c = Valid() with { Links = new() { new("a", "onlyfans", "https://onlyfans.com/kira"), new("b", "custom", "https://mi.example", "Mío", Adult: true), new("c", "twitch", "https://twitch.tv/kira") } };
        var forced = PersonalPageRules.ApplyForced(c, PersonalPageDomainPolicy.Empty, pageForced: false);
        Assert.Equal(new[] { true, true, false }, forced.Links!.Select(l => l.Adult));
        Assert.False(forced.Adult);
        Assert.True(PersonalPageRules.ApplyForced(c, PersonalPageDomainPolicy.Empty, pageForced: true).Adult);
        Assert.True(PersonalPageRules.ApplyForced(c with { Adult = true }, PersonalPageDomainPolicy.Empty, pageForced: false).Adult);
    }

    [Fact]
    public void PublicViewDropsHiddenAndLaterBlockedLinks()
    {
        var c = Valid() with { Links = new()
        {
            new("a", "twitch", "https://twitch.tv/kira"),
            new("b", "custom", "https://ahora-estafa.example", "Antes bueno"),
            new("c", "youtube", "https://youtube.com/@kira", Visible: false),
            new("d", "custom", "https://adulto-nuevo.example", "Otro"),
        } };
        var view = PersonalPageRules.PublicView(c, Policy(adult: new[] { "adulto-nuevo.example" }, blocked: new[] { "ahora-estafa.example" }), pageForced: false);
        Assert.Equal(new[] { "a", "d" }, view.Links!.Select(l => l.Id));
        Assert.True(view.Links!.Single(l => l.Id == "d").Adult);
    }

    [Fact]
    public void ReportReasonsAndActionsAreTheAgreedOnes()
    {
        Assert.Equal(new[] { "adult_unmarked", "scam", "impersonation", "hate", "copyright", "other" }, PersonalPageRules.ReportReasons);
        Assert.Equal(new[] { "dismiss", "hide", "force_adult", "block_domain" }, PersonalPageRules.ReportActions);
    }
    // ---------- Subfase 5.3: escena por capas ----------

    private static PersonalPageScene Scene(params PersonalPageLayer[] layers) => new(true, "pattern", "", "", layers.ToList());
    private static readonly Dictionary<string, string> Gallery = new() { ["/timerextensible/kira/fondos/a.png"] = "image", ["/timerextensible/kira/x/b.gif"] = "gif", ["/timerextensible/kira/x/c.webm"] = "video", ["/timerextensible/kira/x/d.mp3"] = "sound" };

    [Fact]
    public void ValidSceneHasNoErrors()
    {
        var s = Scene(new("p", "photo", 60, 80, 300, 300), new("n", "name", 60, 420, 900, 200), new("b", "bio", 60, 640, 900, 120),
            new("s", "sticker", 700, 60, 300, 300, MediaUrl: "/timerextensible/kira/x/b.gif"), new("t", "text", 60, 900, 600, 120, Text: "gg ez", Font: "chivo", Color: "#FFCC00", Size: 64, Align: "center"))
            with { Background = "media", BgMedia = "/timerextensible/kira/x/c.webm" };
        Assert.Empty(PersonalPageRules.SceneErrors(s, Gallery));
    }

    [Fact]
    public void SceneRejectsBadLayersWithTheirIndex()
    {
        var s = Scene(new("p", "photo", 0, 0, 300, 300), new("p2", "photo", 0, 0, 300, 300), new("x", "laser", 0, 0, 10, 10),
            new("s", "sticker", 0, 0, 100, 100, MediaUrl: "/timerextensible/kira/x/d.mp3"), new("t", "text", 0, 0, 100, 100, Text: ""),
            new("f", "text", 5000, 0, 100, 100, Text: "lejos"), new("c", "text", 0, 0, 100, 100, Text: "a", Color: "rojo", Size: 2, Align: "top", Font: "comic"));
        var e = PersonalPageRules.SceneErrors(s, Gallery);
        Assert.Contains("layer_repeated:1", e);
        Assert.Contains("layer_kind:2", e);
        Assert.Contains("layer_media:3", e);
        Assert.Contains("layer_text:4", e);
        Assert.Contains("layer_rect:5", e);
        Assert.Contains("layer_color:6", e); Assert.Contains("layer_size:6", e); Assert.Contains("layer_align:6", e); Assert.Contains("layer_font:6", e);
    }

    [Fact]
    public void SceneMediaMustComeFromTheChannelGallery()
    {
        var external = Scene(new PersonalPageLayer("s", "sticker", 0, 0, 100, 100, MediaUrl: "https://otro.example/a.png")) with { Background = "media", BgMedia = "/timerextensible/otro/z.png" };
        var e = PersonalPageRules.SceneErrors(external, Gallery);
        Assert.Contains("layer_media:0", e);
        Assert.Contains("scene_bg_media", e);
        Assert.Contains("scene_bg_media", PersonalPageRules.SceneErrors(Scene() with { Background = "media", BgMedia = "/timerextensible/kira/x/d.mp3" }, Gallery));
    }

    [Fact]
    public void SceneHasTechnicalCaps()
    {
        var stickers = Enumerable.Range(0, PersonalPageRules.SceneStickersMax + 1).Select(i => new PersonalPageLayer($"s{i}", "sticker", 0, 0, 50, 50, MediaUrl: "/timerextensible/kira/fondos/a.png")).ToArray();
        Assert.Contains("scene_stickers_count", PersonalPageRules.SceneErrors(Scene(stickers), Gallery));
        var texts = Enumerable.Range(0, PersonalPageRules.SceneTextsMax + 1).Select(i => new PersonalPageLayer($"t{i}", "text", 0, 0, 50, 50, Text: "x")).ToArray();
        Assert.Contains("scene_texts_count", PersonalPageRules.SceneErrors(Scene(texts), Gallery));
    }

    [Fact]
    public void SceneViewDropsHiddenLayersAndDeletedFiles()
    {
        var s = Scene(new("a", "sticker", 0, 0, 50, 50, MediaUrl: "/timerextensible/kira/fondos/a.png"), new("b", "sticker", 0, 0, 50, 50, MediaUrl: "/timerextensible/kira/borrado.png"),
            new("c", "text", 0, 0, 50, 50, Visible: false, Text: "oculto"), new("d", "name", 0, 0, 50, 50)) with { Background = "media", BgMedia = "/timerextensible/kira/borrado.webm" };
        var view = PersonalPageRules.SceneView(s, Gallery)!;
        Assert.Equal(new[] { "a", "d" }, view.Layers!.Select(l => l.Id));
        Assert.Equal("pattern", view.Background);
        Assert.Equal(new[] { "/timerextensible/kira/borrado.webm", "/timerextensible/kira/borrado.png" }, PersonalPageRules.MissingSceneMedia(s, Gallery));
    }

    [Fact]
    public void ContentWithoutSceneStillValidAndSceneErrorsJoinContentErrors()
    {
        Assert.Empty(PersonalPageRules.Errors(Valid(), forPublish: true));
        var c = Valid() with { Scene = Scene() with { Background = "neon" } };
        Assert.Contains("scene_background", PersonalPageRules.Errors(c, forPublish: false, gallery: Gallery));
    }
    // ---------- Subfase 5.4: videos, fotos y sonidos ----------

    [Theory]
    [InlineData("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ")]
    [InlineData("https://youtu.be/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ")]
    [InlineData("https://youtube.com/shorts/dQw4w9WgXcQ", "youtube-short", "dQw4w9WgXcQ")]
    [InlineData("https://www.twitch.tv/videos/123456789", "twitch-video", "123456789")]
    [InlineData("https://www.twitch.tv/kira/clip/FunnyClipSlug-abc", "twitch-clip", "FunnyClipSlug-abc")]
    [InlineData("https://clips.twitch.tv/FunnyClipSlug", "twitch-clip", "FunnyClipSlug")]
    [InlineData("https://twitch.tv/KiraVolta", "twitch-channel", "kiravolta")]
    [InlineData("https://kick.com/kira-volta", "kick", "kira-volta")]
    [InlineData("https://www.tiktok.com/@kira/video/7234567890123456789", "tiktok", "7234567890123456789")]
    public void VideoLinksAreRecognized(string url, string kind, string id)
    {
        var v = PersonalPageRules.ParseVideo(url);
        Assert.NotNull(v);
        Assert.Equal(kind, v!.Kind);
        Assert.Equal(id, v.Ref);
    }

    [Theory]
    [InlineData("http://www.youtube.com/watch?v=dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/watch?v=corto")]
    [InlineData("https://www.youtube.com/@kira")]
    [InlineData("https://twitch.tv/directory")]
    [InlineData("https://kick.com/categories")]
    [InlineData("https://vimeo.com/123")]
    [InlineData("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")]
    [InlineData("javascript:alert(1)")]
    public void OtherLinksAreNotVideos(string url) => Assert.Null(PersonalPageRules.ParseVideo(url));

    [Fact]
    public void MediaErrorsWithIndex()
    {
        var c = Valid() with
        {
            Videos = new() { new("v1", "https://youtu.be/dQw4w9WgXcQ"), new("v2", "https://vimeo.com/1"), new("v1", "https://youtu.be/dQw4w9WgXcQ") },
            Photos = new() { new("p1", "/timerextensible/kira/fondos/a.png"), new("p2", "/timerextensible/kira/x/d.mp3"), new("p3", "/timerextensible/kira/x/b.gif", new string('x', 81)) },
            Sound = new("/timerextensible/kira/fondos/a.png", "", ClickEnabled: true, Volume: 150),
        };
        var e = PersonalPageRules.MediaErrors(c, Gallery);
        Assert.DoesNotContain(e, x => x.EndsWith(":0") && x.StartsWith("video"));
        Assert.Contains("video_url:1", e);
        Assert.Contains("video_id:2", e);
        Assert.Contains("photo_media:1", e);
        Assert.Contains("photo_caption:2", e);
        Assert.Contains("sound_entry", e);
        Assert.Contains("sound_click", e);
        Assert.Contains("sound_volume", e);
    }

    [Fact]
    public void MediaHasTechnicalCaps()
    {
        var c = Valid() with
        {
            Videos = Enumerable.Range(0, PersonalPageRules.VideosMax + 1).Select(i => new PersonalPageVideo($"v{i}", "https://youtu.be/dQw4w9WgXcQ")).ToList(),
            Photos = Enumerable.Range(0, PersonalPageRules.PhotosMax + 1).Select(i => new PersonalPagePhoto($"p{i}", "/timerextensible/kira/fondos/a.png")).ToList(),
        };
        var e = PersonalPageRules.MediaErrors(c, Gallery);
        Assert.Contains("videos_count", e);
        Assert.Contains("photos_count", e);
    }

    [Fact]
    public void SoundNeedsAFileAndVolume()
    {
        Assert.False(PersonalPageRules.HasSound(Valid()));
        Assert.True(PersonalPageRules.HasSound(Valid() with { Sound = new("/timerextensible/kira/x/d.mp3") }));
        Assert.False(PersonalPageRules.HasSound(Valid() with { Sound = new("/timerextensible/kira/x/d.mp3", Volume: 0) }));
        Assert.False(PersonalPageRules.HasSound(Valid() with { Sound = new("", "/timerextensible/kira/x/d.mp3", ClickEnabled: false) }));
        Assert.Empty(PersonalPageRules.MediaErrors(Valid() with { Sound = new("/timerextensible/kira/x/d.mp3", "/timerextensible/kira/x/d.mp3", true, 40) }, Gallery));
    }

    [Fact]
    public void MediaViewDropsHiddenVideosAndDeletedFiles()
    {
        var c = Valid() with
        {
            Videos = new() { new("v1", "https://youtu.be/dQw4w9WgXcQ"), new("v2", "https://youtu.be/dQw4w9WgXcQ", Visible: false) },
            Photos = new() { new("p1", "/timerextensible/kira/fondos/a.png"), new("p2", "/timerextensible/kira/borrada.png") },
            Sound = new("/timerextensible/kira/borrado.mp3", "/timerextensible/kira/x/d.mp3", true),
        };
        var view = PersonalPageRules.MediaView(c, Gallery);
        Assert.Equal(new[] { "v1" }, view.Videos!.Select(v => v.Id));
        Assert.Equal(new[] { "p1" }, view.Photos!.Select(p => p.Id));
        Assert.Equal("", view.Sound!.EntryUrl);
        Assert.Equal("/timerextensible/kira/x/d.mp3", view.Sound.ClickUrl);
        Assert.Equal(new[] { "/timerextensible/kira/borrada.png", "/timerextensible/kira/borrado.mp3" }, PersonalPageRules.MissingMedia(c, Gallery));
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

    // ---------- Subfase 5.2 ----------

    private static string Domain() => "pp" + Guid.NewGuid().ToString("N")[..10] + ".example";

    private static async Task<PersonalPage> Published(DecatronDbContext db, PersonalPageService service, long channelId, PersonalPageContent? content = null)
    {
        var page = await service.CreateAsync(channelId, Handle(), Initial(), Now);
        if (content != null) await service.SaveDraftAsync(page, content, page.Revision, Now);
        await service.PublishAsync(page, page.Revision, Now);
        return page;
    }

    [PersonalPageDbFact]
    public Task SavingMarksForcedAdultLinksAndRejectsBlockedDomains() => WithDb(async db =>
    {
        var a = await Channel(db); var service = new PersonalPageService(db); var admin = await Channel(db);
        var blocked = Domain(); var adult = Domain();
        await service.AddDomainAsync($"https://www.{blocked}/x", "blocked", "estafa", admin.Id, Now);
        await service.AddDomainAsync(adult, "adult", "", admin.Id, Now);
        var page = await service.CreateAsync(a.Id, Handle(), Initial(), Now);
        var bad = PersonalPageService.Read(page.Draft) with { Links = new() { new("x", "custom", $"https://{blocked}/premio", "Premio") } };
        var error = await Assert.ThrowsAsync<PersonalPageException>(() => service.SaveDraftAsync(page, bad, page.Revision, Now));
        Assert.Contains("link_blocked:0", error.Details);
        var ok = PersonalPageService.Read(page.Draft) with { Links = new() { new("y", "custom", $"https://{adult}/kira", "Otro"), new("z", "onlyfans", "https://onlyfans.com/kira") } };
        await service.SaveDraftAsync(page, ok, page.Revision, Now);
        Assert.All(PersonalPageService.Read(page.Draft).Links!, l => Assert.True(l.Adult));
    });

    [PersonalPageDbFact]
    public Task PlatformDomainsAndDecatronCannotBeAdded() => WithDb(async db =>
    {
        var admin = await Channel(db); var service = new PersonalPageService(db);
        Assert.Equal("domain_protected", (await Assert.ThrowsAsync<PersonalPageException>(() => service.AddDomainAsync("instagram.com", "blocked", "", admin.Id, Now))).Code);
        Assert.Equal("domain_protected", (await Assert.ThrowsAsync<PersonalPageException>(() => service.AddDomainAsync("decatron.net", "adult", "", admin.Id, Now))).Code);
        Assert.Equal("domain_invalid", (await Assert.ThrowsAsync<PersonalPageException>(() => service.AddDomainAsync("nada", "blocked", "", admin.Id, Now))).Code);
        Assert.Equal("domain_kind", (await Assert.ThrowsAsync<PersonalPageException>(() => service.AddDomainAsync(Domain(), "raro", "", admin.Id, Now))).Code);
        var d = Domain();
        await service.AddDomainAsync(d, "adult", "", admin.Id, Now);
        await service.AddDomainAsync(d, "blocked", "", admin.Id, Now);
        Assert.Equal("blocked", (await db.PersonalPageDomains.SingleAsync(x => x.Domain == d)).Kind);
        await service.RemoveDomainAsync(d);
        Assert.False(await db.PersonalPageDomains.AnyAsync(x => x.Domain == d));
    });

    [PersonalPageDbFact]
    public Task ReportRules() => WithDb(async db =>
    {
        var owner = await Channel(db); var viewer = await Channel(db); var service = new PersonalPageService(db);
        var page = await Published(db, service, owner.Id, Initial() with { Links = new() { new("l1", "custom", "https://algo.example/x", "Algo") } });
        Assert.Equal("own_page", (await Assert.ThrowsAsync<PersonalPageException>(() => service.ReportAsync(page, owner.Id, "scam", "", null, Now))).Code);
        Assert.Equal("report_reason", (await Assert.ThrowsAsync<PersonalPageException>(() => service.ReportAsync(page, viewer.Id, "aburrido", "", null, Now))).Code);
        Assert.Equal("report_detail", (await Assert.ThrowsAsync<PersonalPageException>(() => service.ReportAsync(page, viewer.Id, "scam", new string('x', 1001), null, Now))).Code);
        var report = await service.ReportAsync(page, viewer.Id, "scam", "Pide la clave", "l1", Now);
        Assert.Equal("https://algo.example/x", report.LinkUrl);
        Assert.Equal("report_pending", (await Assert.ThrowsAsync<PersonalPageException>(() => service.ReportAsync(page, viewer.Id, "other", "", null, Now))).Code);
        var unknownLink = await service.ReportAsync(await Published(db, service, (await Channel(db)).Id), viewer.Id, "other", "", "no-existe", Now);
        Assert.Equal("", unknownLink.LinkId);
    });

    [PersonalPageDbFact]
    public Task ReportsHaveADailyLimitPerPerson() => WithDb(async db =>
    {
        var viewer = await Channel(db); var service = new PersonalPageService(db);
        for (var i = 0; i < PersonalPageRules.ReportsPerDay; i++)
            await service.ReportAsync(await Published(db, service, (await Channel(db)).Id), viewer.Id, "other", "", null, Now);
        var extra = await Published(db, service, (await Channel(db)).Id);
        Assert.Equal("report_limit", (await Assert.ThrowsAsync<PersonalPageException>(() => service.ReportAsync(extra, viewer.Id, "other", "", null, Now))).Code);
        Assert.NotNull(await service.ReportAsync(extra, viewer.Id, "other", "", null, Now.AddDays(1).AddMinutes(1)));
    });

    [PersonalPageDbFact]
    public Task HidingFromAReportClosesAllOpenReportsOfThatPage() => WithDb(async db =>
    {
        var owner = await Channel(db); var admin = await Channel(db); var service = new PersonalPageService(db);
        var page = await Published(db, service, owner.Id);
        var r1 = await service.ReportAsync(page, (await Channel(db)).Id, "hate", "", null, Now);
        var r2 = await service.ReportAsync(page, (await Channel(db)).Id, "other", "", null, Now);
        await service.ResolveReportAsync(r1.Id, "hide", "Discurso de odio", admin.Id, Now);
        var reloaded = await db.PersonalPages.AsNoTracking().SingleAsync(p => p.Id == page.Id);
        Assert.Equal("hidden", reloaded.Status);
        Assert.Equal("Discurso de odio", reloaded.HiddenReason);
        Assert.All(await db.PersonalPageReports.AsNoTracking().Where(r => r.PageId == page.Id).ToListAsync(), r => { Assert.Equal("resolved", r.Status); Assert.Equal("hidden", r.Resolution); });
        Assert.Equal("report_closed", (await Assert.ThrowsAsync<PersonalPageException>(() => service.ResolveReportAsync(r2.Id, "dismiss", "", admin.Id, Now))).Code);
    });

    [PersonalPageDbFact]
    public Task ForcedAdultStaysEvenIfTheOwnerUnmarksIt() => WithDb(async db =>
    {
        var owner = await Channel(db); var admin = await Channel(db); var service = new PersonalPageService(db);
        var page = await Published(db, service, owner.Id);
        var report = await service.ReportAsync(page, (await Channel(db)).Id, "adult_unmarked", "", null, Now);
        await service.ResolveReportAsync(report.Id, "force_adult", "", admin.Id, Now);
        var tracked = await db.PersonalPages.SingleAsync(p => p.Id == page.Id);
        Assert.True(tracked.ForcedAdult);
        await service.SaveDraftAsync(tracked, PersonalPageService.Read(tracked.Draft) with { Adult = false }, tracked.Revision, Now);
        await service.PublishAsync(tracked, tracked.Revision, Now);
        Assert.True(PersonalPageService.Read(tracked.Published).Adult);
    });

    [PersonalPageDbFact]
    public Task BlockingTheDomainOfAReportedLinkHidesItPublicly() => WithDb(async db =>
    {
        var owner = await Channel(db); var admin = await Channel(db); var service = new PersonalPageService(db); var d = Domain();
        var page = await Published(db, service, owner.Id, Initial() with { Links = new() { new("l1", "custom", $"https://{d}/premio", "Premio"), new("l2", "twitch", "https://twitch.tv/kira") } });
        var report = await service.ReportAsync(page, (await Channel(db)).Id, "scam", "", "l1", Now);
        await service.ResolveReportAsync(report.Id, "block_domain", "", admin.Id, Now);
        Assert.Equal("blocked", (await db.PersonalPageDomains.SingleAsync(x => x.Domain == d)).Kind);
        var view = PersonalPageRules.PublicView(PersonalPageService.Read(page.Published), await service.DomainPolicyAsync(), page.ForcedAdult);
        Assert.Equal(new[] { "l2" }, view.Links!.Select(l => l.Id));
        var plain = await service.ReportAsync(page, (await Channel(db)).Id, "other", "", null, Now);
        Assert.Equal("report_no_link", (await Assert.ThrowsAsync<PersonalPageException>(() => service.ResolveReportAsync(plain.Id, "block_domain", "", admin.Id, Now))).Code);
    });

    // ---------- Subfase 5.3 ----------

    [PersonalPageDbFact]
    public Task SceneOnlyAcceptsFilesFromTheChannelGallery() => WithDb(async db =>
    {
        var a = await Channel(db); var other = await Channel(db); var service = new PersonalPageService(db);
        db.TimerMediaFiles.Add(new TimerMediaFile { ChannelName = a.Login.ToLower(), UserId = a.Id, FileType = "gif", FilePath = $"/var/www/x/ClientApp/public/timerextensible/{a.Login.ToLower()}/stickers/ok.gif", OriginalFileName = "ok.gif", FileName = "ok.gif", FileSize = 10 });
        db.TimerMediaFiles.Add(new TimerMediaFile { ChannelName = other.Login.ToLower(), UserId = other.Id, FileType = "gif", FilePath = $"ClientApp/public/timerextensible/{other.Login.ToLower()}/stickers/ajeno.gif", OriginalFileName = "a.gif", FileName = "a.gif", FileSize = 10 });
        await db.SaveChangesAsync();
        var gallery = await service.GalleryAsync(a.Id);
        Assert.Equal("gif", gallery[$"/timerextensible/{a.Login.ToLower()}/stickers/ok.gif"]);
        var page = await service.CreateAsync(a.Id, Handle(), Initial(), Now);
        var ajeno = Initial() with { Scene = new(true, "pattern", "", "", new() { new("s", "sticker", 0, 0, 100, 100, MediaUrl: $"/timerextensible/{other.Login.ToLower()}/stickers/ajeno.gif") }) };
        var error = await Assert.ThrowsAsync<PersonalPageException>(() => service.SaveDraftAsync(page, ajeno, page.Revision, Now));
        Assert.Contains("layer_media:0", error.Details);
        var propio = Initial() with { Scene = new(true, "pattern", "", "", new() { new("s", "sticker", 0, 0, 100, 100, MediaUrl: $"/timerextensible/{a.Login.ToLower()}/stickers/ok.gif") }) };
        await service.SaveDraftAsync(page, propio, page.Revision, Now);
        await service.PublishAsync(page, page.Revision, Now);
        Assert.Single(PersonalPageService.Read(page.Published).Scene!.Layers!);
    });
}
