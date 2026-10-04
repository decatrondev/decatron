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
}
