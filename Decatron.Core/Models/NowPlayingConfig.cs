using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("now_playing_configs")]
    public class NowPlayingConfig
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("user_id")]
        public long UserId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("channel_name")]
        public string ChannelName { get; set; } = string.Empty;

        [Column("is_enabled")]
        public bool IsEnabled { get; set; } = false;

        [Required]
        [MaxLength(20)]
        [Column("provider")]
        public string Provider { get; set; } = "lastfm";

        [MaxLength(100)]
        [Column("lastfm_username")]
        public string? LastfmUsername { get; set; }

        [Column("spotify_access_token")]
        public string? SpotifyAccessToken { get; set; }

        [Column("spotify_refresh_token")]
        public string? SpotifyRefreshToken { get; set; }

        [Column("spotify_token_expires_at")]
        public DateTime? SpotifyTokenExpiresAt { get; set; }

        [Column("spotify_is_premium")]
        public bool SpotifyIsPremium { get; set; } = false;

        [Column("spotify_slot_requested")]
        public bool SpotifySlotRequested { get; set; } = false;

        [Column("spotify_slot_assigned")]
        public bool SpotifySlotAssigned { get; set; } = false;

        [Column("spotify_slot_assigned_at")]
        public DateTime? SpotifySlotAssignedAt { get; set; }

        [MaxLength(255)]
        [Column("spotify_slot_email")]
        public string? SpotifySlotEmail { get; set; }

        [Column("polling_interval")]
        public int PollingInterval { get; set; } = 5;

        [Required]
        [Column("config_json", TypeName = "jsonb")]
        public string ConfigJson { get; set; } = "{}";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}
