using System.Text.RegularExpressions;
using Xunit;

namespace Decatron.Tests;

public class PlatformModulesTests
{
    [Fact(DisplayName = "Mis módulos: la lista del endpoint cubre todo [RequiresModule] de los controladores (un módulo nuevo no queda fuera)")]
    public void ListaCubreLosControladores()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "Decatron.csproj"))) dir = dir.Parent;
        Assert.NotNull(dir);

        var usados = Directory.GetFiles(Path.Combine(dir!.FullName, "Decatron.Controllers"), "*.cs")
            .SelectMany(f => Regex.Matches(File.ReadAllText(f), @"RequiresModule\(""(module\.[a-z_]+)""\)").Select(m => m.Groups[1].Value))
            .Distinct().ToList();

        Assert.NotEmpty(usados);
        var lista = File.ReadAllText(Path.Combine(dir.FullName, "Decatron.Controllers", "PlatformModulesController.cs"));
        foreach (var m in usados) Assert.Contains($"\"{m}\"", lista);
    }
}
