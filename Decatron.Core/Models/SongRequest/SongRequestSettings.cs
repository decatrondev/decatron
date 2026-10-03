using System.Collections.Generic;

namespace Decatron.Core.Models.SongRequest;

/// <summary>
/// Lo que va en song_request_configs.settings. Todo lo configura el streamer; estos son los
/// valores por defecto. Plan: .dev/plans/SONG_REQUEST_PLAN.md
/// </summary>
public class SongRequestSettings
{
    /// <summary>Los viewers pueden pedir al stream una canción de una playlist desde su página (/sr/{canal}/p/{código}). Fase 2, etapa 3.</summary>
    public bool AllowWebRequests { get; set; } = true;

    public SongRequestPermissions Permissions { get; set; } = new();

    /// <summary>Máximo de canciones en la cola (sin contar la que suena).</summary>
    public int MaxQueueSize { get; set; } = 50;

    /// <summary>Máximo de pedidos de un mismo usuario en la cola. 0 = sin límite. El streamer no tiene límite.</summary>
    public int MaxPerUser { get; set; } = 3;

    /// <summary>
    /// Máximo de pedidos de un mismo usuario en la última hora, sonados o no (fase 5). 0 = sin límite.
    /// El streamer y control_total no tienen límite.
    /// </summary>
    public int MaxPerUserPerHour { get; set; }

    /// <summary>Si los viewers pueden votar !skip (los que tienen el permiso de saltar lo hacen directo).</summary>
    public bool SkipVoteEnabled { get; set; }

    public int SkipVotesRequired { get; set; } = 3;

    /// <summary>Cuántas canciones lista !queue en el chat.</summary>
    public int QueuePreviewCount { get; set; } = 3;

    // ── Filtros (fase 3). No aplican al streamer, a control_total ni a lo que se agrega desde el dashboard ──

    /// <summary>Duración máxima en segundos. 0 = sin límite.</summary>
    public int MaxDurationSeconds { get; set; }

    /// <summary>
    /// Con duración máxima activa, qué pasa con una canción de duración desconocida (videos no listados
    /// cuando YouTube bloquea al server): true = se acepta y el reproductor la corta al llegar al máximo.
    /// </summary>
    public bool AllowUnknownDuration { get; set; } = true;

    /// <summary>Vistas mínimas en YouTube. 0 = sin mínimo. Si no se conocen las vistas, se acepta.</summary>
    public long MinViews { get; set; }

    /// <summary>No volver a aceptar una canción que sonó hace menos de estos minutos. 0 = sin restricción.</summary>
    public int NoRepeatMinutes { get; set; }

    // ── Playlist de respaldo (fase 3). Cuál es y si va al azar vive en cada playlist (song_request_playlists) ──

    /// <summary>Con la cola vacía suena la playlist de respaldo. Los pedidos siempre van antes.</summary>
    public bool FallbackEnabled { get; set; }

    /// <summary>
    /// Tarjeta de Decatron en los overlays (SONG_REQUEST_PLAYLISTS_PLAN.md). Solo se puede apagar desde
    /// el plan Supporter; en el gratis el backend la deja prendida.
    /// </summary>
    public bool ShowPromo { get; set; } = true;

    /// <summary>
    /// Los pedidos de !sr quedan pendientes hasta que alguien con el permiso de revisar los apruebe
    /// (SONG_REQUEST_PLAYLISTS_PLAN.md, fase 3). No aplica a quien puede revisar ni a los de confianza.
    /// </summary>
    public bool RequestReview { get; set; }

    /// <summary>
    /// De dónde se puede pedir (fase 4): any = cualquier canción; playlists = solo canciones que estén en una
    /// playlist curada del canal (solo streamer y mods, o con revisión; las abiertas no cuentan porque
    /// cualquiera las llena). !sr #n siempre vale. No aplica al streamer ni a control_total.
    /// </summary>
    public string RequestSource { get; set; } = "any";

    /// <summary>Mensajes del bot editados por el streamer (clave → plantilla). Lo que falte sale del idioma del canal.</summary>
    public Dictionary<string, string> Messages { get; set; } = new();
}

/// <summary>
/// Rol mínimo por acción: everyone &lt; subscriber &lt; vip &lt; moderator &lt; lead_moderator &lt; broadcaster.
/// Quien tiene control_total en el dashboard cuenta como broadcaster.
/// </summary>
public class SongRequestPermissions
{
    /// <summary>!sr, !wrongsong, !queue, !song, !myqueue y votar !skip.</summary>
    public string Request { get; set; } = "everyone";

    /// <summary>!skip directo y !srremove (quitar pedidos de otros).</summary>
    public string Skip { get; set; } = "moderator";

    /// <summary>!sropen, !srclose, !srpause, !srresume, !srban.</summary>
    public string Manage { get; set; } = "lead_moderator";

    /// <summary>Aprobar o rechazar lo pendiente (!srapprove, !srreject); sus pedidos no pasan por revisión.</summary>
    public string Review { get; set; } = "moderator";

    /// <summary>!playlist: el enlace a las playlists del canal.</summary>
    public string Playlist { get; set; } = "everyone";
}
