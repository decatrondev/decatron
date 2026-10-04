using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>Quién puede subir emotes a un canal. Sin fila, el canal usa el modo "staff".</summary>
    [Table("channel_emote_settings")]
    public class ChannelEmoteSettings
    {
        [Key] [Column("id")] public long Id { get; set; }
        [Column("user_id")] public long UserId { get; set; }

        /// <summary>owner | staff | approval | list</summary>
        [Required] [MaxLength(10)] [Column("upload_mode")] public string UploadMode { get; set; } = "staff";

        [Column("max_pending_per_user")] public int MaxPendingPerUser { get; set; } = 5;
        [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.Now;
        [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }

    /// <summary>Persona permitida por el streamer: sube sin revisión en los modos approval y list</summary>
    [Table("channel_emote_uploaders")]
    public class ChannelEmoteUploader
    {
        [Key] [Column("id")] public long Id { get; set; }
        [Column("user_id")] public long UserId { get; set; }
        [Required] [MaxLength(10)] [Column("platform")] public string Platform { get; set; } = "twitch";
        [Required] [MaxLength(100)] [Column("login")] public string Login { get; set; } = "";
        [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    /// <summary>Un emote propio de un canal. Los archivos viven en emote-assets/{user_id}/{file_key}/{1,2,4}.webp</summary>
    [Table("channel_emotes")]
    public class ChannelEmote
    {
        public const string Pending = "pending";
        public const string Approved = "approved";
        public const string Hidden = "hidden";
        public const string Rejected = "rejected";
        public const string Removed = "removed";

        [Key] [Column("id")] public long Id { get; set; }
        [Column("user_id")] public long UserId { get; set; }
        [Required] [MaxLength(25)] [Column("name")] public string Name { get; set; } = "";
        [Required] [MaxLength(32)] [Column("file_key")] public string FileKey { get; set; } = "";
        [Column("animated")] public bool Animated { get; set; }
        [Column("zero_width")] public bool ZeroWidth { get; set; }
        [Column("width")] public int Width { get; set; }
        [Column("height")] public int Height { get; set; }
        [Column("bytes")] public int Bytes { get; set; }
        [Required] [MaxLength(10)] [Column("status")] public string Status { get; set; } = Pending;
        [Column("uploaded_by")] public long UploadedBy { get; set; }
        [Required] [MaxLength(100)] [Column("uploaded_by_name")] public string UploadedByName { get; set; } = "";
        [MaxLength(100)] [Column("reviewed_by_name")] public string? ReviewedByName { get; set; }
        [Column("reviewed_at")] public DateTime? ReviewedAt { get; set; }
        [MaxLength(300)] [Column("reason")] public string? Reason { get; set; }
        [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.Now;
        [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }

    [Table("channel_emote_reports")]
    public class ChannelEmoteReport
    {
        [Key] [Column("id")] public long Id { get; set; }
        [Column("emote_id")] public long EmoteId { get; set; }
        [Column("reporter_user_id")] public long ReporterUserId { get; set; }
        [MaxLength(300)] [Column("reason")] public string? Reason { get; set; }
        [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    /// <summary>Un emote global de la plataforma: se ve en todos los canales. Archivos en emote-assets/global/{file_key}/</summary>
    [Table("global_emotes")]
    public class GlobalEmote
    {
        public const string Approved = "approved";
        public const string Hidden = "hidden";
        /// <summary>En la papelera: los archivos se conservan 30 días y un admin puede restaurarlo</summary>
        public const string Removed = "removed";

        [Key] [Column("id")] public long Id { get; set; }
        [Required] [MaxLength(25)] [Column("name")] public string Name { get; set; } = "";
        [Required] [MaxLength(32)] [Column("file_key")] public string FileKey { get; set; } = "";
        [Column("animated")] public bool Animated { get; set; }
        [Column("zero_width")] public bool ZeroWidth { get; set; }
        [Column("width")] public int Width { get; set; }
        [Column("height")] public int Height { get; set; }
        [Column("bytes")] public int Bytes { get; set; }
        [Required] [MaxLength(10)] [Column("status")] public string Status { get; set; } = Approved;
        [Column("removed_at")] public DateTime? RemovedAt { get; set; }
        [MaxLength(100)] [Column("removed_by")] public string? RemovedBy { get; set; }
        [Column("uploaded_by")] public long UploadedBy { get; set; }
        [Required] [MaxLength(100)] [Column("uploaded_by_name")] public string UploadedByName { get; set; } = "";
        [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.Now;
        [Column("updated_at")] public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }

    [Table("global_emote_managers")]
    public class GlobalEmoteManager
    {
        [Key] [Column("id")] public long Id { get; set; }
        [Required] [MaxLength(100)] [Column("login")] public string Login { get; set; } = "";
        [Required] [MaxLength(100)] [Column("added_by")] public string AddedBy { get; set; } = "";
        [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    [Table("global_emote_log")]
    public class GlobalEmoteLog
    {
        [Key] [Column("id")] public long Id { get; set; }
        [Required] [MaxLength(100)] [Column("actor")] public string Actor { get; set; } = "";
        [Required] [MaxLength(30)] [Column("action")] public string Action { get; set; } = "";
        [MaxLength(300)] [Column("detail")] public string? Detail { get; set; }
        [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    /// <summary>Solicitud de una persona para manejar los emotes globales</summary>
    [Table("global_emote_requests")]
    public class GlobalEmoteRequest
    {
        public const string Pending = "pending";
        public const string Approved = "approved";
        public const string Rejected = "rejected";

        [Key] [Column("id")] public long Id { get; set; }
        [Column("user_id")] public long UserId { get; set; }
        [Required] [MaxLength(100)] [Column("login")] public string Login { get; set; } = "";
        [MaxLength(300)] [Column("message")] public string? Message { get; set; }
        [Required] [MaxLength(10)] [Column("status")] public string Status { get; set; } = Pending;
        [MaxLength(100)] [Column("resolved_by")] public string? ResolvedBy { get; set; }
        [Column("resolved_at")] public DateTime? ResolvedAt { get; set; }
        [Column("created_at")] public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
