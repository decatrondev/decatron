using System.Text.RegularExpressions;
using Decatron.Services.Tenancy;
using Xunit;

namespace Decatron.Tests;

/// <summary>2FA obligatorio para el dueño: qué rutas lo eximen y qué dicen los avisos por correo.</summary>
public class MandatoryMfaTests
{
    private static string Repo()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "Decatron.csproj"))) dir = dir.Parent;
        Assert.NotNull(dir);
        return dir!.FullName;
    }

    private static string Read(params string[] parts) => File.ReadAllText(Path.Combine(new[] { Repo() }.Concat(parts).ToArray()));

    [Fact(DisplayName = "2FA obligatorio: solo el 2FA y el resumen /me se eximen; el resto del comprador queda bloqueado hasta activarlo")]
    public void OnlyMfaAndMeAreExempt()
    {
        var hits = Directory.EnumerateFiles(Path.Combine(Repo(), "Decatron.Controllers"), "*.cs")
            .Where(f => Regex.IsMatch(File.ReadAllText(f), @"\[(?:[A-Za-z, ]*,\s*)?AllowWithoutMfa\]"))
            .Select(Path.GetFileName).OrderBy(x => x).ToArray();
        Assert.Equal(new[] { "BuyerMfaController.cs", "PlatformSignupController.cs" }, hits);

        // En el controlador de registro solo BuyerMe lo lleva.
        var signup = Read("Decatron.Controllers", "PlatformSignupController.cs");
        Assert.Equal(1, Regex.Matches(signup, "AllowWithoutMfa\\]").Count);
        Assert.Matches(@"AllowWithoutMfa\]\s+public async Task<IActionResult> BuyerMe", signup);

        // El filtro lo hace cumplir, con la política encendida por defecto.
        var filter = Read("Decatron.Attributes", "RequireBuyerOwnerAttribute.cs");
        Assert.Contains("mfa_required", filter);
        Assert.Contains("Platform:RequireOwnerMfa\", true", filter);
    }

    [Theory(DisplayName = "2FA obligatorio: los avisos por correo salen en es y en, con el proyecto y el enlace al panel")]
    [InlineData("es", BuyerNotices.MfaOff, "desactiv")]
    [InlineData("en", BuyerNotices.MfaOff, "turned off")]
    [InlineData("es", BuyerNotices.MfaRecovery, "recuperación")]
    [InlineData("en", BuyerNotices.MfaRecovery, "ecovery code")]
    public void NoticesAreLocalized(string locale, string kind, string expected)
    {
        var (subject, html) = BuyerNotices.Build(locale, kind, "Mi <canal>", "https://x.decatron.top/panel");
        Assert.Contains(expected, subject + html, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("https://x.decatron.top/panel", html);
        Assert.Contains("Mi &lt;canal&gt;", html);   // el nombre del proyecto va escapado
        Assert.DoesNotContain("<canal>", html);
    }
}
