using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models;

/// <summary>
/// Cada vez que desde admin se dio o quitó mod al bot o al dueño de Decatron en un canal.
/// Se usa el token del streamer (Twitch solo acepta ese para dar mod), así que queda registrado.
/// </summary>
[Table("admin_mod_actions")]
public class AdminModAction
{
    [Key, Column("id")]
    public long Id { get; set; }

    [Column("channel_user_id")]
    public long ChannelUserId { get; set; }

    [Column("channel_login"), MaxLength(100)]
    public string ChannelLogin { get; set; } = "";

    /// <summary>bot | owner</summary>
    [Column("target"), MaxLength(20)]
    public string Target { get; set; } = "";

    [Column("target_login"), MaxLength(100)]
    public string TargetLogin { get; set; } = "";

    /// <summary>add | remove</summary>
    [Column("action"), MaxLength(10)]
    public string Action { get; set; } = "";

    [Column("success")]
    public bool Success { get; set; }

    [Column("error"), MaxLength(500)]
    public string? Error { get; set; }

    [Column("admin_user_id")]
    public long AdminUserId { get; set; }

    [Column("admin_login"), MaxLength(100)]
    public string AdminLogin { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
