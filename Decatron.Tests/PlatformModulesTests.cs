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

        var usados = Directory.GetDirectories(dir!.FullName, "Decatron.*").Where(d => !d.EndsWith("Decatron.Tests"))
            .SelectMany(d => Directory.GetFiles(d, "*.cs", SearchOption.AllDirectories)).Where(f => !f.Contains("/obj/") && !f.Contains("/bin/"))
            .SelectMany(f => Regex.Matches(File.ReadAllText(f), @"RequiresModule\(""([a-z_.,]+)""\)").SelectMany(m => m.Groups[1].Value.Split(',')))
            .Distinct().ToList();

        Assert.NotEmpty(usados);
        var lista = File.ReadAllText(Path.Combine(dir.FullName, "Decatron.Controllers", "PlatformModulesController.cs"));
        foreach (var m in usados) Assert.Contains($"\"{m}\"", lista);
    }

    [Fact(DisplayName = "Mis módulos: todo módulo que el panel nombra (rutas, tarjetas, menú, Dashboard) existe en el catálogo")]
    public void PanelSoloNombraModulosDelCatalogo()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "Decatron.csproj"))) dir = dir.Parent;
        Assert.NotNull(dir);

        var lista = File.ReadAllText(Path.Combine(dir!.FullName, "Decatron.Controllers", "PlatformModulesController.cs"));
        var catalogo = Regex.Matches(lista, @"""module\.([a-z_]+)""").Select(m => m.Groups[1].Value).ToHashSet();
        Assert.True(catalogo.Count >= 45, "El catálogo del endpoint debe listar los 45 módulos");

        var src = Path.Combine(dir.FullName, "ClientApp", "src");
        var nombrados = new HashSet<string>();
        foreach (var f in Directory.GetFiles(src, "*.tsx", SearchOption.AllDirectories).Concat(Directory.GetFiles(src, "*.ts", SearchOption.AllDirectories)))
        {
            var t = File.ReadAllText(f);
            foreach (Match m in Regex.Matches(t, @"planHas\('([a-z_]+)'\)")) nombrados.Add(m.Groups[1].Value);
            foreach (Match m in Regex.Matches(t, @"\bmodule: '([a-z_]+)'")) nombrados.Add(m.Groups[1].Value);
        }
        // Rutas y grupos del contexto, y el mapa de tarjetas de overlays
        var ctx = File.ReadAllText(Path.Combine(src, "contexts", "PlanModulesContext.tsx"));
        foreach (Match m in Regex.Matches(ctx, @"\['/[^']*', '([a-z_]+)'\]")) nombrados.Add(m.Groups[1].Value);
        foreach (Match b in Regex.Matches(ctx, @"(?:OVERLAY_MODULES|MODERATION_MODULES) = \[([^\]]*)\]"))
            foreach (Match m in Regex.Matches(b.Groups[1].Value, @"'([a-z_]+)'")) nombrados.Add(m.Groups[1].Value);
        var ov = Regex.Match(File.ReadAllText(Path.Combine(src, "pages", "features", "Overlays.tsx")), @"OVERLAY_MODULE: Record<string, string> = \{([^}]*)\}");
        foreach (Match m in Regex.Matches(ov.Groups[1].Value, @":\s*'([a-z_]+)'")) nombrados.Add(m.Groups[1].Value);

        Assert.NotEmpty(nombrados);
        var faltan = nombrados.Where(n => !catalogo.Contains(n)).ToList();
        Assert.True(faltan.Count == 0, "El panel nombra módulos que no existen en el catálogo: " + string.Join(", ", faltan));
    }
}
