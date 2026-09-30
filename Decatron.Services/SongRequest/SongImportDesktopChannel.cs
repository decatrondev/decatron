using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.SongRequest;
using Decatron.Data;
using Decatron.Services.Desktop;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    /// <summary>Cómo terminó cada canción de una importación.</summary>
    public enum ImportItemState { Pending, Added, Duplicate, NotFound, Rejected }

    /// <summary>Una importación en curso o terminada (en memoria: si el backend reinicia se vuelve a importar y lo repetido se salta).</summary>
    public sealed class SongImportJob
    {
        public string Id { get; init; } = "";
        /// <summary>El dueño de la cola (y de la playlist).</summary>
        public long UserId { get; init; }
        /// <summary>La cuenta con la que está vinculada la app (con Twitch y Kick vinculados puede ser otra fila).</summary>
        public long DesktopUserId { get; init; }
        public long PlaylistId { get; init; }
        public string PlaylistName { get; init; } = "";
        public string Service { get; init; } = "";
        public string? SourceName { get; init; }
        public List<ExternalTrack> Tracks { get; init; } = new();
        public ImportItemState[] States { get; init; } = Array.Empty<ImportItemState>();
        public string?[] Reasons { get; init; } = Array.Empty<string?>();
        /// <summary>matching | done | canceled | desktop_lost</summary>
        public string State { get; set; } = "matching";
        public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public DesktopConnection? Connection { get; set; }
        public readonly SemaphoreSlim Lock = new(1, 1);

        public int Count(ImportItemState s) => States.Count(x => x == s);
    }

    /// <summary>
    /// Canal <c>songimport</c> de Decatron Desktop (.dev/plans/SONG_REQUEST_PLAYLISTS_PLAN.md, fase 6). El server lee
    /// la playlist de Spotify/Deezer/Apple Music (no toca a YouTube) y le pide a la app que busque cada canción en
    /// YouTube con la IP del streamer, con el mismo criterio que el server (duración, audio oficial, sin covers).
    /// Cada resultado se revisa (existe y se puede embeber, vetos, duplicado, tope del plan) y se guarda al llegar.
    /// </summary>
    public sealed class SongImportDesktopChannel : IDesktopChannel
    {
        public const string ChannelName = "songimport";

        private static readonly Regex VideoId = new("^[A-Za-z0-9_-]{11}$", RegexOptions.Compiled);

        private readonly ConcurrentDictionary<long, ConcurrentDictionary<DesktopConnection, DateTime>> _ready = new();
        private readonly ConcurrentDictionary<long, SongImportJob> _jobs = new();
        private readonly IServiceScopeFactory _scopes;
        private readonly IHttpClientFactory _http;
        private readonly ILogger<SongImportDesktopChannel> _logger;

        public SongImportDesktopChannel(IServiceScopeFactory scopes, IHttpClientFactory http, ILogger<SongImportDesktopChannel> logger)
        {
            _scopes = scopes;
            _http = http;
            _logger = logger;
        }

        public string Name => ChannelName;
        public byte? BinaryChannelId => null;

        public Task<object?> DescribeAsync(DesktopConnection conn) => Task.FromResult<object?>(new { available = true });

        public async Task OnMessageAsync(DesktopConnection conn, string type, JsonNode msg)
        {
            switch (type)
            {
                case "ready":
                    // Solo las versiones de la app que traen el buscador lo anuncian
                    _ready.GetOrAdd(conn.UserId, _ => new())[conn] = DateTime.UtcNow;
                    break;
                case "matched":
                    await OnMatchedAsync(conn, msg);
                    break;
                case "done":
                    if (_jobs.TryGetValue(conn.UserId, out var job) && job.Id == msg["jobId"]?.GetValue<string>() && job.State == "matching")
                    {
                        job.State = msg["canceled"]?.GetValue<bool>() == true ? "canceled" : "done";
                        job.UpdatedAt = DateTime.UtcNow;
                    }
                    break;
            }
        }

        public Task OnBinaryAsync(DesktopConnection conn, ReadOnlyMemory<byte> payload) => Task.CompletedTask;

        public Task OnDisconnectedAsync(DesktopConnection conn)
        {
            if (_ready.TryGetValue(conn.UserId, out var conns))
                conns.TryRemove(conn, out _);
            // Se cerró la app a la mitad: lo guardado queda y se puede retomar
            if (_jobs.TryGetValue(conn.UserId, out var job) && job.Connection == conn && job.State == "matching")
            {
                job.State = "desktop_lost";
                job.UpdatedAt = DateTime.UtcNow;
            }
            return Task.CompletedTask;
        }

        /// <summary>La app del canal que sabe buscar: la que lo anunció más recientemente y sigue conectada.</summary>
        private DesktopConnection? Target(long userId) =>
            _ready.TryGetValue(userId, out var conns)
                ? conns.Where(c => !c.Key.Token.IsCancellationRequested).OrderByDescending(c => c.Value).Select(c => c.Key).FirstOrDefault()
                : null;

        public bool IsReady(long userId) => Target(userId) != null;

        public SongImportJob? GetJob(long userId) => _jobs.TryGetValue(userId, out var j) ? j : null;

        /// <returns>El trabajo, o la clave del error (desktop_missing, import_running, playlist_full, las del lector).</returns>
        public async Task<(SongImportJob? Job, string? Error)> StartAsync(long desktopUserId, long userId, long playlistId, string url, CancellationToken ct = default)
        {
            var conn = Target(desktopUserId);
            if (conn == null)
                return (null, "desktop_missing");
            if (_jobs.TryGetValue(desktopUserId, out var running) && running.State == "matching")
                return (null, "import_running");

            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var library = scope.ServiceProvider.GetRequiredService<SongRequestLibraryService>();
            var playlist = await db.SongRequestPlaylists.AsNoTracking().FirstOrDefaultAsync(p => p.Id == playlistId && p.UserId == userId, ct);
            if (playlist == null)
                return (null, "not_found");
            var room = (await library.GetLimitsAsync(userId)).MaxItemsPerPlaylist - await db.SongRequestPlaylistItems.CountAsync(i => i.PlaylistId == playlistId, ct);
            if (room <= 0)
                return (null, "playlist_full");

            var read = await scope.ServiceProvider.GetRequiredService<ExternalPlaylistReader>().ReadAsync(url, ct);
            if (read.Error != null)
                return (null, read.Error);

            var job = new SongImportJob
            {
                Id = Guid.NewGuid().ToString("N")[..16],
                UserId = userId,
                DesktopUserId = desktopUserId,
                PlaylistId = playlistId,
                PlaylistName = playlist.Name,
                Service = read.Service,
                SourceName = read.Name,
                Tracks = read.Tracks,
                States = new ImportItemState[read.Tracks.Count],
                Reasons = new string?[read.Tracks.Count],
                Connection = conn
            };
            _jobs[desktopUserId] = job;
            await SendPendingAsync(job, conn);
            return (job, null);
        }

        /// <summary>Se cerró la app a la mitad: se le vuelven a mandar solo las que faltan.</summary>
        public async Task<string?> ResumeAsync(long userId)
        {
            if (!_jobs.TryGetValue(userId, out var job) || job.State is "matching" or "done")
                return "not_found";
            var conn = Target(userId);
            if (conn == null)
                return "desktop_missing";
            job.Connection = conn;
            job.State = "matching";
            job.UpdatedAt = DateTime.UtcNow;
            await SendPendingAsync(job, conn);
            return null;
        }

        public async Task<bool> CancelAsync(long userId)
        {
            if (!_jobs.TryGetValue(userId, out var job) || job.State != "matching")
                return false;
            job.State = "canceled";
            job.UpdatedAt = DateTime.UtcNow;
            if (job.Connection != null && !job.Connection.Token.IsCancellationRequested)
                await job.Connection.SendAsync(ChannelName, "cancel", new { jobId = job.Id });
            return true;
        }

        private static Task SendPendingAsync(SongImportJob job, DesktopConnection conn)
        {
            var items = job.Tracks.Select((t, i) => (t, i))
                .Where(x => job.States[x.i] == ImportItemState.Pending)
                .Select(x => new { i = x.i, title = x.t.Title, artist = x.t.Artist, duration = x.t.DurationSeconds })
                .ToList();
            return conn.SendAsync(ChannelName, "match", new { jobId = job.Id, items });
        }

        private async Task OnMatchedAsync(DesktopConnection conn, JsonNode msg)
        {
            if (!_jobs.TryGetValue(conn.UserId, out var job) || job.Id != msg["jobId"]?.GetValue<string>() || job.State != "matching")
                return;
            var i = msg["i"]?.GetValue<int>() ?? -1;
            if (i < 0 || i >= job.Tracks.Count || job.States[i] != ImportItemState.Pending)
                return;

            await job.Lock.WaitAsync();
            try
            {
                var (state, reason) = await SaveAsync(job, msg);
                job.States[i] = state;
                job.Reasons[i] = reason;
                job.UpdatedAt = DateTime.UtcNow;
                if (job.States.All(s => s != ImportItemState.Pending))
                    job.State = "done";
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SongRequest] No se pudo guardar la canción {I} de la importación {Job}", i, job.Id);
                job.States[i] = ImportItemState.Rejected;
                job.Reasons[i] = "failed";
            }
            finally { job.Lock.Release(); }
        }

        private async Task<(ImportItemState, string?)> SaveAsync(SongImportJob job, JsonNode msg)
        {
            static string? S(JsonNode m, string k) => m[k] is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;
            var videoId = S(msg, "videoId");
            if (msg["ok"]?.GetValue<bool>() != true || videoId == null || !VideoId.IsMatch(videoId))
                return (ImportItemState.NotFound, S(msg, "error") ?? "no_match");

            // Que exista y se pueda poner en el overlay (oEmbed no lo bloquea YouTube)
            var embed = await CheckEmbeddableAsync(videoId);
            if (embed != null)
                return (ImportItemState.Rejected, embed);

            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
            var songs = scope.ServiceProvider.GetRequiredService<SongRequestService>();
            var resolver = scope.ServiceProvider.GetRequiredService<SongResolverService>();
            var library = scope.ServiceProvider.GetRequiredService<SongRequestLibraryService>();

            var channelId = S(msg, "channelId");
            if (await songs.IsBannedAsync(job.UserId, "track", $"youtube:{videoId}", default))
                return (ImportItemState.Rejected, "banned_track");
            if (channelId != null && await songs.IsBannedAsync(job.UserId, "author", $"youtube:{channelId}", default))
                return (ImportItemState.Rejected, "banned_author");

            var title = S(msg, "title") ?? job.Tracks[msg["i"]!.GetValue<int>()].Title;
            var channel = S(msg, "channel") ?? "";
            if (channel.EndsWith(" - Topic", StringComparison.OrdinalIgnoreCase))
                channel = channel[..^" - Topic".Length];
            var track = new SongTrack
            {
                Source = "youtube",
                SourceId = videoId,
                Title = title.Length <= 300 ? title : title[..300],
                Artist = channel.Length <= 200 ? channel : channel[..200],
                AuthorId = channelId,
                DurationSeconds = msg["duration"] is JsonValue d && d.TryGetValue<double>(out var secs) && secs > 0 ? (int)Math.Round(secs) : null,
                ThumbnailUrl = $"https://i.ytimg.com/vi/{videoId}/hqdefault.jpg",
                IsEmbeddable = true
            };
            var saved = (await resolver.UpsertTracksAsync(new[] { track })).First();

            if (await db.SongRequestPlaylistItems.AnyAsync(x => x.PlaylistId == job.PlaylistId && x.TrackId == saved.Id))
                return (ImportItemState.Duplicate, null);
            var max = (await library.GetLimitsAsync(job.UserId)).MaxItemsPerPlaylist;
            if (await db.SongRequestPlaylistItems.CountAsync(x => x.PlaylistId == job.PlaylistId) >= max)
                return (ImportItemState.Rejected, "playlist_full");
            if (!await db.SongRequestPlaylists.AnyAsync(p => p.Id == job.PlaylistId))
                return (ImportItemState.Rejected, "not_found");

            var last = await db.SongRequestPlaylistItems.Where(x => x.PlaylistId == job.PlaylistId).MaxAsync(x => (int?)x.Position) ?? 0;
            db.SongRequestPlaylistItems.Add(new SongRequestPlaylistItem
            {
                PlaylistId = job.PlaylistId, UserId = job.UserId, TrackId = saved.Id, Position = last + 1, CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            return (ImportItemState.Added, null);
        }

        /// <summary>null si se puede embeber (o si oEmbed no contestó: el reproductor igual salta lo que no suene).</summary>
        private async Task<string?> CheckEmbeddableAsync(string videoId)
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
                var url = "https://www.youtube.com/oembed?format=json&url=" + Uri.EscapeDataString($"https://www.youtube.com/watch?v={videoId}");
                using var response = await _http.CreateClient().GetAsync(url, cts.Token);
                return response.StatusCode switch
                {
                    HttpStatusCode.NotFound or HttpStatusCode.BadRequest => "not_found",
                    HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => "not_embeddable",
                    _ => null
                };
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                return null;
            }
        }
    }
}
