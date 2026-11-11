using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models;

/// <summary>
/// Página personal del streamer (decatron.net/@handle). Una por canal (fila de users). Borrador y publicado van como
/// JSON de <see cref="Decatron.Core.Helpers.PersonalPageContent"/>. Plan: .dev/plans/pagina-personal/PLAN.md.
/// Sin tenant_id por ahora (solo decatron.net): para el SaaS se agrega con RLS y el índice único pasa a (tenant_id, handle).
/// </summary>
[Table("personal_pages")]
public class PersonalPage
{
    [Key, Column("id")] public long Id { get; set; }
    [Column("channel_user_id")] public long ChannelUserId { get; set; }
    [Column("handle")] public string Handle { get; set; } = "";
    [Column("handle_changed_at")] public DateTimeOffset? HandleChangedAt { get; set; }
    [Column("draft", TypeName = "jsonb")] public string Draft { get; set; } = "{}";
    [Column("published", TypeName = "jsonb")] public string? Published { get; set; }
    [Column("published_at")] public DateTimeOffset? PublishedAt { get; set; }
    /// <summary>active | hidden (oculta por admin)</summary>
    [Column("status")] public string Status { get; set; } = "active";
    [Column("hidden_reason")] public string HiddenReason { get; set; } = "";
    /// <summary>El dueño perdió el nombre por una apelación y tiene que elegir otro (puede hacerlo sin esperar 30 días).</summary>
    [Column("needs_new_handle")] public bool NeedsNewHandle { get; set; }
    /// <summary>Admin marcó la página entera como +18 (por una denuncia): el dueño no puede desmarcarla.</summary>
    [Column("forced_adult")] public bool ForcedAdult { get; set; }
    [Column("revision"), ConcurrencyCheck] public long Revision { get; set; } = 1;
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    [Column("updated_at")] public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Nombre viejo que redirige a la página durante 30 días después de un cambio.</summary>
[Table("personal_page_handle_history")]
public class PersonalPageHandleHistory
{
    [Key, Column("id")] public long Id { get; set; }
    [Column("page_id")] public long PageId { get; set; }
    [Column("handle")] public string Handle { get; set; } = "";
    [Column("valid_until")] public DateTimeOffset ValidUntil { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Nombre reservado por admin (se suma a la lista fija de PersonalPageRules.BuiltInReserved).</summary>
[Table("personal_page_reserved_handles")]
public class PersonalPageReservedHandle
{
    [Key, Column("handle")] public string Handle { get; set; } = "";
    [Column("note")] public string Note { get; set; } = "";
    [Column("created_by")] public long? CreatedBy { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Apelación por un nombre tomado: quien la manda, su mensaje y la decisión de admin.</summary>
[Table("personal_page_handle_appeals")]
public class PersonalPageHandleAppeal
{
    [Key, Column("id")] public long Id { get; set; }
    [Column("handle")] public string Handle { get; set; } = "";
    [Column("requester_user_id")] public long RequesterUserId { get; set; }
    [Column("requester_channel_user_id")] public long RequesterChannelUserId { get; set; }
    [Column("message")] public string Message { get; set; } = "";
    /// <summary>pending | rejected | transferred | withdrawn</summary>
    [Column("status")] public string Status { get; set; } = "pending";
    [Column("review_note")] public string ReviewNote { get; set; } = "";
    [Column("reviewed_by")] public long? ReviewedBy { get; set; }
    [Column("reviewed_at")] public DateTimeOffset? ReviewedAt { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Dominio de la lista de admin: adult (fuerza +18) o blocked (no se puede enlazar). Subfase 5.2.</summary>
[Table("personal_page_domains")]
public class PersonalPageDomain
{
    [Key, Column("domain")] public string Domain { get; set; } = "";
    [Column("kind")] public string Kind { get; set; } = "blocked";
    [Column("note")] public string Note { get; set; } = "";
    [Column("created_by")] public long? CreatedBy { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Denuncia de una página (o de un enlace suyo) hecha por alguien con sesión, y lo que decidió admin. Subfase 5.2.</summary>
[Table("personal_page_reports")]
public class PersonalPageReport
{
    [Key, Column("id")] public long Id { get; set; }
    [Column("page_id")] public long PageId { get; set; }
    [Column("reporter_user_id")] public long ReporterUserId { get; set; }
    /// <summary>adult_unmarked | scam | impersonation | hate | copyright | other</summary>
    [Column("reason")] public string Reason { get; set; } = "other";
    [Column("detail")] public string Detail { get; set; } = "";
    /// <summary>Enlace denunciado (id y URL tal como estaban al denunciar), vacío si es la página entera.</summary>
    [Column("link_id")] public string LinkId { get; set; } = "";
    [Column("link_url")] public string LinkUrl { get; set; } = "";
    /// <summary>open | resolved | dismissed</summary>
    [Column("status")] public string Status { get; set; } = "open";
    /// <summary>hidden | forced_adult | domain_blocked (vacío si sigue abierta o se descartó)</summary>
    [Column("resolution")] public string Resolution { get; set; } = "";
    [Column("review_note")] public string ReviewNote { get; set; } = "";
    [Column("reviewed_by")] public long? ReviewedBy { get; set; }
    [Column("reviewed_at")] public DateTimeOffset? ReviewedAt { get; set; }
    [Column("created_at")] public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
