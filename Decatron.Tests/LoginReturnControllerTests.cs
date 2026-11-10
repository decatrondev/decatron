using Decatron.Controllers;
using Decatron.Discord;
using Decatron.Core.Helpers;
using Decatron.Core.Settings;
using Decatron.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Decatron.Tests;

public class LoginReturnControllerTests
{
    const string Path = "/supporters?call=fortnite-streamers#donar";
    const string Key = "only-a-test-key-long-enough-123456789";
    static ControllerContext Context(string host = "decatron.net")
    {
        var http = new DefaultHttpContext(); http.Request.Host = new HostString(host);
        return new ControllerContext { HttpContext = http };
    }
    static void Check(IActionResult result, string origin = "https://decatron.net", bool hasReturn = true)
    {
        var uri = new Uri(Assert.IsType<RedirectResult>(result).Url!);
        Assert.Equal(origin, uri.GetLeftPart(UriPartial.Authority)); Assert.Equal("/login", uri.AbsolutePath);
        var query = QueryHelpers.ParseQuery(uri.Query);
        if (hasReturn) Assert.Equal(Path, query["redirect"].ToString()); else Assert.False(query.ContainsKey("redirect"));
    }

    [Fact]
    public async Task TwitchSignedContinuationReturnsToOriginalSiteOnCancellation()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = new AuthController(null!, null!, null!, NullLogger<AuthController>.Instance,
            Options.Create(new JwtSettings { SecretKey = Key }), Options.Create(new TwitchSettings { FrontendUrl = "https://twitch.decatron.net" }),
            null!, null!, cache, null!, null!, null!, null!, null!) { ControllerContext = Context("twitch.decatron.net") };
        var state = AuthService.SignOAuthState(LoginReturn.Create("https://decatron.net", Path)!.Encode(), null, Key);
        Check(await controller.Callback(error: "access_denied", state: state));
        Check(await controller.Callback(error: "access_denied", state: state + "forged"), "https://twitch.decatron.net", false);
        var tenantState = AuthService.SignOAuthState(LoginReturn.Create("https://decatron.net", Path)!.Encode(), 7, Key);
        controller.ControllerContext = Context("tenant.decatron.top");
        Check(await controller.Callback(error: "access_denied", state: tenantState), "https://tenant.decatron.top", false);
    }

    [Theory]
    [InlineData("decatron.net")]
    [InlineData("twitch.decatron.net")]
    public async Task KickPreservesNormalLoginAndLeavesRegisteredCallback(string host)
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = new KickAuthController(null!, Options.Create(new KickSettings { ClientId = "test", RedirectUri = "https://kick.decatron.net/api/auth/kick/callback", Scopes = "user:read" }),
            Options.Create(new JwtSettings()), Options.Create(new TwitchSettings { FrontendUrl = "https://twitch.decatron.net" }),
            null!, cache, null!, null!, null!, null!, NullLogger<KickAuthController>.Instance) { ControllerContext = Context(host) };
        var url = new Uri(Assert.IsType<RedirectResult>(controller.Login(Path)).Url!);
        var query = QueryHelpers.ParseQuery(url.Query);
        Assert.Equal("https://kick.decatron.net/api/auth/kick/callback", query["redirect_uri"].ToString());
        controller.ControllerContext = Context("kick.decatron.net");
        Check(await controller.Callback(null, query["state"], "access_denied"), "https://" + host);
        Check(await controller.Callback(null, "unknown-state", "access_denied"), "https://twitch.decatron.net", false);
    }

    [Theory]
    [InlineData("decatron.net")]
    [InlineData("twitch.decatron.net")]
    public async Task DiscordPreservesNormalLoginAndLinkMode(string host)
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = new DiscordAuthController(Options.Create(new Decatron.Discord.Models.DiscordSettings {
            AppId = "test", LoginRedirectUri = "https://twitch.decatron.net/api/auth/discord/callback", FrontendUrl = "https://twitch.decatron.net" }),
            Options.Create(new JwtSettings()), null!, NullLogger<DiscordAuthController>.Instance, null!, cache) { ControllerContext = Context(host) };
        var url = new Uri(Assert.IsType<RedirectResult>(controller.Login(Path)).Url!);
        var query = QueryHelpers.ParseQuery(url.Query);
        Assert.Equal("https://twitch.decatron.net/api/auth/discord/callback", query["redirect_uri"].ToString());
        Check(await controller.Callback(error: "access_denied", state: query["state"]), "https://" + host);
        cache.Set("discord_auth_state:link-state", "link:123");
        Check(await controller.Callback(error: "access_denied", state: "link-state"), "https://twitch.decatron.net", false);
    }
}
