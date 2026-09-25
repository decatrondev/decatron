using System.Collections.Generic;

namespace Decatron.Core.Models.SongRequest;

/// <summary>
/// Lo que va en song_request_configs.settings. Todo lo configura el streamer; estos son los
/// valores por defecto. Plan: .dev/plans/SONG_REQUEST_PLAN.md
/// </summary>
public class SongRequestSettings
{
    public SongRequestPermissions Permissions { get; set; } = new();

    /// <summary>Máximo de canciones en la cola (sin contar la que suena).</summary>
    public int MaxQueueSize { get; set; } = 50;

    /// <summary>Máximo de pedidos de un mismo usuario en la cola. 0 = sin límite. El streamer no tiene límite.</summary>
    public int MaxPerUser { get; set; } = 3;

    /// <summary>Si los viewers pueden votar !skip (los que tienen el permiso de saltar lo hacen directo).</summary>
    public bool SkipVoteEnabled { get; set; }

    public int SkipVotesRequired { get; set; } = 3;

    /// <summary>Cuántas canciones lista !queue en el chat.</summary>
    public int QueuePreviewCount { get; set; } = 3;

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
}
