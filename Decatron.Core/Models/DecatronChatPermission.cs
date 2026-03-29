using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("decatron_chat_permissions")]
    public class DecatronChatPermission
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        [Required]
        public long UserId { get; set; }

        [Column("channel_owner_id")]
        [Required]
        public long ChannelOwnerId { get; set; }

        [Column("can_view")]
        public bool CanView { get; set; } = true;

        [Column("can_chat")]
        public bool CanChat { get; set; } = false;

        [Column("granted_by")]
        [Required]
        public long GrantedBy { get; set; }

        [Column("notes")]
        public string? Notes { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}
