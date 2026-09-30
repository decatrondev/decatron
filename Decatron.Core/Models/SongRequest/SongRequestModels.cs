using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.SongRequest;

// Plan: .dev/plans/SONG_REQUEST_PLAN.md

/// <summary>
/// Una canción ya resuelta en su fuente (youtube…). Hace de caché: se reutiliza hasta que
/// caduca <see cref="ResolvedAt"/>, y la cola y el historial apuntan acá.
/// </summary>
[Table("song_request_tracks")]
public class SongTrack
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("source"), MaxLength(30)]
    public string Source { get; set; } = "";

    [Column("source_id"), MaxLength(100)]
    public string SourceId { get; set; } = "";

    [Column("title"), MaxLength(300)]
    public string Title { get; set; } = "";

    /// <summary>Artista o, si la fuente no lo da, el canal que lo subió.</summary>
    [Column("artist"), MaxLength(200)]
    public string Artist { get; set; } = "";

    /// <summary>Id del canal/autor en la fuente, para vetar por autor.</summary>
    [Column("author_id"), MaxLength(100)]
    public string? AuthorId { get; set; }

    [Column("duration_seconds")]
    public int? DurationSeconds { get; set; }

    [Column("view_count")]
    public long? ViewCount { get; set; }

    [Column("thumbnail_url"), MaxLength(500)]
    public string? ThumbnailUrl { get; set; }

    [Column("availability"), MaxLength(30)]
    public string? Availability { get; set; }

    [Column("live_status"), MaxLength(30)]
    public string? LiveStatus { get; set; }

    [Column("is_embeddable")]
    public bool IsEmbeddable { get; set; } = true;

    [Column("age_restricted")]
    public bool AgeRestricted { get; set; }

    [Column("resolved_at")]
    public DateTime ResolvedAt { get; set; } = DateTime.UtcNow;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Config del módulo por canal. Sin fila = apagado.</summary>
[Table("song_request_configs")]
public class SongRequestConfig
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("channel_name"), MaxLength(100)]
    public string ChannelName { get; set; } = "";

    [Column("enabled")]
    public bool Enabled { get; set; }

    [Column("requests_open")]
    public bool RequestsOpen { get; set; } = true;

    /// <summary>El reproductor se detiene; los pedidos se siguen aceptando.</summary>
    [Column("is_paused")]
    public bool IsPaused { get; set; }

    /// <summary>Clave del overlay que suena (va en su URL). Se crea al pedirla y se puede regenerar.</summary>
    [Column("player_key"), MaxLength(64)]
    public string? PlayerKey { get; set; }

    /// <summary>0-100</summary>
    [Column("volume")]
    public int Volume { get; set; } = 50;

    /// <summary>
    /// La playlist puesta a sonar (fase 4): llena el silencio en vez de la de respaldo, aunque el respaldo
    /// esté apagado. Null = la de respaldo. Los pedidos siempre van antes.
    /// </summary>
    [Column("active_playlist_id")]
    public long? ActivePlaylistId { get; set; }

    /// <summary>Ya no se usa: el cursor vive en cada playlist (song_request_playlists.cursor). Se dejó la columna.</summary>
    [Column("fallback_cursor")]
    public int FallbackCursor { get; set; }

    /// <summary>Filtros, límites, permisos y mensajes (JSON).</summary>
    [Column("settings", TypeName = "jsonb")]
    public string Settings { get; set; } = "{}";

    /// <summary>Lo que arma el editor de los overlays (JSON). El backend solo lo guarda.</summary>
    [Column("overlay_config", TypeName = "jsonb")]
    public string OverlayConfig { get; set; } = "{}";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Un pedido en la cola del canal (Twitch y Kick comparten la misma).</summary>
