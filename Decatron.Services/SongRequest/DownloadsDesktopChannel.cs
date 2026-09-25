using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Services.Desktop;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    /// <summary>Lo último que contó la app del streamer sobre una descarga.</summary>
    public sealed record DesktopDownloadJob(string JobId, string Title, string Kind, string Format, string State,
        double? Percent, string? Speed, string? Eta, string? FileName, string? Error, DateTime CreatedAt, DateTime UpdatedAt);

    /// <summary>
    /// Canal <c>downloads</c> de Decatron Desktop (.dev/plans/SONG_REQUEST_PLAN.md, fase 5). Las descargas
    /// corren en la PC del streamer (su IP: YouTube no la bloquea como a la del server). El dashboard pide
    /// por la API y acá se reenvía a la app; la app contesta el análisis de un link y va avisando el progreso.
    /// Todo en memoria: si el backend reinicia, la app vuelve a contar todo al reconectar.
    /// </summary>
    public sealed class DownloadsDesktopChannel : IDesktopChannel
    {
        public const string ChannelName = "downloads";
        private const int MaxJobsPerUser = 30;

        private sealed class UserState
        {
            public readonly ConcurrentDictionary<DesktopConnection, DateTime> Connections = new();
            public readonly ConcurrentDictionary<string, DesktopDownloadJob> Jobs = new();
            public JsonNode? Status;
            public DesktopConnection? StatusFrom;
        }

        private readonly ConcurrentDictionary<long, UserState> _users = new();
        private readonly ConcurrentDictionary<string, TaskCompletionSource<JsonNode>> _probes = new();
        private readonly ILogger<DownloadsDesktopChannel> _logger;

        public DownloadsDesktopChannel(ILogger<DownloadsDesktopChannel> logger)
        {
            _logger = logger;
        }

        public string Name => ChannelName;
        public byte? BinaryChannelId => null;

        private UserState For(long userId) => _users.GetOrAdd(userId, _ => new UserState());

        public Task<object?> DescribeAsync(DesktopConnection conn)
        {
            // Se llama al conectar: así sabemos qué apps tiene abiertas cada canal
            For(conn.UserId).Connections[conn] = DateTime.UtcNow;
            return Task.FromResult<object?>(new { available = true });
        }

        public Task OnMessageAsync(DesktopConnection conn, string type, JsonNode msg)
        {
            var state = For(conn.UserId);
            state.Connections[conn] = DateTime.UtcNow;
            switch (type)
            {
                case "status":
                    state.Status = msg.DeepClone();
                    state.StatusFrom = conn;
                    break;
                case "probeResult":
                    var requestId = msg["requestId"]?.GetValue<string>();
                    if (requestId != null && _probes.TryRemove(requestId, out var tcs))
                        tcs.TrySetResult(msg.DeepClone());
                    break;
                case "progress":
                    ApplyProgress(state, msg);
                    break;
                case "cleared":
                    foreach (var (id, job) in state.Jobs)
                        if (job.State is "done" or "error" or "canceled")
                            state.Jobs.TryRemove(id, out _);
                    break;
            }
            return Task.CompletedTask;
        }

        private static void ApplyProgress(UserState state, JsonNode msg)
        {
            var jobId = msg["jobId"]?.GetValue<string>();
            if (string.IsNullOrEmpty(jobId) || jobId.Length > 64) return;
            static string? S(JsonNode m, string k) => m[k] is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;
            static double? D(JsonNode m, string k) => m[k] is JsonValue v && v.TryGetValue<double>(out var d) ? d : null;
            var now = DateTime.UtcNow;
            var existing = state.Jobs.TryGetValue(jobId, out var prev) ? prev : null;
            state.Jobs[jobId] = new DesktopDownloadJob(
                jobId,
                Trim(S(msg, "title") ?? existing?.Title ?? "", 200),
                S(msg, "kind") ?? existing?.Kind ?? "",
                S(msg, "format") ?? existing?.Format ?? "",
                S(msg, "state") ?? "queued",
                D(msg, "percent"), S(msg, "speed"), S(msg, "eta"),
                Trim(S(msg, "fileName"), 260), S(msg, "error"),
                existing?.CreatedAt ?? now, now);

            if (state.Jobs.Count > MaxJobsPerUser)
                foreach (var old in state.Jobs.Values.OrderBy(j => j.UpdatedAt).Take(state.Jobs.Count - MaxJobsPerUser))
                    state.Jobs.TryRemove(old.JobId, out _);
        }

        private static string Trim(string? s, int max) => s == null ? "" : s.Length <= max ? s : s[..max];

        public Task OnBinaryAsync(DesktopConnection conn, ReadOnlyMemory<byte> payload) => Task.CompletedTask;

        public Task OnDisconnectedAsync(DesktopConnection conn)
        {
            if (_users.TryGetValue(conn.UserId, out var state))
            {
                state.Connections.TryRemove(conn, out _);
                if (state.StatusFrom == conn) { state.Status = null; state.StatusFrom = null; }
            }
            return Task.CompletedTask;
        }

        // ── Para la API del dashboard ────────────────────────────────────────

        /// <summary>La app del canal a la que se le piden las descargas: la que habló más recientemente.</summary>
        private DesktopConnection? Target(long userId) =>
            _users.TryGetValue(userId, out var s)
                ? s.Connections.Where(c => !c.Key.Token.IsCancellationRequested).OrderByDescending(c => c.Value).Select(c => c.Key).FirstOrDefault()
                : null;

        public bool IsConnected(long userId) => Target(userId) != null;

        /// <summary>El estado que mandó la app, o null si la app es de una versión sin el módulo de descargas.</summary>
        public JsonNode? GetStatus(long userId) => _users.TryGetValue(userId, out var s) ? s.Status : null;

        public string? AppVersion(long userId) => Target(userId)?.Device.AppVersion;

        public IReadOnlyList<DesktopDownloadJob> GetJobs(long userId) =>
            _users.TryGetValue(userId, out var s) ? s.Jobs.Values.OrderByDescending(j => j.CreatedAt).ToList() : Array.Empty<DesktopDownloadJob>();

        /// <summary>Le pide a la app que analice un link. null si no hay app o no contestó a tiempo.</summary>
        public async Task<JsonNode?> ProbeAsync(long userId, string url, CancellationToken ct)
        {
            var conn = Target(userId);
            if (conn == null) return null;
            var requestId = Guid.NewGuid().ToString("N");
            var tcs = new TaskCompletionSource<JsonNode>(TaskCreationOptions.RunContinuationsAsynchronously);
            _probes[requestId] = tcs;
            try
            {
                await conn.SendAsync(ChannelName, "probe", new { requestId, url });
                // La primera vez la app puede estar bajando yt-dlp/ffmpeg (~100 MB): margen amplio
                return await tcs.Task.WaitAsync(TimeSpan.FromSeconds(120), ct);
            }
            catch (TimeoutException) { return null; }
            finally { _probes.TryRemove(requestId, out _); }
        }

        public async Task<string?> StartAsync(long userId, string title, object options)
        {
            var conn = Target(userId);
            if (conn == null) return null;
            var jobId = Guid.NewGuid().ToString("N")[..16];
            For(userId).Jobs[jobId] = new DesktopDownloadJob(jobId, Trim(title, 200), "", "", "queued", null, null, null, null, null, DateTime.UtcNow, DateTime.UtcNow);
            await conn.SendAsync(ChannelName, "start", new { jobId, title, options });
            return jobId;
        }

        public async Task<bool> SendAsync(long userId, string type, object payload)
        {
            var conn = Target(userId);
            if (conn == null) return false;
            await conn.SendAsync(ChannelName, type, payload);
            return true;
        }
    }
}
