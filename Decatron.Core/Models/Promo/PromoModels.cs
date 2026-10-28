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

    /// <summary>Fija: mientras el canal tenga tarjetas propias en uso, el streamer no puede apagarla ni dejarla más corta o más chica que el valor del dueño.</summary>
    [Column("is_pinned")]
    public bool IsPinned { get; set; }

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

    /// <summary>Límites de lo que el streamer puede cambiar de cada pieza y de cada zona (duración, escala y margen de la zona).</summary>
    [Column("min_duration_seconds")]
    public int MinDurationSeconds { get; set; } = 5;

    [Column("max_duration_seconds")]
    public int MaxDurationSeconds { get; set; } = 60;

    [Column("min_scale_percent")]
    public int MinScalePercent { get; set; } = 60;

    [Column("max_scale_percent")]
    public int MaxScalePercent { get; set; } = 150;

    [Column("max_zone_margin")]
    public int MaxZoneMargin { get; set; } = 600;

    /// <summary>Tarjetas propias: cuántas piezas del bot salen antes de cada una propia (1 = alternan) y cada cuántos minutos puede repetirse una misma tarjeta, como mínimo.</summary>
    [Column("bot_per_own")]
    public int BotPerOwn { get; set; } = 1;

    [Column("own_min_interval_minutes")]
    public int OwnMinIntervalMinutes { get; set; } = 5;

    /// <summary>true = una sola pieza a la vez entre TODAS las zonas (el overlay no abruma aunque las zonas queden una sobre otra). false = cada zona va por su cuenta.</summary>
    [Column("one_at_a_time")]
    public bool OneAtATime { get; set; } = true;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Lo que un streamer decide sobre el catálogo: pausar todo, apagar piezas y ser más discreto que los topes globales. Una fila por
/// cuenta (fila principal), con tenant_id y RLS. Nunca puede ser más insistente que el catálogo del dueño.
/// </summary>
[Table("promo_channel_settings")]
public class PromoChannelSettings
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("paused")]
    public bool Paused { get; set; }

    /// <summary>JSON con la lista de ids de piezas apagadas, p. ej. [3,7].</summary>
    [Column("disabled_pieces", TypeName = "jsonb")]
    public string DisabledPieces { get; set; } = "[]";

    [Column("min_gap_seconds")]
    public int? MinGapSeconds { get; set; }

    [Column("hourly_cap_seconds")]
    public int? HourlyCapSeconds { get; set; }

    /// <summary>Comando de chat del streamer (nace apagado). Nombre sin "!", quién puede usarlo y pausa entre usos.</summary>
    [Column("cmd_enabled")]
    public bool CmdEnabled { get; set; }

    [Column("cmd_name")]
    public string CmdName { get; set; } = "dpromo";

    [Column("cmd_cooldown_seconds")]
    public int CmdCooldownSeconds { get; set; } = 10;

    /// <summary>moderator | vip | subscriber | everyone. El streamer y el Lead Moderator siempre pueden.</summary>
    [Column("cmd_min_role")]
    public string CmdMinRole { get; set; } = "moderator";

    /// <summary>Disparadores: al empezar el directo y al recibir una raid. Pieza: id del bot (&gt; 0), tarjeta propia (&lt; 0) o null = la siguiente de la rotación.</summary>
    [Column("trigger_start_enabled")]
    public bool TriggerStartEnabled { get; set; }

    [Column("trigger_start_piece_id")]
    public long? TriggerStartPieceId { get; set; }

    [Column("trigger_start_delay_seconds")]
    public int TriggerStartDelaySeconds { get; set; } = 10;

    [Column("trigger_raid_enabled")]
    public bool TriggerRaidEnabled { get; set; }

    [Column("trigger_raid_piece_id")]
    public long? TriggerRaidPieceId { get; set; }

    [Column("trigger_raid_delay_seconds")]
    public int TriggerRaidDelaySeconds { get; set; } = 10;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Veces que una pieza se entregó al overlay de una cuenta en un día (UTC). Contador agregado: no identifica a nadie. Tabla de tenant con RLS.</summary>