[Table("song_request_queue")]
public class SongRequestQueueItem
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("track_id")]
    public long TrackId { get; set; }

    public SongTrack? Track { get; set; }

    [Column("position")]
    public int Position { get; set; }

    /// <summary>queued | playing</summary>
    [Column("status"), MaxLength(20)]
    public string Status { get; set; } = "queued";

    /// <summary>twitch | kick | dashboard</summary>
    [Column("requested_platform"), MaxLength(20)]
    public string RequestedPlatform { get; set; } = "";

    [Column("requested_by_id"), MaxLength(100)]
    public string? RequestedById { get; set; }

    [Column("requested_by_login"), MaxLength(100)]
    public string RequestedByLogin { get; set; } = "";

    [Column("requested_by_name"), MaxLength(100)]
    public string RequestedByName { get; set; } = "";

    /// <summary>Servicio del link original cuando no es la fuente (spotify…).</summary>
    [Column("origin_source"), MaxLength(30)]
    public string? OriginSource { get; set; }

    [Column("origin_url"), MaxLength(500)]
    public string? OriginUrl { get; set; }

    [Column("origin_title"), MaxLength(300)]
    public string? OriginTitle { get; set; }

    [Column("origin_artist"), MaxLength(200)]
    public string? OriginArtist { get; set; }

    [Column("origin_thumbnail_url"), MaxLength(500)]
    public string? OriginThumbnailUrl { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Una canción que sonó en el canal.</summary>
[Table("song_request_history")]
public class SongRequestHistoryItem
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("track_id")]
    public long TrackId { get; set; }

    public SongTrack? Track { get; set; }

    [Column("requested_platform"), MaxLength(20)]
    public string? RequestedPlatform { get; set; }

    [Column("requested_by_login"), MaxLength(100)]
    public string? RequestedByLogin { get; set; }

    [Column("requested_by_name"), MaxLength(100)]
    public string? RequestedByName { get; set; }

    [Column("origin_source"), MaxLength(30)]
    public string? OriginSource { get; set; }

    [Column("origin_url"), MaxLength(500)]
    public string? OriginUrl { get; set; }

    /// <summary>finished | skipped | error | removed</summary>
    [Column("end_reason"), MaxLength(20)]
    public string EndReason { get; set; } = "finished";

    [Column("is_favorite")]
    public bool IsFavorite { get; set; }

    [Column("played_at")]
    public DateTime PlayedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Veto del canal. <see cref="Value"/> según el tipo:
/// track = "source:source_id", author = "source:author_id", user = "platform:login".
/// </summary>
[Table("song_request_bans")]
public class SongRequestBan
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    /// <summary>track | author | user</summary>
    [Column("ban_type"), MaxLength(20)]
    public string BanType { get; set; } = "";

    [Column("value"), MaxLength(200)]
    public string Value { get; set; } = "";

    [Column("label"), MaxLength(300)]
    public string Label { get; set; } = "";

    [Column("created_by"), MaxLength(100)]
    public string? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Una playlist del canal (etapa 2, .dev/plans/SONG_REQUEST_PLAYLISTS_PLAN.md). Una de ellas puede ser la
/// de respaldo: suena con la cola vacía.
/// </summary>
[Table("song_request_playlists")]
public class SongRequestPlaylist
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("name"), MaxLength(60)]
    public string Name { get; set; } = "";

    /// <summary>public (se ve en /sr/{canal}) | private (solo el dashboard).</summary>
    [Column("visibility"), MaxLength(10)]
    public string Visibility { get; set; } = SongRequestPlaylistVisibility.Private;

    /// <summary>Quién puede agregar: owner (streamer y mods) | open (viewers que cumplan los requisitos) | review (igual, pero pasa por la bandeja de pendientes).</summary>
    [Column("contribution"), MaxLength(10)]
    public string Contribution { get; set; } = SongRequestPlaylistContribution.Owner;

    /// <summary>Requisitos para que un viewer agregue (JSON de <see cref="SongRequestPlaylistRequirements"/>).</summary>
    [Column("requirements", TypeName = "jsonb")]
    public string Requirements { get; set; } = "{}";

    [Column("is_fallback")]
    public bool IsFallback { get; set; }

    /// <summary>Como respaldo: al azar o en orden.</summary>
    [Column("shuffle")]
    public bool Shuffle { get; set; }

    /// <summary>Por dónde va sonando en orden.</summary>
    [Column("cursor")]
    public int Cursor { get; set; }

    /// <summary>Los viewers votan canciones desde /sr/{canal} (fase 4).</summary>
    [Column("voting_enabled")]
    public bool VotingEnabled { get; set; }

    /// <summary>Más votadas primero (al sonar, en !sr #n y en la página) en vez del orden manual.</summary>
    [Column("sort_by_votes")]
    public bool SortByVotes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public static class SongRequestPlaylistContribution
{
    public const string Owner = "owner";
    public const string Open = "open";
    public const string Review = "review";

    public static bool IsValid(string? value) => value is Owner or Open or Review;

    /// <summary>Los viewers pueden aportar (directo o con revisión).</summary>
    public static bool AcceptsViewers(string? value) => value is Open or Review;
}

/// <summary>
/// Lo que pide una playlist colaborativa para que un viewer agregue. Todo lo define el streamer; por
/// defecto puede cualquiera. El streamer, control_total y los mods no pasan por estos requisitos.
/// </summary>
public class SongRequestPlaylistRequirements
{
    /// <summary>everyone &lt; subscriber &lt; vip &lt; moderator &lt; lead_moderator &lt; broadcaster.</summary>
    public string MinRole { get; set; } = "everyone";

