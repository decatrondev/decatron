using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    public class User
    {
        public long Id { get; set; }
        // Nullable de verdad: hay filas sin Twitch (login solo-Discord, solo-Kick).
        // La columna de Postgres siempre lo permitio; el modelo no coincidia con eso
        // hasta que una fila real con NULL rompio cada lectura — ver KickAuthController.
        public string? TwitchId { get; set; }
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

        // Oculta el canal del carrusel público de la landing sin desactivar la cuenta.
        [Column("is_hidden_from_carousel")]
        public bool IsHiddenFromCarousel { get; set; } = false;

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

        // Auth provider: 'twitch', 'discord', 'both', 'kick'
        [Column("auth_provider")]
        public string AuthProvider { get; set; } = "twitch";

        // Economy referral
        [Column("referral_code")]
        public string? ReferralCode { get; set; }

        // Kick identity — cada login de Kick es su propia fila (su propio "canal"),
        // igual que Twitch, no una identidad colgada de una fila existente como
        // Discord. Ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 8.5.
        [Column("kick_id")]
        public string? KickId { get; set; }

        [Column("kick_username")]
        public string? KickUsername { get; set; }

        [Column("kick_profile_pic")]
        public string? KickProfilePic { get; set; }

        [Column("kick_access_token")]
        public string? KickAccessToken { get; set; }

        [Column("kick_refresh_token")]
        public string? KickRefreshToken { get; set; }

        [Column("kick_token_expiration")]
        public DateTime? KickTokenExpiration { get; set; }

        // La persona real detras de este canal. Nullable a proposito — ver
        // Add_Accounts_Table.sql. Varias filas de "users" con el mismo
        // AccountId son la misma persona con varios canales vinculados.
        [Column("account_id")]
        public long? AccountId { get; set; }
    }
}