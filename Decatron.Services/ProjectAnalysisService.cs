using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace Decatron.Services
{
    /// <summary>
    /// Radiografía del propio proyecto: tamaño, composición y dónde está el riesgo.
    ///
    /// Se calcula en C# y no llamando al script de .dev/tools: ejecutar shell desde una
    /// petición web y parsear su salida de texto se rompe en silencio el día que alguien
    /// toca un printf. El script sigue existiendo para cuando estás en SSH.
    ///
    /// El inventario sale de `git ls-files`, así que respeta .gitignore. Es la diferencia
    /// entre medir el proyecto y medir la carpeta: aquí hay más de mil archivos subidos
    /// por streamers —sonidos, sprites, media de alertas— que no son código de nadie.
    /// </summary>
    public class ProjectAnalysisService
    {
        private readonly IMemoryCache _cache;
        private readonly ILogger<ProjectAnalysisService> _logger;
        private readonly string _root;

        private const string CacheKey = "project_analysis";

        /// <summary>El código no cambia entre una petición y la siguiente.</summary>
        private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(15);

        /// <summary>Ventana para medir qué se toca a menudo. Un trimestre.</summary>
        private const int HotspotDays = 90;

        /// <summary>
        /// Por debajo de esto el cuadrante no dice nada: con dos o tres puntos no hay
        /// "los que más cambian", hay "los únicos que cambiaron". Cuando pasa, se mira
        /// todo el historial en vez de la ventana corta — es lo que ocurre en repos
        /// donde se commitea a rachas.
        /// </summary>
        private const int MinHotspotsForWindow = 8;

        private static readonly HashSet<string> CodeExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".cs", ".ts", ".tsx", ".js", ".jsx", ".py", ".sh", ".sql",
            ".css", ".scss", ".html", ".razor", ".cshtml", ".yml", ".yaml",
        };

        /// <summary>
        /// Nadie los ha escrito y suman decenas de miles de líneas: package-lock.json
        /// solo, aquí, son 7.500. Contarlos falsea cualquier comparación.
        /// </summary>
        private static readonly HashSet<string> Lockfiles = new(StringComparer.OrdinalIgnoreCase)
        {
            "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock", "Cargo.lock",
        };

        private static readonly string[] DebtTags = { "TODO", "FIXME", "HACK", "XXX" };

        public ProjectAnalysisService(
            IMemoryCache cache,
            ILogger<ProjectAnalysisService> logger,
            string projectRoot)
        {
            _cache = cache;
            _logger = logger;
            _root = projectRoot;
        }

        public record ExtensionStat(string Extension, int Files, int Lines, double Percent);
        public record FileStat(string Path, int Lines);
        public record Hotspot(string Path, int Lines, int Changes);
        public record MonthlyGrowth(string Month, int Added, int Removed, int Total);
        public record DebtStat(string Tag, int Mentions, int Files);
        public record FolderStat(string Path, int Files, int Lines);

        public record GitInfo(string Branch, int Commits, string? LastCommit, int DirtyFiles);

        public record AnalysisResult(
            DateTimeOffset GeneratedAt,
            long ElapsedMs,
            string Root,
            bool IsGitRepo,
            int TrackedFiles,
            int CodeFiles,
            int TotalLines,
            int UntrackedFiles,
            List<ExtensionStat> ByExtension,
            List<FileStat> LargestFiles,
            List<Hotspot> Hotspots,
            /// <summary>Qué periodo se midió: la ventana corta o todo el historial.</summary>
            string HotspotWindow,
            List<MonthlyGrowth> Growth,
            List<DebtStat> Debt,
            List<FolderStat> Folders,
            GitInfo? Git);

        public async Task<AnalysisResult> GetAsync(bool refresh = false)
        {
            if (!refresh && _cache.TryGetValue<AnalysisResult>(CacheKey, out var cached) && cached != null)
                return cached;

            var result = await Task.Run(Analyze);
            _cache.Set(CacheKey, result, CacheFor);
            return result;
        }

        private AnalysisResult Analyze()
        {
            var sw = Stopwatch.StartNew();

            var isRepo = RunGit("rev-parse --is-inside-work-tree").Trim() == "true";
            var tracked = isRepo
                ? RunGit("ls-files").Split('\n', StringSplitOptions.RemoveEmptyEntries)
                : Array.Empty<string>();

            var codePaths = tracked
                .Where(p => CodeExtensions.Contains(Path.GetExtension(p)))
                .Where(p => !Lockfiles.Contains(Path.GetFileName(p)))
                .ToList();

            // Una sola lectura por archivo: contar líneas y buscar marcas de deuda a la
            // vez. Leerlos dos veces sería el doble de E/S por la misma información.
            var lines = new Dictionary<string, int>(codePaths.Count);
            var debtMentions = DebtTags.ToDictionary(t => t, _ => 0);
            var debtFiles = DebtTags.ToDictionary(t => t, _ => 0);

            foreach (var rel in codePaths)
            {
                var full = Path.Combine(_root, rel);
                if (!File.Exists(full)) continue;

                var count = 0;
                var seenHere = new HashSet<string>();

                try
                {
                    foreach (var line in File.ReadLines(full))
                    {
                        count++;
                        foreach (var tag in DebtTags)
                        {
                            if (line.Contains(tag, StringComparison.Ordinal))
                            {
                                debtMentions[tag]++;
                                seenHere.Add(tag);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    // Un archivo ilegible no puede tumbar el informe entero
                    _logger.LogDebug(ex, "[ProjectAnalysis] No se pudo leer {Path}", rel);
                    continue;
                }

                lines[rel] = count;
                foreach (var tag in seenHere) debtFiles[tag]++;
            }

            var totalLines = lines.Values.Sum();

            var byExtension = lines
                .GroupBy(kv => Path.GetExtension(kv.Key).ToLowerInvariant())
                .Select(g => new ExtensionStat(
                    g.Key,
                    g.Count(),
                    g.Sum(kv => kv.Value),
                    totalLines > 0 ? Math.Round(g.Sum(kv => kv.Value) * 100.0 / totalLines, 1) : 0))
                .OrderByDescending(e => e.Lines)
                .ToList();

            var largest = lines
                .OrderByDescending(kv => kv.Value)
                .Take(20)
                .Select(kv => new FileStat(kv.Key, kv.Value))
                .ToList();

            var folders = lines
                .GroupBy(kv => Path.GetDirectoryName(kv.Key)?.Replace('\\', '/') ?? "/")
                .Select(g => new FolderStat(g.Key, g.Count(), g.Sum(kv => kv.Value)))
                .OrderByDescending(f => f.Lines)
                .Take(15)
                .ToList();

            var (hotspots, hotspotWindow) = isRepo
                ? BuildHotspots(lines)
                : (new List<Hotspot>(), "");

            var growth = isRepo ? BuildGrowth() : new List<MonthlyGrowth>();

            GitInfo? git = null;
            int untracked = 0;

            if (isRepo)
            {
                untracked = RunGit("ls-files --others --exclude-standard")
                    .Split('\n', StringSplitOptions.RemoveEmptyEntries).Length;

                git = new GitInfo(
                    Branch: RunGit("rev-parse --abbrev-ref HEAD").Trim(),
                    Commits: int.TryParse(RunGit("rev-list --count HEAD").Trim(), out var c) ? c : 0,
                    LastCommit: RunGit("log -1 --pretty=format:%s").Trim(),
                    DirtyFiles: RunGit("status --porcelain")
                        .Split('\n', StringSplitOptions.RemoveEmptyEntries).Length);
            }

            sw.Stop();

            return new AnalysisResult(
                GeneratedAt: DateTimeOffset.UtcNow,
                ElapsedMs: sw.ElapsedMilliseconds,
                Root: _root,
                IsGitRepo: isRepo,
                TrackedFiles: tracked.Length,
                CodeFiles: lines.Count,
                TotalLines: totalLines,
                UntrackedFiles: untracked,
                ByExtension: byExtension,
                LargestFiles: largest,
                Hotspots: hotspots,
                HotspotWindow: hotspotWindow,
                Growth: growth,
                Debt: DebtTags.Select(t => new DebtStat(t, debtMentions[t], debtFiles[t])).ToList(),
                Folders: folders,
                Git: git);
        }

        /// <summary>
        /// Archivos grandes que además se tocan mucho. Es donde viven los bugs: uno
        /// grande que nadie toca es deuda dormida y puede esperar; uno grande que cambia
        /// cada semana te va a morder. El `cheer` que tumbó el chat estaba justo ahí.
        /// </summary>
        private (List<Hotspot> Items, string Window) BuildHotspots(Dictionary<string, int> lines)
        {
            var recent = ChangeCounts(lines, $"--since=\"{HotspotDays} days ago\"");

            // Si en la ventana corta apenas hubo actividad, se mira todo el historial:
            // más vale un cuadrante de siempre que uno vacío.
            var useAll = recent.Count < MinHotspotsForWindow;
            var counts = useAll ? ChangeCounts(lines, "") : recent;
            var window = useAll ? "todo el historial" : $"últimos {HotspotDays} días";

            var items = counts
                .Select(kv => new Hotspot(kv.Key, lines[kv.Key], kv.Value))
                // Riesgo ≈ tamaño × veces tocado. No es ciencia, pero ordena bien:
                // separa el archivo enorme que nadie mira del que se toca a diario.
                .OrderByDescending(h => (long)h.Lines * h.Changes)
                .Take(40)
                .ToList();

            return (items, window);
        }

        /// <summary>Cuántas veces aparece cada archivo de código en el log dado.</summary>
        private Dictionary<string, int> ChangeCounts(Dictionary<string, int> lines, string range)
        {
            var log = RunGit($"log {range} --name-only --pretty=format:".Trim());

            return log
                .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Select(p => p.Trim())
                .Where(p => p.Length > 0 && lines.ContainsKey(p))
                .GroupBy(p => p)
                .ToDictionary(g => g.Key, g => g.Count());
        }

        /// <summary>
        /// Crecimiento por mes, de `--numstat`. Sale gratis del historial y no hace falta
        /// guardar fotos propias: git ya sabe cuántas líneas entraron y salieron.
        /// </summary>
        private List<MonthlyGrowth> BuildGrowth()
        {
            var log = RunGit("log --numstat --date=short --pretty=format:@%ad --reverse");

            var months = new Dictionary<string, (int Added, int Removed)>();
            var order = new List<string>();
            string? current = null;

            foreach (var raw in log.Split('\n'))
            {
                var line = raw.TrimEnd('\r');

                if (line.StartsWith('@'))
                {
                    // Fecha del commit en formato corto: los primeros 7 caracteres son
                    // el año y el mes, que es la granularidad que interesa aquí
                    var date = line[1..].Trim();
                    if (date.Length >= 7)
                    {
                        current = date[..7];
                        if (!months.ContainsKey(current))
                        {
                            months[current] = (0, 0);
                            order.Add(current);
                        }
                    }
                    continue;
                }

                if (current == null || line.Length == 0) continue;

                var parts = line.Split('\t');
                if (parts.Length < 3) continue;

                // Los binarios traen "-" en vez de un número: no cuentan como líneas
                if (!int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var added)) continue;
                if (!int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var removed)) continue;

                var path = parts[2];
                if (!CodeExtensions.Contains(Path.GetExtension(path))) continue;
                if (Lockfiles.Contains(Path.GetFileName(path))) continue;

                var acc = months[current];
                months[current] = (acc.Added + added, acc.Removed + removed);
            }

            var result = new List<MonthlyGrowth>();
            var running = 0;

            foreach (var month in order)
            {
                var (added, removed) = months[month];
                running += added - removed;
                result.Add(new MonthlyGrowth(month, added, removed, Math.Max(0, running)));
            }

            // Un año es lo que cabe en un gráfico sin que las etiquetas se pisen
            return result.Count > 12 ? result.TakeLast(12).ToList() : result;
        }

        private string RunGit(string arguments)
        {
            try
            {
                using var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "git",
                        Arguments = arguments,
                        WorkingDirectory = _root,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                    }
                };

                process.Start();
                var output = process.StandardOutput.ReadToEnd();
                process.StandardError.ReadToEnd();

                if (!process.WaitForExit(30000))
                {
                    try { process.Kill(true); } catch { }
                    return "";
                }

                return output;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[ProjectAnalysis] Falló `git {Arguments}`", arguments);
                return "";
            }
        }
    }
}
