using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    public sealed record YtDlpResult(int ExitCode, string Stdout, string Stderr, bool TimedOut)
    {
        public bool Success => !TimedOut && ExitCode == 0;
    }

    /// <summary>
    /// Corre yt-dlp en el server, solo para leer datos (nunca descarga: eso lo hace el Desktop).
    /// Limita cuántos corren a la vez para que un raid de !sr no dispare decenas de procesos.
    /// </summary>
    public sealed class YtDlpRunner
    {
        private const int MaxConcurrent = 3;

        private readonly SemaphoreSlim _gate = new(MaxConcurrent, MaxConcurrent);
        private readonly string _command;
        private readonly ILogger<YtDlpRunner> _logger;

        public YtDlpRunner(IConfiguration configuration, ILogger<YtDlpRunner> logger)
        {
            _logger = logger;
            _command = configuration["SongRequest:YtDlpPath"] ?? "yt-dlp";
        }

        public async Task<YtDlpResult> RunAsync(IEnumerable<string> args, TimeSpan timeout, CancellationToken ct = default)
        {
            await _gate.WaitAsync(ct);
            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = _command,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                // ArgumentList: el texto del chat nunca pasa por un shell
                foreach (var arg in args)
                    startInfo.ArgumentList.Add(arg);

                using var process = new Process { StartInfo = startInfo };
                process.Start();

                var stdoutTask = process.StandardOutput.ReadToEndAsync();
                var stderrTask = process.StandardError.ReadToEndAsync();

                using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeoutCts.CancelAfter(timeout);
                var timedOut = false;
                try
                {
                    await process.WaitForExitAsync(timeoutCts.Token);
                }
                catch (OperationCanceledException)
                {
                    timedOut = !ct.IsCancellationRequested;
                    try { process.Kill(entireProcessTree: true); } catch { /* ya terminó */ }
                    if (!timedOut) throw;
                }

                var stdout = await stdoutTask;
                var stderr = await stderrTask;

                if (timedOut)
                    _logger.LogWarning("[SongRequest] yt-dlp tardó más de {Seconds}s y se cortó", timeout.TotalSeconds);

                return new YtDlpResult(timedOut ? -1 : process.ExitCode, stdout, stderr, timedOut);
            }
            finally
            {
                _gate.Release();
            }
        }
    }
}
