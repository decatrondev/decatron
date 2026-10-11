using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.ClipCommand;

// Plan: .dev/plans/CLIP_COMANDO_PLAN.md · SQL: Decatron.Data/Migrations/Add_Clip_Command.sql

/// <summary>Rango mínimo para usar !clip. Los valores son los que guarda la base.</summary>
public static class ClipRoles
{
    public const string Everyone = "everyone";
    public const string Follower = "follower";
    public const string Subscriber = "subscriber";
    public const string Vip = "vip";
    public const string Moderator = "moderator";
    public const string LeadModerator = "lead_moderator";
    public const string Broadcaster = "broadcaster";

    /// <summary>De menor a mayor rango.</summary>
    public static readonly string[] Ordered =
        { Everyone, Follower, Subscriber, Vip, Moderator, LeadModerator, Broadcaster };

    public static bool IsValid(string? role) => role != null && Array.IndexOf(Ordered, role) >= 0;
}

/// <summary>Config de !clip por canal. Sin fila = comando apagado.</summary>
[Table("clip_command_configs")]
public class ClipCommandConfig
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("channel_name"), MaxLength(100)]
    public string ChannelName { get; set; } = "";

    [Column("enabled")]
    public bool Enabled { get; set; }

    /// <summary>Idioma de las respuestas en el chat: "es" o "en".</summary>
    [Column("language"), MaxLength(2)]
    public string Language { get; set; } = "es";

    /// <summary>Textos propios del streamer: <c>{"chat":{"clave":{"es":"..","en":".."}}}</c>. Vacío = base de Decatron.</summary>
    [Column("messages", TypeName = "jsonb")]
    public string Messages { get; set; } = "{}";

    [Column("min_role"), MaxLength(20)]
    public string MinRole { get; set; } = ClipRoles.Everyone;

    [Column("global_cooldown_seconds")]
    public int GlobalCooldownSeconds { get; set; } = 30;

    [Column("user_cooldown_seconds")]
    public int UserCooldownSeconds { get; set; } = 120;

    /// <summary>Moderadores y el broadcaster se saltan el cooldown por usuario.</summary>
    [Column("staff_skip_user_cooldown")]
    public bool StaffSkipUserCooldown { get; set; } = true;

    /// <summary>Tope por usuario en cada stream. null = sin tope.</summary>
    [Column("max_per_user_per_stream")]
    public int? MaxPerUserPerStream { get; set; }

    [Column("default_duration")]
    public decimal DefaultDuration { get; set; } = 30m;

    [Column("min_duration")]
    public decimal MinDuration { get; set; } = 5m;

    [Column("max_duration")]
    public decimal MaxDuration { get; set; } = 60m;

    [Column("allow_viewer_duration")]
    public bool AllowViewerDuration { get; set; } = true;

    [Column("allow_title")]
    public bool AllowTitle { get; set; } = true;

    [Column("max_title_length")]
    public int MaxTitleLength { get; set; } = 100;

    /// <summary>Otros nombres del comando, separados por coma y sin "!".</summary>
    [Column("aliases"), MaxLength(300)]
    public string Aliases { get; set; } = "";

    /// <summary>"message" avisa que no está disponible (Kick); "silent" no responde.</summary>
    [Column("unsupported_platform_mode"), MaxLength(10)]
    public string UnsupportedPlatformMode { get; set; } = "message";

    [Column("download_enabled")]
    public bool DownloadEnabled { get; set; }

    /// <summary>Tope de descargas por mes. Lo fija solo el admin. null = sin tope.</summary>
    [Column("download_monthly_cap")]
    public int? DownloadMonthlyCap { get; set; }

    /// <summary>Días que se conserva el historial. null = para siempre.</summary>
    [Column("history_retention_days")]
    public int? HistoryRetentionDays { get; set; } = 90;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Usuario que no puede usar !clip en el canal.</summary>
[Table("clip_command_blocks")]
public class ClipCommandBlock
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("twitch_user_id"), MaxLength(50)]
    public string TwitchUserId { get; set; } = "";

    [Column("twitch_login"), MaxLength(100)]
    public string TwitchLogin { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Un intento de !clip, creado o fallido.</summary>
[Table("clip_command_history")]
public class ClipCommandHistoryItem
{
    public const string StatusCreated = "created";
    public const string StatusFailed = "failed";

    [Key, Column("id")]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("channel_name"), MaxLength(100)]
    public string ChannelName { get; set; } = "";

    [Column("status"), MaxLength(10)]
    public string Status { get; set; } = StatusCreated;

    [Column("clip_id"), MaxLength(150)]
    public string? ClipId { get; set; }

    [Column("clip_url"), MaxLength(300)]
    public string? ClipUrl { get; set; }

    [Column("error_code"), MaxLength(40)]
    public string? ErrorCode { get; set; }

    [Column("title"), MaxLength(200)]
    public string? Title { get; set; }

    [Column("duration_seconds")]
    public decimal? DurationSeconds { get; set; }

    [Column("requested_by_id"), MaxLength(50)]
    public string RequestedById { get; set; } = "";

    [Column("requested_by_login"), MaxLength(100)]
    public string RequestedByLogin { get; set; } = "";

    [Column("requested_by_role"), MaxLength(20)]
    public string RequestedByRole { get; set; } = ClipRoles.Everyone;

    [Column("downloaded")]
    public bool Downloaded { get; set; }

    [Column("local_path"), MaxLength(500)]
    public string? LocalPath { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