    /// <summary>Antigüedad mínima de la cuenta de Twitch, en días. 0 = sin mínimo.</summary>
    public int MinAccountAgeDays { get; set; }

    /// <summary>Días mínimos siguiendo el canal de Twitch. 0 = sin mínimo (ni hace falta seguir).</summary>
    public int MinFollowAgeDays { get; set; }

    /// <summary>Canciones que puede tener cada viewer en esta playlist. 0 = sin límite.</summary>
    public int MaxPerUser { get; set; } = 5;

    /// <summary>Canciones que pueden sumar entre todos los viewers. 0 = hasta el tope del plan.</summary>
    public int MaxFromViewers { get; set; }

    /// <summary>Minutos entre dos canciones de un mismo viewer. 0 = sin espera.</summary>
    public int CooldownMinutes { get; set; } = 1;
}

public static class SongRequestPlaylistVisibility
{
    public const string Public = "public";
    public const string Private = "private";

    public static bool IsValid(string? value) => value is Public or Private;
}

/// <summary>Una canción de una playlist del canal.</summary>
[Table("song_request_playlist_items")]
public class SongRequestPlaylistItem
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("playlist_id")]
    public long PlaylistId { get; set; }

    /// <summary>El dueño del canal (repetido de la playlist para filtrar sin join).</summary>
    [Column("user_id")]
    public long UserId { get; set; }

    [Column("track_id")]
    public long TrackId { get; set; }

    public SongTrack? Track { get; set; }

    [Column("position")]
    public int Position { get; set; }

    /// <summary>twitch | kick. Null = la agregó el streamer o su equipo desde el dashboard.</summary>
    [Column("added_by_platform"), MaxLength(10)]
    public string? AddedByPlatform { get; set; }

    [Column("added_by_id"), MaxLength(64)]
    public string? AddedById { get; set; }

    [Column("added_by_login"), MaxLength(100)]
    public string? AddedByLogin { get; set; }

    [Column("added_by_name"), MaxLength(100)]
    public string? AddedByName { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Algo que espera aprobación (SONG_REQUEST_PLAYLISTS_PLAN.md, fase 3): un pedido a la cola
/// (<see cref="PlaylistId"/> null) o un aporte a una playlist "con revisión".
/// </summary>
[Table("song_request_pending")]
public class SongRequestPending
{
    [Key, Column("id")]
    public long Id { get; set; }

    /// <summary>El dueño de la cola.</summary>
    [Column("user_id")]
    public long UserId { get; set; }

    [Column("playlist_id")]
    public long? PlaylistId { get; set; }

    [Column("track_id")]
    public long TrackId { get; set; }

    public SongTrack? Track { get; set; }

    [Column("requested_platform"), MaxLength(20)]
    public string RequestedPlatform { get; set; } = "";

    [Column("requested_by_id"), MaxLength(100)]
    public string? RequestedById { get; set; }

    [Column("requested_by_login"), MaxLength(100)]
    public string RequestedByLogin { get; set; } = "";

    [Column("requested_by_name"), MaxLength(100)]
    public string RequestedByName { get; set; } = "";

    /// <summary>A qué chat avisar la decisión: login de Twitch o id de Kick (lo que entiende el IMessageSender).</summary>
    [Column("reply_channel"), MaxLength(100)]
    public string? ReplyChannel { get; set; }

    [Column("origin_source"), MaxLength(30)]
    public string? OriginSource { get; set; }

    [Column("origin_url"), MaxLength(500)]
    public string? OriginUrl { get; set; }

    [Column("origin_title"), MaxLength(300)]
    public string? OriginTitle { get; set; }

    [Column("origin_artist"), MaxLength(200)]
    public string? OriginArtist { get; set; }

    [Column("origin_thumbnail_url"), MaxLength(500)]
    public string? OriginThumbnailUrl { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Un viewer de confianza del canal: sus pedidos y aportes no pasan por revisión.</summary>
[Table("song_request_trusted")]
public class SongRequestTrusted
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("platform"), MaxLength(20)]
    public string Platform { get; set; } = "";

    [Column("login"), MaxLength(100)]
    public string Login { get; set; } = "";

    [Column("display_name"), MaxLength(100)]
    public string DisplayName { get; set; } = "";

    [Column("created_by"), MaxLength(100)]
    public string? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Un voto de un viewer a una canción de una playlist (uno por canción y persona).</summary>
[Table("song_request_playlist_votes")]
public class SongRequestPlaylistVote
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("playlist_id")]
    public long PlaylistId { get; set; }

    [Column("item_id")]
    public long ItemId { get; set; }

    [Column("platform"), MaxLength(20)]
    public string Platform { get; set; } = "";

    [Column("login"), MaxLength(100)]
    public string Login { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
