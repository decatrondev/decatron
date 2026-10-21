using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>Un guardado de la configuración de Speak Chat: quién, cuándo y qué campos cambiaron.</summary>
    [Table("speak_chat_config_history")]
    public class SpeakChatConfigHistory
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("channel_name")]
        public string ChannelName { get; set; } = string.Empty;

        [Column("changed_by_user_id")]
        public long ChangedByUserId { get; set; }

        [MaxLength(100)]
        [Column("changed_by_login")]
        public string ChangedByLogin { get; set; } = string.Empty;

        /// <summary>JSON: lista de { path, before, after }.</summary>
        [Required]
        [Column("changes", TypeName = "jsonb")]
        public string Changes { get; set; } = "[]";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
