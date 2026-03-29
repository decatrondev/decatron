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
    }
}