using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    public class User
    {
        public long Id { get; set; }
        public string TwitchId { get; set; }
        public string Login { get; set; }
        public string DisplayName { get; set; }
        public string Email { get; set; }
        public string ProfileImageUrl { get; set; }
        public string OfflineImageUrl { get; set; }
        public string BroadcasterType { get; set; }
        public int ViewCount { get; set; }
        public string Description { get; set; }
        public string AccessToken { get; set; }
        public string RefreshToken { get; set; }
        public DateTime TokenExpiration { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsActive { get; set; } = true;
        public string UniqueId { get; set; }

        // Language preferences (i18n)
        [Column("preferred_language")]
        public string? PreferredLanguage { get; set; }

        [Column("language_preference_updated_at")]
        public DateTime? LanguagePreferenceUpdatedAt { get; set; }

        // Discord identity
        [Column("discord_id")]
        public string? DiscordId { get; set; }

        [Column("discord_username")]
        public string? DiscordUsername { get; set; }

        [Column("discord_avatar")]
        public string? DiscordAvatar { get; set; }

        [Column("discord_email")]
        public string? DiscordEmail { get; set; }

        // Discord OAuth tokens
        [Column("discord_access_token")]
        public string? DiscordAccessToken { get; set; }

        [Column("discord_refresh_token")]
        public string? DiscordRefreshToken { get; set; }

        [Column("discord_token_expiration")]
        public DateTime? DiscordTokenExpiration { get; set; }

        // Auth provider: 'twitch', 'discord', 'both'
        [Column("auth_provider")]
        public string AuthProvider { get; set; } = "twitch";
    }
}