using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.SongRequest
{
    /// <summary>Una canción de una playlist de otro servicio: lo que hace falta para buscarla en YouTube.</summary>
    public sealed record ExternalTrack(string Title, string Artist, int? DurationSeconds, string? Url);

    /// <summary>Lo que se leyó de la playlist. Error: invalid_link, not_a_playlist, not_found, failed.</summary>
    public sealed record ExternalPlaylist(string Service, string? Name, List<ExternalTrack> Tracks, string? Error);

    /// <summary>
    /// Lee playlists públicas de Spotify, Deezer y Apple Music sin cuenta (.dev/plans/SONG_REQUEST_PLAYLISTS_PLAN.md,
    /// fase 6). Esto corre en el server porque no toca a YouTube; buscar cada canción en YouTube lo hace
    /// Decatron Desktop con la IP del streamer. Límites verificados el 2026-09-30: Spotify entrega hasta 100
    /// canciones en su página pública; Deezer, la playlist completa (API pública); Apple Music, las de su página.
    /// </summary>
    public sealed class ExternalPlaylistReader
    {
        private const string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
        private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(20);
        public const int MaxTracks = 1000;

        private static readonly Regex SpotifyPlaylist = new(@"^/(?:intl-[a-z]{2}(?:-[A-Za-z]{2})?/)?(?:embed/)?playlist/([A-Za-z0-9]{22})", RegexOptions.Compiled);
        private static readonly Regex DeezerPlaylist = new(@"^/(?:[a-z]{2}/)?playlist/(\d{1,20})", RegexOptions.Compiled);
        private static readonly Regex ApplePlaylist = new(@"^/[a-z]{2}/playlist/[^/]*/(pl\.[A-Za-z0-9.-]+)", RegexOptions.Compiled);
        private static readonly Regex NextData = new(@"<script id=""__NEXT_DATA__"" type=""application/json"">(.+?)</script>", RegexOptions.Compiled | RegexOptions.Singleline);
        private static readonly Regex AppleData = new(@"<script type=""application/json"" id=""serialized-server-data"">(.+?)</script>", RegexOptions.Compiled | RegexOptions.Singleline);

        private readonly IHttpClientFactory _http;
        private readonly ILogger<ExternalPlaylistReader> _logger;

        public ExternalPlaylistReader(IHttpClientFactory http, ILogger<ExternalPlaylistReader> logger)
        {
            _http = http;
            _logger = logger;
        }

        /// <summary>El servicio del link (spotify, deezer, apple) si es una playlist que se sabe leer.</summary>
        public static string? ServiceOf(string url)
        {
            if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri))
                return null;
            var host = uri.Host.ToLowerInvariant();
            if (host == "open.spotify.com" && SpotifyPlaylist.IsMatch(uri.AbsolutePath)) return "spotify";
            if (host is "www.deezer.com" or "deezer.com" && DeezerPlaylist.IsMatch(uri.AbsolutePath)) return "deezer";
            if (host == "music.apple.com" && ApplePlaylist.IsMatch(uri.AbsolutePath)) return "apple";
            return null;
        }

        public async Task<ExternalPlaylist> ReadAsync(string url, CancellationToken ct = default)
        {
            var service = ServiceOf(url);
            if (service == null || !Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri))
                return new ExternalPlaylist("", null, new(), "not_a_playlist");
            try
            {
                return service switch
                {
                    "spotify" => await ReadSpotifyAsync(SpotifyPlaylist.Match(uri.AbsolutePath).Groups[1].Value, ct),
                    "deezer" => await ReadDeezerAsync(DeezerPlaylist.Match(uri.AbsolutePath).Groups[1].Value, ct),
                    _ => await ReadAppleAsync(uri, ct)
                };
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException or InvalidOperationException)
            {
                _logger.LogWarning(ex, "[SongRequest] No se pudo leer la playlist {Url}", url);
                return new ExternalPlaylist(service, null, new(), "failed");
            }
        }

        private async Task<string?> GetAsync(string url, CancellationToken ct)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(Timeout);
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.UserAgent.ParseAdd(UserAgent);
            request.Headers.AcceptLanguage.ParseAdd("en-US,en;q=0.8");
            using var response = await _http.CreateClient().SendAsync(request, cts.Token);
            return response.IsSuccessStatusCode ? await response.Content.ReadAsStringAsync(cts.Token) : null;
        }

        /// <summary>La página pública del reproductor embebido: nombre y hasta 100 canciones.</summary>
        private async Task<ExternalPlaylist> ReadSpotifyAsync(string id, CancellationToken ct)
        {
            var html = await GetAsync($"https://open.spotify.com/embed/playlist/{id}", ct);
            var m = html == null ? null : NextData.Match(html);
            if (m is not { Success: true })
                return new ExternalPlaylist("spotify", null, new(), "not_found");
            using var doc = JsonDocument.Parse(m.Groups[1].Value);
            var entity = doc.RootElement.GetProperty("props").GetProperty("pageProps").GetProperty("state").GetProperty("data").GetProperty("entity");
            var tracks = new List<ExternalTrack>();
            if (entity.TryGetProperty("trackList", out var list) && list.ValueKind == JsonValueKind.Array)
            {
                foreach (var t in list.EnumerateArray())
                {
                    var title = Str(t, "title");
                    if (string.IsNullOrWhiteSpace(title)) continue;
                    var uri = Str(t, "uri");
                    var trackId = uri != null && uri.StartsWith("spotify:track:") ? uri["spotify:track:".Length..] : null;
                    tracks.Add(new ExternalTrack(title, Str(t, "subtitle") ?? "", Ms(t, "duration"),
                        trackId == null ? null : $"https://open.spotify.com/track/{trackId}"));
                }
            }
            return new ExternalPlaylist("spotify", Str(entity, "name"), tracks, tracks.Count == 0 ? "not_found" : null);
        }

        /// <summary>La API pública de Deezer, paginada: la playlist completa.</summary>
        private async Task<ExternalPlaylist> ReadDeezerAsync(string id, CancellationToken ct)
        {
            var info = await GetAsync($"https://api.deezer.com/playlist/{id}", ct);
            if (info == null)
                return new ExternalPlaylist("deezer", null, new(), "not_found");
            string? name;
            using (var doc = JsonDocument.Parse(info))
            {
                if (doc.RootElement.TryGetProperty("error", out _))
                    return new ExternalPlaylist("deezer", null, new(), "not_found");
                name = Str(doc.RootElement, "title");
            }

            var tracks = new List<ExternalTrack>();
            for (var index = 0; tracks.Count < MaxTracks; index += 100)
            {
                var page = await GetAsync($"https://api.deezer.com/playlist/{id}/tracks?index={index}&limit=100", ct);
                if (page == null) break;
                using var doc = JsonDocument.Parse(page);
                if (!doc.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array || data.GetArrayLength() == 0)
                    break;
                foreach (var t in data.EnumerateArray())
                {
                    // title_short no trae los agregados entre paréntesis ("Remastered 2011"), que YouTube no usa
                    var title = Str(t, "title_short") ?? Str(t, "title");
                    if (string.IsNullOrWhiteSpace(title)) continue;
                    var artist = t.TryGetProperty("artist", out var a) ? Str(a, "name") ?? "" : "";
                    tracks.Add(new ExternalTrack(title, artist,
                        t.TryGetProperty("duration", out var d) && d.TryGetInt32(out var secs) ? secs : null, Str(t, "link")));
                }
                if (!doc.RootElement.TryGetProperty("next", out _))
                    break;
            }
            return new ExternalPlaylist("deezer", name, tracks, tracks.Count == 0 ? "not_found" : null);
        }

        /// <summary>La página pública de la playlist: las canciones vienen en sus datos serializados.</summary>
        private async Task<ExternalPlaylist> ReadAppleAsync(Uri uri, CancellationToken ct)
        {
            var html = await GetAsync(uri.GetLeftPart(UriPartial.Path), ct);
            var m = html == null ? null : AppleData.Match(html);
            if (m is not { Success: true })
                return new ExternalPlaylist("apple", null, new(), "not_found");
            using var doc = JsonDocument.Parse(m.Groups[1].Value);
            var tracks = new List<ExternalTrack>();
            var seen = new HashSet<string>();
            string? name = null;
            void Walk(JsonElement e)
            {
                if (tracks.Count >= MaxTracks) return;
                if (e.ValueKind == JsonValueKind.Object)
                {
                    if (e.TryGetProperty("contentDescriptor", out var cd) && cd.ValueKind == JsonValueKind.Object
                        && Str(cd, "kind") == "song" && Str(e, "title") is { Length: > 0 } title)
                    {
                        var url = Str(cd, "url");
                        if (seen.Add(url ?? title))
                        {
                            var artist = e.TryGetProperty("subtitleLinks", out var links) && links.ValueKind == JsonValueKind.Array
                                ? string.Join(", ", links.EnumerateArray().Select(l => Str(l, "title")).Where(x => !string.IsNullOrEmpty(x)))
                                : Str(e, "artistName") ?? "";
                            tracks.Add(new ExternalTrack(title, artist, Ms(e, "duration"), url));
                        }
                        return;
                    }
                    if (name == null && e.TryGetProperty("contentDescriptor", out var pcd) && pcd.ValueKind == JsonValueKind.Object
                        && Str(pcd, "kind") == "playlist" && Str(e, "title") is { Length: > 0 } pt)
                        name = pt;
                    foreach (var p in e.EnumerateObject()) Walk(p.Value);
                }
                else if (e.ValueKind == JsonValueKind.Array)
                {
                    foreach (var x in e.EnumerateArray()) Walk(x);
                }
            }
            Walk(doc.RootElement);
            return new ExternalPlaylist("apple", name, tracks, tracks.Count == 0 ? "not_found" : null);
        }

        private static string? Str(JsonElement e, string name) =>
            e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

        /// <summary>Duración en milisegundos → segundos.</summary>
        private static int? Ms(JsonElement e, string name) =>
            e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.TryGetInt64(out var ms) && ms > 0 ? (int)Math.Round(ms / 1000.0) : null;
    }
}
