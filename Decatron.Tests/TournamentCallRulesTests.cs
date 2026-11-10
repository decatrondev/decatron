using Decatron.Core.Helpers;
using Xunit;

namespace Decatron.Tests;
public class TournamentCallRulesTests
{
    [Theory]
    [InlineData("//evil.example/a.jpg")]
    [InlineData("/uploads/brand/../secret.jpg")]
    [InlineData("/uploads/brand/a.svg")]
    [InlineData("/uploads/brand/%2e%2e/private.jpg")]
    [InlineData("javascript:alert(1)")]
    public void RejectsUnsafeImages(string url) => Assert.False(TournamentCallRules.SafeImage(url));

    [Fact]
    public void DraftDoesNotRequirePublicationFields()
    {
        var content = new TournamentCallContent(new(), new());
        Assert.True(TournamentCallRules.Valid(content, false));
        Assert.False(TournamentCallRules.Valid(content, true));
    }

    [Fact]
    public void PublicationRequiresBothLanguagesAndImageProvenance()
    {
        var copy = new CallCopy("Title", "Summary", "Image description", "Rules");
        var content = new TournamentCallContent(copy, copy, "/uploads/brand/0123456789abcdef0123456789abcdef.webp", "Author", "https://example.org/source");
        Assert.True(TournamentCallRules.Valid(content, true));
        Assert.False(TournamentCallRules.Valid(content with { En = new() }, true));
        Assert.False(TournamentCallRules.Valid(content with { ImageSource = "javascript:alert(1)" }, true));
    }

    [Theory]
    [InlineData("", true)]
    [InlineData("/torneos/pixipnj/decatron-streamers-cup", true)]
    [InlineData("https://evil.example/torneos/a/b", false)]
    [InlineData("//evil.example/torneos/a/b", false)]
    [InlineData("/torneos/pixipnj/../admin", false)]
    [InlineData("/torneos/pixipnj", false)]
    public void TournamentLinkIsOnlyAnInternalTournamentPath(string value, bool expected) => Assert.Equal(expected, TournamentCallRules.SafeTournamentPath(value));
}