[Table("promo_view_counts")]
public class PromoViewCount
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("piece_id")]
    public long PieceId { get; set; }

    [Column("day", TypeName = "date")]
    public DateTime Day { get; set; }

    [Column("views")]
    public int Views { get; set; }

    /// <summary>Tiempo en pantalla acumulado (suma de la duración de cada entrega).</summary>
    [Column("seconds")]
    public int Seconds { get; set; }
}

/// <summary>Entregas de una tarjeta propia en un día (UTC), por canal. Agregado, no identifica a nadie. Tabla de tenant con RLS; se borra con la tarjeta.</summary>
[Table("promo_own_card_counts")]
public class PromoOwnCardCount
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("card_id")]
    public long CardId { get; set; }

    [Column("day", TypeName = "date")]
    public DateTime Day { get; set; }

    [Column("views")]
    public int Views { get; set; }

    [Column("seconds")]
    public int Seconds { get; set; }
}

/// <summary>Total global de entregas de una pieza por día (sin canal), para el dueño.</summary>
[Table("promo_piece_daily")]
public class PromoPieceDaily
{
    [Column("piece_id")]
    public long PieceId { get; set; }

    [Column("day", TypeName = "date")]
    public DateTime Day { get; set; }

    [Column("views")]
    public int Views { get; set; }

    [Column("seconds")]
    public long Seconds { get; set; }
}

/// <summary>Lo que un streamer cambió de una pieza (duración, plantilla, escala). Null = usa el valor del dueño. Tabla de tenant con RLS.</summary>
[Table("promo_piece_overrides")]
public class PromoPieceOverride
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("piece_id")]
    public long PieceId { get; set; }

    [Column("duration_seconds")]
    public int? DurationSeconds { get; set; }

    [Column("template_id")]
    public long? TemplateId { get; set; }

    [Column("scale_percent")]
    public int? ScalePercent { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Dónde puso el streamer una zona (ancla y márgenes sobre el lienzo de 1920×1080). Sin fila = usa el valor del dueño. Tabla de tenant con RLS.</summary>
[Table("promo_zone_overrides")]
public class PromoZoneOverride
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("zone_key"), MaxLength(40)]
    public string ZoneKey { get; set; } = "";

    [Column("anchor"), MaxLength(16)]
    public string Anchor { get; set; } = "top-right";

    [Column("margin_x")]
    public int MarginX { get; set; }

    [Column("margin_y")]
    public int MarginY { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Los colores, textos y tipografía que un streamer eligió para una plantilla (JSON {idDelAjuste: valor}). Sin fila = valores del dueño. Tabla de tenant con RLS.</summary>
[Table("promo_template_overrides")]
public class PromoTemplateOverride
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("template_id")]
    public long TemplateId { get; set; }

    [Column("style")]
    public string Style { get; set; } = "{}";

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Tarjeta propia de un streamer (solo texto): sale solo en su canal, después de una pieza del bot. Tabla de tenant con RLS. Plan: PLAN.md §3.5</summary>
[Table("promo_own_cards")]
public class PromoOwnCard
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("title"), MaxLength(80)]
    public string Title { get; set; } = "";

    [Column("body"), MaxLength(200)]
    public string Body { get; set; } = "";

    [Column("icon"), MaxLength(40)]
    public string? Icon { get; set; }

    /// <summary>Solo https.</summary>
    [Column("link_url"), MaxLength(500)]
    public string? LinkUrl { get; set; }

    [Column("show_qr")]
    public bool ShowQr { get; set; }

    [Column("zone"), MaxLength(40)]
    public string Zone { get; set; } = "corner";

    [Column("template_id")]
    public long? TemplateId { get; set; }

    [Column("duration_seconds")]
    public int DurationSeconds { get; set; } = 8;

    /// <summary>Cada cuántos minutos puede volver a salir esta tarjeta, como mínimo.</summary>
    [Column("interval_minutes")]
    public int IntervalMinutes { get; set; } = 10;

    [Column("is_enabled")]
    public bool IsEnabled { get; set; } = true;

    /// <summary>La oculta el dueño (no cumple las reglas); el streamer la ve pero no sale.</summary>
    [Column("hidden_by_admin")]
    public bool HiddenByAdmin { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
