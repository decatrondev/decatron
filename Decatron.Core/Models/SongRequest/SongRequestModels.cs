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
