using Decatron.Core.Helpers;
using Decatron.Services;
using Xunit;

namespace Decatron.Tests;

public class LoginReturnTests
{
    [Theory]
    [InlineData("/supporters?call=fortnite-streamers#donar")]
    [InlineData("/admin/convocatorias?tab=contributions#receipt")]
    [InlineData("/oauth/authorize?client_id=a&redirect_uri=http%3A%2F%2Flocalhost%3A9876%2Fcallback&state=xyz")]
    public void SignedStatePreservesOriginQueryAndFragment(string path)
    {
        var expected = LoginReturn.Create("https://decatron.net", path)!;
        var signed = AuthService.SignOAuthState(expected.Encode(), null, "only-a-test-key-long-enough-123456789");
        var (valid, value, tenant) = AuthService.ValidateOAuthStateWithTenant(signed, "only-a-test-key-long-enough-123456789");
        Assert.True(valid); Assert.Null(tenant); Assert.Equal(expected, LoginReturn.Decode(value));
        Assert.Equal(path, Uri.UnescapeDataString(expected.Query[10..]));
    }

    [Theory]
    [InlineData("https://evil.example")]
    [InlineData("https://decatron.net.evil.example")]
    [InlineData("http://decatron.net")]
    [InlineData("https://decatron.net:9876")]
    [InlineData("https://tenant.decatron.top")]
    public void UntrustedOriginsRejected(string origin) => Assert.Null(LoginReturn.Create(origin, "/supporters"));

    [Theory]
    [InlineData("//evil.example")]
    [InlineData("https://evil.example")]
    [InlineData("/%2f/evil.example")]
    [InlineData("/%255c%255cevil.example")]
    [InlineData("/a/../login")]
    [InlineData("/%6cogin?redirect=/supporters")]
    [InlineData("/api/auth/login")]
    [InlineData("/supporters\r\nLocation: evil")]
    [InlineData("/\\evil.example")]
    public void UnsafeDestinationsRejected(string path) => Assert.Null(LoginReturn.LocalPath(path));

    [Fact]
    public void LegacyPathsAndInvalidPayloads()
    {
        Assert.Equal("/supporters?call=x#donar", LoginReturn.LocalPath("supporters?call=x#donar"));
        Assert.Equal("/dashboard", LoginReturn.Create("https://kick.decatron.net", null)!.Path);
        Assert.Null(LoginReturn.Decode("login-return:garbage"));
        Assert.Null(LoginReturn.Decode("login-return:" + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("{}"))));
        Assert.Null(LoginReturn.Decode(new LoginReturn("https://evil.example", "/supporters").Encode()));
    }
}
