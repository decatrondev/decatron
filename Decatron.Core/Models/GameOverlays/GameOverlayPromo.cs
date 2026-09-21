using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.GameOverlays;

/// <summary>
/// Un anuncio de Decatron para la tarjeta de Game Overlays: cada cierto tiempo tapa la
/// tarjeta de la cuenta con el logo del bot y un mensaje. El catálogo lo administra el
/// dueño de la plataforma (no el streamer): así se pueden sumar anuncios sin tocar el
/// front. El streamer solo puede apagarlos si su tier lo permite (CanHidePromo).
/// Plan: .dev/plans/LIVE_MATCH_OVERLAY_PLAN.md §2.3
/// </summary>
[Table("game_overlay_promos")]
public class GameOverlayPromo
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("is_enabled")]
    public bool IsEnabled { get; set; } = true;

    /// <summary>Peso relativo al sortear cuál sale (0 = nunca).</summary>
    [Column("weight")]
    public int Weight { get; set; } = 1;

    [Column("sort_order")]
    public int SortOrder { get; set; }

    /// <summary>Encabezado chico sobre "decatron.net" (p. ej. "Consigue Decatron gratis en").</summary>
    [Column("title_es"), MaxLength(120)]
    public string TitleEs { get; set; } = "";

    [Column("title_en"), MaxLength(120)]
    public string TitleEn { get; set; } = "";

    /// <summary>El mensaje del anuncio.</summary>
    [Column("line_es"), MaxLength(300)]
    public string LineEs { get; set; } = "";

    [Column("line_en"), MaxLength(300)]
    public string LineEn { get; set; } = "";

    /// <summary>Imagen (URL absoluta o ruta bajo /brand); null = lockup de Decatron.</summary>
    [Column("image_url"), MaxLength(500)]
    public string? ImageUrl { get; set; }

    /// <summary>Cuántos segundos se queda en pantalla (3-30).</summary>
    [Column("duration_seconds")]
    public int DurationSeconds { get; set; } = 8;

    /// <summary>Juegos donde sale, separados por coma; null/vacío = todos.</summary>
    [Column("games"), MaxLength(200)]
    public string? Games { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Ajustes globales de los anuncios (una sola fila, id = 1).</summary>
[Table("game_overlay_promo_settings")]
public class GameOverlayPromoSettings
{
    [Key, Column("id")]
    public long Id { get; set; } = 1;

    /// <summary>Cada cuántos segundos aparece un anuncio (30-1800).</summary>
    [Column("every_seconds")]
    public int EverySeconds { get; set; } = 180;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
