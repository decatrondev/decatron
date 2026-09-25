using System;
using System.Threading;
using System.Threading.Tasks;
using Decatron.Core.Models.SongRequest;

namespace Decatron.Services.SongRequest
{
    // Plan: .dev/plans/SONG_REQUEST_PLAN.md — "Arquitectura modular".
    // Un servicio nuevo = una clase que implementa ITrackResolver y/o ITrackSource,
    // registrada en Program.cs. La cola, los comandos y la vista no cambian.

    /// <summary>Por qué no se pudo resolver un pedido. El comando lo traduce a un mensaje del chat.</summary>
    public enum SongResolveError
    {
        None,
        /// <summary>Link de un servicio que no soportamos.</summary>
        Unsupported,
        /// <summary>Link de un servicio soportado pero que no apunta a una canción (playlist, canal…).</summary>
        InvalidLink,
        NotFound,
        Private,
        Live,
        Upcoming,
        NotEmbeddable,
        AgeRestricted,
        /// <summary>Fuera de su app solo deja escuchar un fragmento (SoundCloud Go+).</summary>
        PreviewOnly,
        /// <summary>La búsqueda no encontró una coincidencia confiable.</summary>
        NoMatch,
        /// <summary>La fuente bloqueó al server (ej. "confirm you're not a bot").</summary>
        Blocked,
        Failed
    }

    /// <summary>
    /// "Qué canción es", tal como la entiende un resolutor. Si el resolutor es también la fuente
    /// (YouTube), trae <see cref="SourceKey"/> y <see cref="SourceId"/> y no hace falta buscar.
    /// </summary>
    public sealed record TrackInfo(
        string Origin,
        string? Url,
        string Title,
        string Artist,
        int? DurationSeconds,
        string? ThumbnailUrl,
        string? SourceKey = null,
        string? SourceId = null);

    public sealed record ResolverResult(TrackInfo? Info, SongResolveError Error)
    {
        public static ResolverResult Ok(TrackInfo info) => new(info, SongResolveError.None);
        public static ResolverResult Fail(SongResolveError error) => new(null, error);
    }

    /// <summary>Entiende los links de un servicio (YouTube, Spotify, Deezer, Apple Music, SoundCloud).</summary>
    public interface ITrackResolver
    {
        /// <summary>youtube, spotify…</summary>
        string Key { get; }

        bool CanHandle(Uri url);

        Task<ResolverResult> ResolveAsync(Uri url, CancellationToken ct = default);
    }

    public sealed record SourceTrackResult(SongTrack? Track, SongResolveError Error)
    {
        public static SourceTrackResult Ok(SongTrack track) => new(track, SongResolveError.None);
        public static SourceTrackResult Fail(SongResolveError error) => new(null, error);
    }

    public sealed record SourceSearchResult(string? SourceId, SongResolveError Error)
    {
        public static SourceSearchResult Ok(string sourceId) => new(sourceId, SongResolveError.None);
        public static SourceSearchResult Fail(SongResolveError error) => new(null, error);
    }

    /// <summary>Una fuente que además entiende listas (importar una playlist a la playlist de respaldo).</summary>
    public interface IPlaylistSource
    {
        string Key { get; }

        bool CanHandlePlaylist(Uri url);

        /// <summary>Las canciones de la lista (filas sin guardar, datos básicos), hasta <paramref name="max"/>.</summary>
        Task<(System.Collections.Generic.List<SongTrack> Tracks, SongResolveError Error)> ListPlaylistAsync(Uri url, int max, CancellationToken ct = default);
    }

    /// <summary>De dónde sale el audio para reproducir y descargar (YouTube, SoundCloud).</summary>
    public interface ITrackSource
    {
        /// <summary>Lo que se guarda en song_request_tracks.source.</summary>
        string Key { get; }

        /// <summary>Datos completos de un video/pista por su id. Devuelve una fila sin guardar.</summary>
        Task<SourceTrackResult> GetAsync(string sourceId, CancellationToken ct = default);

        /// <summary>
        /// Busca por texto. Con <paramref name="expectedDurationSeconds"/> (link de Spotify…) elige la
        /// coincidencia por duración y descarta covers y versiones en vivo.
        /// </summary>
        Task<SourceSearchResult> SearchAsync(string query, int? expectedDurationSeconds, CancellationToken ct = default);

        /// <summary>Link público para mostrar en el chat.</summary>
        string GetPublicUrl(string sourceId);
    }
}
