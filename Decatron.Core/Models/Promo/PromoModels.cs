using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Promo;

/// <summary>
/// Plantilla del overlay de Promociones: un DISEÑO (lienzo + elementos, JSON) más la zona donde se pone por defecto. Lo edita el
/// dueño en /admin/promo con el editor de lienzo; el streamer parte de él y guarda sus cambios aparte. Son datos globales
/// (sin tenant_id). Plan: .dev/plans/overlay-promo/PLAN.md §3.3c
/// </summary>
[Table("promo_templates")]
public class PromoTemplate
{
    [Key, Column("id")]
    public long Id { get; set; }

    /// <summary>Identificador estable (minúsculas, sin espacios); no cambia aunque se renombre.</summary>
    [Column("key"), MaxLength(40)]
    public string Key { get; set; } = "";

    [Column("name_es"), MaxLength(80)]
    public string NameEs { get; set; } = "";

    [Column("name_en"), MaxLength(80)]
    public string NameEn { get; set; } = "";

    /// <summary>Clave de una fila de promo_zones: dónde se pone por defecto.</summary>
    [Column("zone"), MaxLength(40)]
    public string Zone { get; set; } = "corner";

    /// <summary>El diseño (ver ClientApp/src/components/promo-overlay/types.ts). Lo valida PromoDesignValidator.</summary>
    [Column("design", TypeName = "jsonb")]
    public string Design { get; set; } = "{}";

    [Column("is_enabled")]
    public bool IsEnabled { get; set; } = true;

    [Column("sort_order")]
    public int SortOrder { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Una zona del lienzo de 1920×1080 donde se coloca una ficha por defecto (ancla y márgenes). El dueño las crea y edita.</summary>
[Table("promo_zones")]
public class PromoZone
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("key"), MaxLength(40)]
    public string Key { get; set; } = "";

    [Column("name_es"), MaxLength(80)]
    public string NameEs { get; set; } = "";

    [Column("name_en"), MaxLength(80)]
    public string NameEn { get; set; } = "";

    /// <summary>top-left | top-center | top-right | middle-left | center | middle-right | bottom-left | bottom-center | bottom-right</summary>
    [Column("anchor"), MaxLength(16)]
    public string Anchor { get; set; } = "top-right";

    [Column("margin_x")]
    public int MarginX { get; set; } = 96;

    [Column("margin_y")]
    public int MarginY { get; set; } = 54;

    [Column("is_enabled")]
    public bool IsEnabled { get; set; } = true;

    [Column("sort_order")]
    public int SortOrder { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Una pieza del catálogo de Promociones (origen bot o tercero). Las tarjetas propias del streamer van en otra tabla
/// (fase 3). Plan: .dev/plans/overlay-promo/PLAN.md §3.1
/// </summary>
[Table("promo_pieces")]
public class PromoPiece
{
    [Key, Column("id")]
    public long Id { get; set; }

    /// <summary>commands | module | qr | news | credits | community | emergency</summary>
    [Column("kind"), MaxLength(24)]
    public string Kind { get; set; } = "news";

    /// <summary>bot | tercero</summary>
    [Column("origin"), MaxLength(12)]
    public string Origin { get; set; } = "bot";

    [Column("title_es"), MaxLength(120)]
    public string TitleEs { get; set; } = "";

    [Column("title_en"), MaxLength(120)]
    public string TitleEn { get; set; } = "";

    /// <summary>Texto con variables permitidas: {{channel}}, {{commands}}, {{link}}.</summary>
    [Column("body_es"), MaxLength(300)]
    public string BodyEs { get; set; } = "";

    [Column("body_en"), MaxLength(300)]
    public string BodyEn { get; set; } = "";

    /// <summary>Solo https.</summary>
    [Column("link_url"), MaxLength(500)]
    public string? LinkUrl { get; set; }

    [Column("show_qr")]
    public bool ShowQr { get; set; }

    /// <summary>https o una ruta propia del sitio (empieza con una sola "/").</summary>
    [Column("image_url"), MaxLength(500)]
    public string? ImageUrl { get; set; }

    [Column("icon"), MaxLength(40)]
    public string? Icon { get; set; }

    [Column("template_id")]
    public long? TemplateId { get; set; }

    /// <summary>Clave de una fila de promo_zones.</summary>
    [Column("zone"), MaxLength(40)]
    public string Zone { get; set; } = "corner";

    /// <summary>Mayor = pasa antes en la cola (0-100).</summary>
    [Column("priority")]
    public int Priority { get; set; }

    /// <summary>Peso relativo al sortear entre piezas de igual prioridad (0 = nunca).</summary>
    [Column("weight")]
    public int Weight { get; set; } = 1;

    [Column("duration_seconds")]
    public int DurationSeconds { get; set; } = 8;

    [Column("starts_at")]
    public DateTime? StartsAt { get; set; }

    [Column("ends_at")]
    public DateTime? EndsAt { get; set; }

    /// <summary>all | twitch | kick</summary>
    [Column("platforms"), MaxLength(8)]
    public string Platforms { get; set; } = "all";

    /// <summary>Logins de canal separados por coma; null/vacío = todos los canales.</summary>
    [Column("only_channels"), MaxLength(500)]
    public string? OnlyChannels { get; set; }

    /// <summary>draft | published</summary>
    [Column("status"), MaxLength(12)]
    public string Status { get; set; } = "draft";

    [Column("sort_order")]
    public int SortOrder { get; set; }

    [Column("created_by")]
    public long? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Topes de cuidado del espectador (una sola fila, id = 1). El streamer puede ser más discreto, nunca más insistente.</summary>
[Table("promo_settings")]
public class PromoOverlayLimits
{
    [Key, Column("id")]
    public long Id { get; set; } = 1;

    /// <summary>Mínimo de segundos entre dos piezas de una misma zona.</summary>
    [Column("min_gap_seconds")]
    public int MinGapSeconds { get; set; } = 60;

    /// <summary>Máximo de segundos de promoción en pantalla por hora.</summary>
    [Column("hourly_cap_seconds")]
    public int HourlyCapSeconds { get; set; } = 600;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
