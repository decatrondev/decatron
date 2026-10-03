using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.SongRequest;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    /// <summary>
    /// Estadísticas anónimas de quien escucha las playlists en /sr/{canal}/p/{código}
    /// (.dev/plans/SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 4).
    /// Cada navegador tiene un id aleatorio propio: no se guarda IP, cuenta ni nada que identifique a la persona.
    /// No hay eventos crudos: cada evento suma directo a los totales por día (UTC) en <c>song_request_listen_*</c>.
    /// "Escuchando ahora" y los frenos viven solo en memoria.
    /// </summary>
    public sealed class SongListenStatsService
    {
        public const string Beat = "beat";
        public const string Stop = "stop";
        public const string Listen = "listen";
        public const string Unplayable = "unplayable";

        /// <summary>Una señal por navegador y playlist cada tanto como mínimo: el cliente manda cada 30 s.</summary>
        private static readonly TimeSpan MinBeatGap = TimeSpan.FromSeconds(20);
        /// <summary>Sin señal en este tiempo, deja de contar como "escuchando ahora".</summary>
        private static readonly TimeSpan PresenceWindow = TimeSpan.FromSeconds(90);
        /// <summary>Navegadores nuevos por IP y hora (solo en memoria): evita inflar los oyentes únicos con ids inventados.</summary>
        private const int MaxNewVisitorsPerIpPerHour = 40;
        /// <summary>Lo más que puede sumar una sola señal.</summary>
        private const int MaxSecondsPerBeat = 70;

        private static readonly Regex VisitorRegex = new(@"^[0-9a-fA-F-]{8,36}$", RegexOptions.Compiled);

        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<SongListenStatsService> _logger;

        private readonly ConcurrentDictionary<long, ConcurrentDictionary<string, DateTime>> _presence = new();
        private readonly ConcurrentDictionary<string, DateTime> _lastEvent = new();
        private readonly ConcurrentDictionary<string, byte> _seenToday = new();
        private readonly ConcurrentDictionary<string, (DateTime Start, int Count)> _newByIp = new();

        public SongListenStatsService(IServiceScopeFactory scopes, ILogger<SongListenStatsService> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        public static bool IsValidEvent(string? kind) => kind is Beat or Stop or Listen or Unplayable;

        // ── Escritura ────────────────────────────────────────────────────────

        /// <summary>
        /// Registra un evento de un oyente. Todo lo dudoso se descarta en silencio: no se le avisa al cliente para no
        /// darle pistas de cómo inflar números.
        /// </summary>
        public async Task RecordAsync(long playlistId, string visitorId, string kind, long? trackId, int seconds, string ipKey, CancellationToken ct = default)
        {
            if (!VisitorRegex.IsMatch(visitorId ?? "") || !IsValidEvent(kind))
                return;
            visitorId = visitorId!.ToLowerInvariant();

            var now = DateTime.UtcNow;
            var day = DateOnly.FromDateTime(now);
            var seenKey = $"{day:yyyyMMdd}|{playlistId}|{visitorId}";
            var firstToday = !_seenToday.ContainsKey(seenKey);
            if (firstToday && !AllowNewVisitor(ipKey, now))
                return;

            var visitorKey = $"{playlistId}|{visitorId}";
            try
            {
                switch (kind)
                {
                    case Beat:
                    case Stop:
                    {
                        // El cierre (pausa o salir de la página) siempre cuenta; las señales normales, con un intervalo mínimo
                        var beatKey = $"beat|{visitorKey}";
                        var previous = _lastEvent.TryGetValue(beatKey, out var last) ? (DateTime?)last : null;
                        var presence = _presence.GetOrAdd(playlistId, _ => new());
                        // Tras una pausa o un cambio de canción la señal que vuelve a empezar pasa aunque sea pronto
                        if (kind == Beat && previous != null && now - previous.Value < MinBeatGap && presence.ContainsKey(visitorId))
                            return;
                        _lastEvent[beatKey] = now;

                        if (kind == Stop) presence.TryRemove(visitorId, out _);
                        else presence[visitorId] = now;

                        // Nadie suma más tiempo del que pasó desde su señal anterior
                        var credit = Math.Clamp(seconds, 0, MaxSecondsPerBeat);
                        if (previous != null)
                            credit = Math.Min(credit, (int)(now - previous.Value).TotalSeconds + 3);
                        await AddVisitorAsync(playlistId, day, visitorId, seenKey, ct);
                        if (credit > 0)
                            await AddDailyAsync(playlistId, day, listens: 0, seconds: credit, webRequests: 0, ct);
                        break;
                    }
                    case Listen:
                    {
                        if (trackId == null || !await InPlaylistAsync(playlistId, trackId.Value, ct))
                            return;
                        var key = $"listen|{visitorKey}|{trackId}";
                        if (_lastEvent.TryGetValue(key, out var lastListen) && now - lastListen < MinBeatGap)
                            return;
                        _lastEvent[key] = now;
                        await AddVisitorAsync(playlistId, day, visitorId, seenKey, ct);
                        await AddDailyAsync(playlistId, day, listens: 1, seconds: 0, webRequests: 0, ct);
                        await WithDbAsync(db => db.Database.ExecuteSqlInterpolatedAsync($@"
                            INSERT INTO song_request_listen_tracks (playlist_id, track_id, day, listens) VALUES ({playlistId}, {trackId.Value}, {day}, 1)
                            ON CONFLICT (playlist_id, track_id, day) DO UPDATE SET listens = song_request_listen_tracks.listens + 1", ct));
                        break;
                    }
                    case Unplayable:
                    {
                        if (trackId == null || !await InPlaylistAsync(playlistId, trackId.Value, ct))
                            return;
                        // Un mismo navegador avisa una vez por canción y día
                        if (!_seenToday.TryAdd($"{day:yyyyMMdd}|unp|{visitorKey}|{trackId}", 0))
                            return;
                        await WithDbAsync(db => db.Database.ExecuteSqlInterpolatedAsync($@"
                            INSERT INTO song_request_listen_unplayable (playlist_id, track_id) VALUES ({playlistId}, {trackId.Value})
                            ON CONFLICT (playlist_id, track_id) DO UPDATE SET reports = song_request_listen_unplayable.reports + 1, last_reported = NOW()", ct));
                        break;
                    }
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Una estadística que falla no puede afectar a quien escucha
                _logger.LogWarning(ex, "[SongRequest] No se pudo registrar un evento de escucha de la playlist {PlaylistId}", playlistId);
            }
        }

        /// <summary>Un "Pedir al stream" desde la web que se aceptó (lo cuenta el servidor, no el navegador).</summary>
        public async Task AddWebRequestAsync(long playlistId, CancellationToken ct = default)
        {
            try { await AddDailyAsync(playlistId, DateOnly.FromDateTime(DateTime.UtcNow), 0, 0, 1, ct); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "[SongRequest] No se pudo contar el pedido desde la web de la playlist {PlaylistId}", playlistId);
            }
        }

        private bool AllowNewVisitor(string ipKey, DateTime now)
        {
            var entry = _newByIp.AddOrUpdate(ipKey, _ => (now, 1),
                (_, cur) => now - cur.Start > TimeSpan.FromHours(1) ? (now, 1) : (cur.Start, cur.Count + 1));
            return entry.Count <= MaxNewVisitorsPerIpPerHour;
        }

        private Task AddVisitorAsync(long playlistId, DateOnly day, string visitorId, string seenKey, CancellationToken ct)
        {
            if (!_seenToday.TryAdd(seenKey, 0))
                return Task.CompletedTask;
            return WithDbAsync(db => db.Database.ExecuteSqlInterpolatedAsync($@"
                INSERT INTO song_request_listen_visitors (playlist_id, day, visitor_id) VALUES ({playlistId}, {day}, {visitorId})
                ON CONFLICT DO NOTHING", ct));
        }

        private Task AddDailyAsync(long playlistId, DateOnly day, int listens, int seconds, int webRequests, CancellationToken ct) =>
            WithDbAsync(db => db.Database.ExecuteSqlInterpolatedAsync($@"
                INSERT INTO song_request_listen_daily (playlist_id, day, listens, seconds, web_requests) VALUES ({playlistId}, {day}, {listens}, {(long)seconds}, {webRequests})
                ON CONFLICT (playlist_id, day) DO UPDATE SET
                    listens = song_request_listen_daily.listens + EXCLUDED.listens,
                    seconds = song_request_listen_daily.seconds + EXCLUDED.seconds,
                    web_requests = song_request_listen_daily.web_requests + EXCLUDED.web_requests", ct));

        private async Task WithDbAsync(Func<DecatronDbContext, Task> action)
        {
            using var scope = _scopes.CreateScope();
            await action(scope.ServiceProvider.GetRequiredService<DecatronDbContext>());
        }

        private async Task<bool> InPlaylistAsync(long playlistId, long trackId, CancellationToken ct)
        {
            using var scope = _scopes.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<DecatronDbContext>().SongRequestPlaylistItems.AsNoTracking()
                .AnyAsync(i => i.PlaylistId == playlistId && i.TrackId == trackId, ct);
        }

        // ── Presencia y limpieza ─────────────────────────────────────────────

        /// <summary>Cuántas personas escuchan esta playlist ahora (señal en los últimos 90 s).</summary>
        public int ListeningNow(long playlistId)
        {
            if (!_presence.TryGetValue(playlistId, out var visitors))
                return 0;
            var since = DateTime.UtcNow - PresenceWindow;
            return visitors.Count(v => v.Value >= since);
        }

        /// <summary>Borra de memoria lo vencido (presencia, frenos y marcas del día).</summary>
        public void PurgeMemory()
        {
            var now = DateTime.UtcNow;
            foreach (var (playlistId, visitors) in _presence)
            {
                foreach (var v in visitors.Where(v => now - v.Value > PresenceWindow).ToList())
                    visitors.TryRemove(v.Key, out _);
                if (visitors.IsEmpty)
                    _presence.TryRemove(playlistId, out _);
            }
            foreach (var e in _lastEvent.Where(e => now - e.Value > TimeSpan.FromMinutes(5)).ToList())
                _lastEvent.TryRemove(e.Key, out _);
            foreach (var e in _newByIp.Where(e => now - e.Value.Start > TimeSpan.FromHours(1)).ToList())
                _newByIp.TryRemove(e.Key, out _);
            // Las marcas del día solo sirven hoy
            var today = $"{DateOnly.FromDateTime(now):yyyyMMdd}|";
            foreach (var k in _seenToday.Keys.Where(k => !k.StartsWith(today)).ToList())
                _seenToday.TryRemove(k, out _);
        }

        /// <summary>En la base, los oyentes de hace más de 100 días (los totales por día se conservan).</summary>
        public Task PurgeDatabaseAsync(CancellationToken ct = default)
        {
            var cutoff = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-100));
            return WithDbAsync(db => db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM song_request_listen_visitors WHERE day < {cutoff}", ct));
        }

        // ── Lectura (dashboard) ──────────────────────────────────────────────

        private sealed class DayRow { public DateOnly Day { get; set; } public int Listens { get; set; } public long Seconds { get; set; } public int WebRequests { get; set; } }
        private sealed class DayCount { public DateOnly Day { get; set; } public int Count { get; set; } }
        private sealed class PlaylistRow { public long PlaylistId { get; set; } public int Listens { get; set; } public long Seconds { get; set; } public int WebRequests { get; set; } }
        private sealed class PlaylistCount { public long PlaylistId { get; set; } public int Count { get; set; } }
        private sealed class TrackRow { public long TrackId { get; set; } public int Listens { get; set; } }
        private sealed class UnplayableRow { public long PlaylistId { get; set; } public long TrackId { get; set; } public int Reports { get; set; } public DateTime LastReported { get; set; } }
        private sealed class TotalRow { public int Count { get; set; } }

        public async Task<object> GetStatsAsync(DecatronDbContext db, long userId, int days, long? playlistId, CancellationToken ct = default)
        {
            days = Math.Clamp(days, 1, 90);
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var since = today.AddDays(-(days - 1));
            var sinceUtc = since.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            long pl = playlistId ?? 0; // 0 = todas (los ids empiezan en 1)

            var playlists = await db.SongRequestPlaylists.AsNoTracking().Where(p => p.UserId == userId)
                .OrderBy(p => p.CreatedAt).ThenBy(p => p.Id).Select(p => new { p.Id, p.Name, p.Visibility }).ToListAsync(ct);
            if (playlistId != null && playlists.All(p => p.Id != playlistId))
                return new { found = false };

            var daily = await db.Database.SqlQuery<DayRow>($@"
                SELECT d.day AS ""Day"", SUM(d.listens)::int AS ""Listens"", SUM(d.seconds)::bigint AS ""Seconds"", SUM(d.web_requests)::int AS ""WebRequests""
                FROM song_request_listen_daily d JOIN song_request_playlists p ON p.id = d.playlist_id
                WHERE p.user_id = {userId} AND d.day >= {since} AND ({pl} = 0 OR d.playlist_id = {pl})
                GROUP BY d.day").ToListAsync(ct);
            var dailyUniques = await db.Database.SqlQuery<DayCount>($@"
                SELECT v.day AS ""Day"", COUNT(DISTINCT v.visitor_id)::int AS ""Count""
                FROM song_request_listen_visitors v JOIN song_request_playlists p ON p.id = v.playlist_id
                WHERE p.user_id = {userId} AND v.day >= {since} AND ({pl} = 0 OR v.playlist_id = {pl})
                GROUP BY v.day").ToListAsync(ct);
            var uniqueTotal = (await db.Database.SqlQuery<TotalRow>($@"
                SELECT COUNT(DISTINCT v.visitor_id)::int AS ""Count""
                FROM song_request_listen_visitors v JOIN song_request_playlists p ON p.id = v.playlist_id
                WHERE p.user_id = {userId} AND v.day >= {since} AND ({pl} = 0 OR v.playlist_id = {pl})").ToListAsync(ct)).FirstOrDefault()?.Count ?? 0;

            var perPlaylist = await db.Database.SqlQuery<PlaylistRow>($@"
                SELECT d.playlist_id AS ""PlaylistId"", SUM(d.listens)::int AS ""Listens"", SUM(d.seconds)::bigint AS ""Seconds"", SUM(d.web_requests)::int AS ""WebRequests""
                FROM song_request_listen_daily d JOIN song_request_playlists p ON p.id = d.playlist_id
                WHERE p.user_id = {userId} AND d.day >= {since}
                GROUP BY d.playlist_id").ToListAsync(ct);
            var perPlaylistUniques = await db.Database.SqlQuery<PlaylistCount>($@"
                SELECT v.playlist_id AS ""PlaylistId"", COUNT(DISTINCT v.visitor_id)::int AS ""Count""
                FROM song_request_listen_visitors v JOIN song_request_playlists p ON p.id = v.playlist_id
                WHERE p.user_id = {userId} AND v.day >= {since}
                GROUP BY v.playlist_id").ToListAsync(ct);

            var topTracks = await db.Database.SqlQuery<TrackRow>($@"
                SELECT t.track_id AS ""TrackId"", SUM(t.listens)::int AS ""Listens""
                FROM song_request_listen_tracks t JOIN song_request_playlists p ON p.id = t.playlist_id
                WHERE p.user_id = {userId} AND t.day >= {since} AND ({pl} = 0 OR t.playlist_id = {pl})
                GROUP BY t.track_id ORDER BY 2 DESC LIMIT 10").ToListAsync(ct);

            // Las que YouTube no deja reproducir afuera, mientras sigan en la playlist
            var unplayable = await db.Database.SqlQuery<UnplayableRow>($@"
                SELECT u.playlist_id AS ""PlaylistId"", u.track_id AS ""TrackId"", u.reports AS ""Reports"", u.last_reported AS ""LastReported""
                FROM song_request_listen_unplayable u
                JOIN song_request_playlists p ON p.id = u.playlist_id
                JOIN song_request_playlist_items i ON i.playlist_id = u.playlist_id AND i.track_id = u.track_id
                WHERE p.user_id = {userId} AND ({pl} = 0 OR u.playlist_id = {pl})
                ORDER BY u.reports DESC LIMIT 50").ToListAsync(ct);

            var trackIds = topTracks.Select(t => t.TrackId).Concat(unplayable.Select(u => u.TrackId)).Distinct().ToList();
            var tracks = await db.SongTracks.AsNoTracking().Where(t => trackIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id, ct);
            // Cuántas veces sonó en el stream (del historial), no solo en los navegadores
            var streamPlays = await db.SongRequestHistory.AsNoTracking()
                .Where(h => h.UserId == userId && h.PlayedAt >= sinceUtc && trackIds.Contains(h.TrackId))
                .GroupBy(h => h.TrackId).Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

            object? Track(long id)
            {
                if (!tracks.TryGetValue(id, out var t)) return null;
                return new { trackId = t.Id, title = t.Title, artist = t.Artist, thumbnailUrl = t.ThumbnailUrl, url = t.Source == "youtube" ? $"https://youtu.be/{t.SourceId}" : null };
            }

            var dayRows = daily.ToDictionary(d => d.Day);
            var dayUniques = dailyUniques.ToDictionary(d => d.Day, d => d.Count);
            var series = Enumerable.Range(0, days).Select(i => since.AddDays(i)).Select(d => new
            {
                day = d.ToString("yyyy-MM-dd"),
                listens = dayRows.TryGetValue(d, out var r) ? r.Listens : 0,
                seconds = dayRows.TryGetValue(d, out var r2) ? r2.Seconds : 0,
                listeners = dayUniques.GetValueOrDefault(d)
            }).ToList();

            var byPlaylist = perPlaylist.ToDictionary(p => p.PlaylistId);
            var uniquesByPlaylist = perPlaylistUniques.ToDictionary(p => p.PlaylistId, p => p.Count);
            return new
            {
                found = true,
                days,
                listeningNow = playlists.Where(p => playlistId == null || p.Id == playlistId).Sum(p => ListeningNow(p.Id)),
                totals = new
                {
                    listeners = uniqueTotal,
                    listens = daily.Sum(d => d.Listens),
                    seconds = daily.Sum(d => d.Seconds),
                    webRequests = daily.Sum(d => d.WebRequests)
                },
                series,
                playlists = playlists.Select(p => new
                {
                    id = p.Id,
                    name = p.Name,
                    visibility = p.Visibility,
                    listeningNow = ListeningNow(p.Id),
                    listeners = uniquesByPlaylist.GetValueOrDefault(p.Id),
                    listens = byPlaylist.TryGetValue(p.Id, out var pr) ? pr.Listens : 0,
                    seconds = byPlaylist.TryGetValue(p.Id, out var pr2) ? pr2.Seconds : 0,
                    webRequests = byPlaylist.TryGetValue(p.Id, out var pr3) ? pr3.WebRequests : 0
                }).ToList(),
                topTracks = topTracks.Select(t => new { track = Track(t.TrackId), listens = t.Listens, streamPlays = streamPlays.GetValueOrDefault(t.TrackId) }).Where(t => t.track != null).ToList(),
                unplayable = unplayable.Select(u => new
                {
                    playlistId = u.PlaylistId,
                    playlistName = playlists.FirstOrDefault(p => p.Id == u.PlaylistId)?.Name,
                    track = Track(u.TrackId),
                    reports = u.Reports,
                    lastReported = u.LastReported
                }).Where(u => u.track != null).ToList()
            };
        }
    }

    /// <summary>
    /// La caché de la vista previa al compartir (/sr/{canal}, /sr/{canal}/p/{código}). Cada entrada vence con el token:
    /// cualquier cambio de playlists (visibilidad, enlace nuevo, canciones, nombre) lo cancela y todo se vuelve a leer,
    /// así un enlace regenerado deja de mostrar el título al instante.
    /// </summary>
    public static class SongShareMetaCache
    {
        private static CancellationTokenSource _source = new();

        public static Microsoft.Extensions.Primitives.IChangeToken Token => new Microsoft.Extensions.Primitives.CancellationChangeToken(_source.Token);

        public static void Clear()
        {
            var old = Interlocked.Exchange(ref _source, new CancellationTokenSource());
            old.Cancel();
            old.Dispose();
        }
    }

    /// <summary>Limpia la memoria de las estadísticas y los oyentes viejos de la base, una vez al día.</summary>
    public sealed class SongListenStatsCleanupService : BackgroundService
    {
        private readonly SongListenStatsService _stats;
        private readonly ILogger<SongListenStatsCleanupService> _logger;

        public SongListenStatsCleanupService(SongListenStatsService stats, ILogger<SongListenStatsCleanupService> logger)
        {
            _stats = stats;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // La memoria se limpia seguido; la base, una vez al día
            var lastDb = DateTime.MinValue;
            while (!stoppingToken.IsCancellationRequested)
            {
                try { await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken); }
                catch (OperationCanceledException) { return; }
                try
                {
                    _stats.PurgeMemory();
                    if (DateTime.UtcNow - lastDb > TimeSpan.FromHours(24))
                    {
                        await _stats.PurgeDatabaseAsync(stoppingToken);
                        lastDb = DateTime.UtcNow;
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogWarning(ex, "[SongRequest] No se pudo limpiar las estadísticas de escucha");
                }
            }
        }
    }
}
