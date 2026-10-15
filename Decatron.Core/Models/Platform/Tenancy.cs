using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.Platform;

/// <summary>Comprador de la plataforma. El tenant #1 es Decatron (.dev/plans/plataforma/FASE1_DISENO.md).</summary>
[Table("tenants")]
public class Tenant
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("slug"), MaxLength(40)]
    public string Slug { get; set; } = "";

    [Column("name"), MaxLength(120)]
    public string Name { get; set; } = "";

    /// <summary>active | suspended | closed</summary>
    [Column("status"), MaxLength(12)]
    public string Status { get; set; } = "active";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Quién administra un tenant. Clave compuesta (tenant_id, user_id), definida en OnModelCreating.</summary>
[Table("tenant_members")]
public class TenantMember
{
    [Column("tenant_id")]
    public long TenantId { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    /// <summary>owner | admin | viewer</summary>
    [Column("role"), MaxLength(12)]
    public string Role { get; set; } = "viewer";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Un canal (Twitch, Kick…) y el tenant al que pertenece. Es la fuente única para resolver el tenant.</summary>
[Table("channels")]
public class Channel
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("tenant_id")]
    public long TenantId { get; set; }

    /// <summary>twitch | kick | discord | youtube | tiktok</summary>
    [Column("platform"), MaxLength(12)]
    public string Platform { get; set; } = "";

    /// <summary>Id numérico de la plataforma (Twitch: twitch_id; Kick: kick_id).</summary>
    [Column("external_id"), MaxLength(64)]
    public string ExternalId { get; set; } = "";

    /// <summary>users.id del dueño del canal.</summary>
    [Column("user_id")]
    public long UserId { get; set; }

    [Column("login"), MaxLength(100)]
    public string Login { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
