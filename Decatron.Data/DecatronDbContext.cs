using Decatron.Core.Models;
using Decatron.Core.Models.OAuth;
using Decatron.Data.Encryption;
using Decatron.Scripting.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TimerModel = Decatron.Core.Models.Timer;

namespace Decatron.Data
{
    public class DecatronDbContext : DbContext
    {
        private readonly string? _encryptionKey;

        public DecatronDbContext(DbContextOptions<DecatronDbContext> options, IConfiguration? configuration = null) : base(options)
        {
            _encryptionKey = configuration?["JwtSettings:SecretKey"];
        }

        public DbSet<User> Users { get; set; }
        public DbSet<SystemSettings> SystemSettings { get; set; }
        public DbSet<UserAccess> UserAccess { get; set; }
        public DbSet<ChatMessage> ChatMessages { get; set; }
        public DbSet<BotTokens> BotTokens { get; set; }
        public DbSet<CommandSettings> CommandSettings { get; set; }
        public DbSet<TitleHistory> TitleHistory { get; set; }
        public DbSet<GameHistory> GameHistory { get; set; }
        public DbSet<MicroGameCommands> MicroGameCommands { get; set; }
        public DbSet<Categories> Categories { get; set; }
        public DbSet<UserChannelPermissions> UserChannelPermissions { get; set; }
        public DbSet<CustomCommand> CustomCommands { get; set; }
        public DbSet<ScriptCommand> ScriptedCommands { get; set; }
        public DbSet<GameCache> GameCache { get; set; }
        public DbSet<GameAlias> GameAliases { get; set; }
        public DbSet<CommandCounter> CommandCounters { get; set; }
        public DbSet<CommandUses> CommandUses { get; set; }
        public DbSet<ShoutoutConfig> ShoutoutConfigs { get; set; }
        public DbSet<ShoutoutHistory> ShoutoutHistories { get; set; }
        public DbSet<GachaLinkedAccount> GachaLinkedAccounts { get; set; }
        public DbSet<TimerModel> Timers { get; set; }
        public DbSet<BannedWord> BannedWords { get; set; }
        public DbSet<ModerationConfig> ModerationConfigs { get; set; }
        public DbSet<UserStrike> UserStrikes { get; set; }
        public DbSet<ModerationLog> ModerationLogs { get; set; }
        public DbSet<SoundAlertConfig> SoundAlertConfigs { get; set; }
        public DbSet<SoundAlertFile> SoundAlertFiles { get; set; }
        public DbSet<SoundAlertHistory> SoundAlertHistories { get; set; }
        public DbSet<FollowAlertConfig> FollowAlertConfigs { get; set; }
        public DbSet<FollowAlertHistory> FollowAlertHistories { get; set; }
        public DbSet<ChannelFollower> ChannelFollowers { get; set; }
        public DbSet<FollowerHistory> FollowerHistories { get; set; }

        // Decatron IA
        public DbSet<SystemAdmin> SystemAdmins { get; set; }
        public DbSet<DecatronAIGlobalConfig> DecatronAIGlobalConfigs { get; set; }
        public DbSet<DecatronAIChannelPermission> DecatronAIChannelPermissions { get; set; }
        public DbSet<DecatronAIChannelConfig> DecatronAIChannelConfigs { get; set; }
        public DbSet<DecatronAIUsage> DecatronAIUsages { get; set; }

        // Decatron Chat
        public DbSet<DecatronChatPermission> DecatronChatPermissions { get; set; }
        public DbSet<DecatronChatConversation> DecatronChatConversations { get; set; }
        public DbSet<DecatronChatMessage> DecatronChatMessages { get; set; }
        public DbSet<DecatronChatConfig> DecatronChatConfigs { get; set; }

        // Timer Extension
        public DbSet<TimerConfig> TimerConfigs { get; set; }
        public DbSet<TimerState> TimerStates { get; set; }
        public DbSet<TimerMediaFile> TimerMediaFiles { get; set; }
        public DbSet<TimerEventLog> TimerEventLogs { get; set; }
        public DbSet<TimerSession> TimerSessions { get; set; }
        public DbSet<TimerEventCooldown> TimerEventCooldowns { get; set; }
        public DbSet<TimerTemplate> TimerTemplates { get; set; }
        public DbSet<TimerSchedule> TimerSchedules { get; set; }
        public DbSet<TimerHappyHour> TimerHappyHours { get; set; }
        public DbSet<TimerSessionBackup> TimerSessionBackups { get; set; } // Nuevo: Respaldos de emergencia

        // Raffles/Sorteos
        public DbSet<Raffle> Raffles { get; set; }
        public DbSet<RaffleParticipant> RaffleParticipants { get; set; }
        public DbSet<RaffleWinner> RaffleWinners { get; set; }

        // Giveaways System
        public DbSet<GiveawayConfig> GiveawayConfigs { get; set; }
        public DbSet<GiveawaySession> GiveawaySessions { get; set; }
        public DbSet<GiveawayParticipant> GiveawayParticipants { get; set; }
        public DbSet<GiveawayWinner> GiveawayWinners { get; set; }
        public DbSet<GiveawayWinnerCooldown> GiveawayWinnerCooldowns { get; set; }
        public DbSet<GiveawayBlacklist> GiveawayBlacklists { get; set; }

        // Stream Tracking (for giveaway requirements)
        public DbSet<StreamWatchTime> StreamWatchTimes { get; set; }
        public DbSet<StreamChatActivity> StreamChatActivities { get; set; }

        // Goals System
        public DbSet<GoalsConfig> GoalsConfigs { get; set; }
        public DbSet<GoalsProgressLog> GoalsProgressLogs { get; set; }

        // Event Alerts System
        public DbSet<EventAlertsConfig> EventAlertsConfigs { get; set; }
        public DbSet<TtsCacheEntry> TtsCacheEntries { get; set; }

        // Tips/Donations System
        public DbSet<TipsConfig> TipsConfigs { get; set; }
        public DbSet<TipHistory> TipsHistory { get; set; }

        // Now Playing / Music System
        public DbSet<NowPlayingConfig> NowPlayingConfigs { get; set; }

        // Supporters System
        public DbSet<DiscountCode> DiscountCodes { get; set; }
        public DbSet<SupporterPayment> SupporterPayments { get; set; }
        public DbSet<SupportersPageConfig> SupportersPageConfigs { get; set; }

        // Subscription Tiers
        public DbSet<UserSubscriptionTier> UserSubscriptionTiers { get; set; }
        public DbSet<TierFeature> TierFeatures { get; set; }
        public DbSet<TierHistory> TierHistories { get; set; }

        // OAuth2 System (API Pública)
        public DbSet<OAuthApplication> OAuthApplications { get; set; }
        public DbSet<OAuthAuthorizationCode> OAuthAuthorizationCodes { get; set; }
        public DbSet<OAuthAccessToken> OAuthAccessTokens { get; set; }
        public DbSet<OAuthRefreshToken> OAuthRefreshTokens { get; set; }

        // Discord Integration
        public DbSet<Decatron.Discord.Models.DiscordGuildConfig> DiscordGuildConfigs { get; set; }
        public DbSet<Decatron.Discord.Models.DiscordLiveAlert> DiscordLiveAlerts { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Apply encryption converter to sensitive token columns
            EncryptedStringConverter? encConverter = null;
            if (!string.IsNullOrEmpty(_encryptionKey))
            {
                encConverter = new EncryptedStringConverter(_encryptionKey);
            }

            // Users Configuration
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.TwitchId).IsRequired().HasMaxLength(50).HasColumnName("twitch_id");
                entity.Property(e => e.Login).IsRequired().HasMaxLength(100).HasColumnName("login");
                entity.Property(e => e.DisplayName).HasMaxLength(150).HasColumnName("display_name");
                entity.Property(e => e.Email).HasMaxLength(255).HasColumnName("email");
                entity.Property(e => e.ProfileImageUrl).HasMaxLength(500).HasColumnName("profile_image_url");
                entity.Property(e => e.OfflineImageUrl).HasMaxLength(500).HasColumnName("offline_image_url");
                entity.Property(e => e.BroadcasterType).HasMaxLength(50).HasColumnName("broadcaster_type");
                entity.Property(e => e.ViewCount).HasColumnName("view_count");
                entity.Property(e => e.Description).HasMaxLength(500).HasColumnName("description");
                entity.Property(e => e.AccessToken).IsRequired().HasMaxLength(2000).HasColumnName("access_token");
                entity.Property(e => e.RefreshToken).HasMaxLength(2000).HasColumnName("refresh_token");
                if (encConverter != null) { entity.Property(e => e.AccessToken).HasConversion(encConverter); entity.Property(e => e.RefreshToken).HasConversion(encConverter); }
                entity.Property(e => e.TokenExpiration).IsRequired().HasColumnName("token_expiration");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");
                entity.Property(e => e.IsActive).IsRequired().HasColumnName("is_active");
                entity.Property(e => e.UniqueId).HasMaxLength(50).HasColumnName("unique_id");

                entity.HasIndex(e => e.TwitchId).IsUnique();
                entity.HasIndex(e => e.Login).IsUnique();
                entity.HasIndex(e => e.Email);
                entity.HasIndex(e => e.UniqueId).IsUnique();

                entity.ToTable("users");
            });

            // SystemSettings Configuration
            modelBuilder.Entity<SystemSettings>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.BotEnabled).IsRequired().HasDefaultValue(true).HasColumnName("bot_enabled");
                entity.Property(e => e.CommandsEnabled).IsRequired().HasDefaultValue(true).HasColumnName("commands_enabled");
                entity.Property(e => e.CommandCooldown).IsRequired().HasDefaultValue(5).HasColumnName("command_cooldown");
                entity.Property(e => e.TimersEnabled).IsRequired().HasDefaultValue(true).HasColumnName("timers_enabled");
                entity.Property(e => e.TimerMinMessages).IsRequired().HasDefaultValue(5).HasColumnName("timer_min_messages");
                entity.Property(e => e.TimerGlobalCooldownSeconds).IsRequired().HasDefaultValue(30).HasColumnName("timer_global_cooldown_seconds");
                entity.Property(e => e.MessageCountSinceLastTimer).IsRequired().HasDefaultValue(0).HasColumnName("message_count_since_last_timer");
                entity.Property(e => e.AutoModerationEnabled).IsRequired().HasDefaultValue(true).HasColumnName("auto_moderation_enabled");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => e.UserId).IsUnique();
                entity.ToTable("system_settings");
            });

            // UserAccess Configuration
            modelBuilder.Entity<UserAccess>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.AuthorizedUserId).IsRequired().HasColumnName("authorized_user_id");
                entity.Property(e => e.PermissionLevel).IsRequired().HasMaxLength(50).HasColumnName("permission_level");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => e.UserId);
                entity.ToTable("user_access");
            });

            // ChatMessages Configuration
            modelBuilder.Entity<ChatMessage>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Channel).IsRequired().HasMaxLength(100).HasColumnName("channel");
                entity.Property(e => e.Username).IsRequired().HasMaxLength(100).HasColumnName("username");
                entity.Property(e => e.UserId).HasMaxLength(50).HasColumnName("user_id");
                entity.Property(e => e.Message).IsRequired().HasColumnName("message");
                entity.Property(e => e.Timestamp).IsRequired().HasColumnName("timestamp");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");

                entity.HasIndex(e => new { e.Channel, e.Timestamp });
                entity.HasIndex(e => e.Username);
                entity.ToTable("chat_messages");
            });

            modelBuilder.Entity<BotTokens>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.BotUsername).IsRequired().HasMaxLength(100).HasColumnName("bot_username");
                entity.Property(e => e.BotTwitchId).HasMaxLength(50).HasColumnName("bot_twitch_id");
                entity.Property(e => e.AccessToken).IsRequired().HasMaxLength(2000).HasColumnName("access_token");
                entity.Property(e => e.RefreshToken).HasMaxLength(2000).HasColumnName("refresh_token");
                entity.Property(e => e.ChatToken).IsRequired().HasMaxLength(2000).HasColumnName("chat_token");
                if (encConverter != null) { entity.Property(e => e.AccessToken).HasConversion(encConverter); entity.Property(e => e.RefreshToken).HasConversion(encConverter); entity.Property(e => e.ChatToken).HasConversion(encConverter); }
                entity.Property(e => e.TokenExpiration).HasColumnName("token_expiration");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");
                entity.Property(e => e.IsActive).IsRequired().HasColumnName("is_active");

                entity.HasIndex(e => e.BotUsername).IsUnique();
                entity.ToTable("bot_tokens");
            });

            // CommandSettings Configuration
            modelBuilder.Entity<CommandSettings>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.CommandName).IsRequired().HasMaxLength(100).HasColumnName("command_name");
                entity.Property(e => e.IsEnabled).IsRequired().HasDefaultValue(true).HasColumnName("is_enabled");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => new { e.UserId, e.CommandName }).IsUnique();
                entity.HasIndex(e => e.CommandName);
                entity.ToTable("command_settings");

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // TitleHistory Configuration
            modelBuilder.Entity<TitleHistory>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.ChannelLogin).IsRequired().HasMaxLength(100).HasColumnName("channel_login");
                entity.Property(e => e.Title).IsRequired().HasMaxLength(500).HasColumnName("title");
                entity.Property(e => e.ChangedBy).IsRequired().HasMaxLength(100).HasColumnName("changed_by");
                entity.Property(e => e.ChangedAt).IsRequired().HasColumnName("changed_at");

                entity.HasIndex(e => e.ChannelLogin).HasDatabaseName("idx_title_channel");
                entity.HasIndex(e => e.ChangedAt).HasDatabaseName("idx_title_date");
                entity.ToTable("title_history");
            });

            // GameHistory Configuration
            modelBuilder.Entity<GameHistory>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.ChannelLogin).IsRequired().HasMaxLength(100).HasColumnName("channel_login");
                entity.Property(e => e.CategoryName).IsRequired().HasMaxLength(500).HasColumnName("category_name");
                entity.Property(e => e.ChangedBy).IsRequired().HasMaxLength(100).HasColumnName("changed_by");
                entity.Property(e => e.ChangedAt).IsRequired().HasColumnName("changed_at");

                entity.HasIndex(e => e.ChannelLogin).HasDatabaseName("idx_game_channel");
                entity.HasIndex(e => e.ChangedAt).HasDatabaseName("idx_game_date");
                entity.ToTable("game_history");
            });

            // MicroGameCommands Configuration
            modelBuilder.Entity<MicroGameCommands>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.ShortCommand).IsRequired().HasMaxLength(100).HasColumnName("short_command");
                entity.Property(e => e.CategoryName).IsRequired().HasMaxLength(500).HasColumnName("category_name");
                entity.Property(e => e.CreatedBy).IsRequired().HasMaxLength(100).HasColumnName("created_by");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => new { e.ChannelName, e.ShortCommand }).IsUnique().HasDatabaseName("idx_micro_channel_command");
                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_micro_channel");
                entity.ToTable("micro_game_commands");
            });

            // Categories Configuration
            modelBuilder.Entity<Categories>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).IsRequired().HasMaxLength(255).HasColumnName("name");
                entity.Property(e => e.Priority).IsRequired().HasDefaultValue(0).HasColumnName("priority");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => e.Name).IsUnique().HasDatabaseName("idx_name");
                entity.HasIndex(e => e.Priority).HasDatabaseName("idx_priority");
                entity.ToTable("categories");
            });

            modelBuilder.Entity<UserChannelPermissions>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.ChannelOwnerId).IsRequired().HasColumnName("channel_owner_id");
                entity.Property(e => e.GrantedUserId).IsRequired().HasColumnName("granted_user_id");
                entity.Property(e => e.AccessLevel).IsRequired().HasMaxLength(50).HasColumnName("access_level");
                entity.Property(e => e.IsActive).IsRequired().HasDefaultValue(true).HasColumnName("is_active");
                entity.Property(e => e.GrantedBy).IsRequired().HasColumnName("granted_by");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasOne(e => e.ChannelOwner)
                    .WithMany()
                    .HasForeignKey(e => e.ChannelOwnerId)
                    .HasConstraintName("fk_user_channel_permissions_channel_owner")
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.GrantedUser)
                    .WithMany()
                    .HasForeignKey(e => e.GrantedUserId)
                    .HasConstraintName("fk_user_channel_permissions_granted_user")
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.GrantedByUser)
                    .WithMany()
                    .HasForeignKey(e => e.GrantedBy)
                    .HasConstraintName("fk_user_channel_permissions_granted_by")
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => new { e.ChannelOwnerId, e.GrantedUserId })
                    .IsUnique()
                    .HasDatabaseName("idx_channel_granted_user");

                entity.HasIndex(e => e.ChannelOwnerId).HasDatabaseName("idx_channel_owner");
                entity.HasIndex(e => e.GrantedUserId).HasDatabaseName("idx_granted_user");
                entity.HasIndex(e => e.AccessLevel).HasDatabaseName("idx_access_level");

                entity.ToTable("user_channel_permissions");
            });

            // CustomCommands Configuration
            modelBuilder.Entity<CustomCommand>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.CommandName).IsRequired().HasMaxLength(100).HasColumnName("command_name");
                entity.Property(e => e.Response).IsRequired().HasColumnName("response");
                entity.Property(e => e.Restriction).IsRequired().HasMaxLength(50).HasDefaultValue("all").HasColumnName("restriction");
                entity.Property(e => e.IsActive).IsRequired().HasDefaultValue(true).HasColumnName("is_active");
                entity.Property(e => e.CreatedBy).IsRequired().HasMaxLength(100).HasColumnName("created_by");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");
                entity.Property(e => e.IsScripted).IsRequired().HasDefaultValue(false).HasColumnName("is_scripted");
                entity.Property(e => e.ScriptContent).HasColumnName("script_content");

                entity.HasIndex(e => new { e.ChannelName, e.CommandName })
                    .IsUnique()
                    .HasDatabaseName("idx_channel_command");

                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_channel_name");
                entity.HasIndex(e => e.CommandName).HasDatabaseName("idx_command_name");
                entity.HasIndex(e => e.IsActive).HasDatabaseName("idx_is_active");

                entity.ToTable("custom_commands");
            });

            modelBuilder.Entity<ScriptCommand>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.CommandName).IsRequired().HasMaxLength(100).HasColumnName("command_name");
                entity.Property(e => e.ScriptContent).IsRequired().HasColumnName("script_content");
                entity.Property(e => e.IsActive).IsRequired().HasDefaultValue(true).HasColumnName("is_active");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => new { e.ChannelName, e.CommandName }).IsUnique();
                entity.ToTable("scripted_commands");
            });

            // GameCache Configuration
            modelBuilder.Entity<GameCache>(entity =>
            {
                entity.HasKey(e => e.GameId);
                entity.Property(e => e.GameId).IsRequired().HasMaxLength(50).HasColumnName("game_id");
                entity.Property(e => e.Name).IsRequired().HasMaxLength(255).HasColumnName("name");
                entity.Property(e => e.BoxArtUrl).HasMaxLength(500).HasColumnName("box_art_url");
                entity.Property(e => e.PopularityRank).IsRequired().HasColumnName("popularity_rank");
                entity.Property(e => e.UsageCount).IsRequired().HasDefaultValue(0).HasColumnName("usage_count");
                entity.Property(e => e.LastUpdated).IsRequired().HasColumnName("last_updated");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => e.Name).HasDatabaseName("idx_game_cache_name");
                entity.HasIndex(e => e.PopularityRank).HasDatabaseName("idx_game_cache_popularity");
                entity.HasIndex(e => e.UsageCount).HasDatabaseName("idx_game_cache_usage");
                entity.ToTable("game_cache");
            });

            // GameAlias Configuration
            modelBuilder.Entity<GameAlias>(entity =>
            {
                entity.HasKey(e => e.Alias);
                entity.Property(e => e.Alias).IsRequired().HasMaxLength(100).HasColumnName("alias");
                entity.Property(e => e.GameId).IsRequired().HasMaxLength(50).HasColumnName("game_id");
                entity.Property(e => e.GameName).IsRequired().HasMaxLength(255).HasColumnName("game_name");
                entity.Property(e => e.AliasType).IsRequired().HasMaxLength(20).HasDefaultValue("system").HasColumnName("alias_type");
                entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => e.GameId).HasDatabaseName("idx_game_alias_game_id");
                entity.HasIndex(e => e.AliasType).HasDatabaseName("idx_game_alias_type");

                entity.HasOne(e => e.Game)
                    .WithMany()
                    .HasForeignKey(e => e.GameId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.ToTable("game_aliases");
            });

            // CommandCounter Configuration
            modelBuilder.Entity<CommandCounter>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.CommandName).IsRequired().HasMaxLength(100).HasColumnName("command_name");
                entity.Property(e => e.CounterValue).IsRequired().HasDefaultValue(0).HasColumnName("counter_value");
                entity.Property(e => e.LastModifiedBy).HasMaxLength(100).HasColumnName("last_modified_by");
                entity.Property(e => e.LastModifiedAt).IsRequired().HasColumnName("last_modified_at");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => new { e.ChannelName, e.CommandName })
                    .IsUnique()
                    .HasDatabaseName("idx_counter_channel_command");

                entity.ToTable("command_counters");
            });

            // CommandUses Configuration
            modelBuilder.Entity<CommandUses>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.CommandName).IsRequired().HasMaxLength(100).HasColumnName("command_name");
                entity.Property(e => e.UseCount).IsRequired().HasDefaultValue(0).HasColumnName("use_count");
                entity.Property(e => e.LastUsedAt).IsRequired().HasColumnName("last_used_at");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => new { e.ChannelName, e.CommandName })
                    .IsUnique()
                    .HasDatabaseName("idx_uses_channel_command");

                entity.ToTable("command_uses");
            });

            // ShoutoutConfig Configuration
            modelBuilder.Entity<ShoutoutConfig>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Username).IsRequired().HasMaxLength(100).HasColumnName("username");
                entity.Property(e => e.Duration).IsRequired().HasColumnName("duration");
                entity.Property(e => e.Cooldown).IsRequired().HasColumnName("cooldown");
                entity.Property(e => e.ShowDebugTimer).IsRequired().HasColumnName("show_debug_timer");
                entity.Property(e => e.ShoutoutText).HasMaxLength(500).HasColumnName("shoutout_text");
                entity.Property(e => e.TextLines).IsRequired().HasColumnName("text_lines").HasColumnType("jsonb");
                entity.Property(e => e.Styles).IsRequired().HasColumnName("styles").HasColumnType("jsonb");
                entity.Property(e => e.Layout).IsRequired().HasColumnName("layout").HasColumnType("jsonb");
                entity.Property(e => e.AnimationType).IsRequired().HasMaxLength(50).HasColumnName("animation_type");
                entity.Property(e => e.AnimationSpeed).IsRequired().HasMaxLength(50).HasColumnName("animation_speed");
                entity.Property(e => e.TextOutlineEnabled).IsRequired().HasColumnName("text_outline_enabled");
                entity.Property(e => e.TextOutlineColor).IsRequired().HasMaxLength(50).HasColumnName("text_outline_color");
                entity.Property(e => e.TextOutlineWidth).IsRequired().HasColumnName("text_outline_width");
                entity.Property(e => e.ContainerBorderEnabled).IsRequired().HasColumnName("container_border_enabled");
                entity.Property(e => e.ContainerBorderColor).IsRequired().HasMaxLength(50).HasColumnName("container_border_color");
                entity.Property(e => e.ContainerBorderWidth).IsRequired().HasColumnName("container_border_width");
                entity.Property(e => e.Blacklist).IsRequired().HasColumnName("blacklist").HasColumnType("jsonb");
                entity.Property(e => e.Whitelist).IsRequired().HasColumnName("whitelist").HasColumnType("jsonb");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.ToTable("shoutout_configs");
            });

            // ShoutoutHistory Configuration
            modelBuilder.Entity<ShoutoutHistory>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.TargetUser).IsRequired().HasMaxLength(100).HasColumnName("target_user");
                entity.Property(e => e.ExecutedBy).IsRequired().HasMaxLength(100).HasColumnName("executed_by");
                entity.Property(e => e.ClipUrl).HasMaxLength(500).HasColumnName("clip_url");
                entity.Property(e => e.ClipId).HasMaxLength(100).HasColumnName("clip_id");
                entity.Property(e => e.ClipLocalPath).HasMaxLength(500).HasColumnName("clip_local_path");
                entity.Property(e => e.ProfileImageUrl).HasMaxLength(500).HasColumnName("profile_image_url");
                entity.Property(e => e.GameName).HasMaxLength(200).HasColumnName("game_name");
                entity.Property(e => e.ExecutedAt).IsRequired().HasColumnName("executed_at");

                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_shoutout_channel");
                entity.HasIndex(e => e.TargetUser).HasDatabaseName("idx_shoutout_target");
                entity.HasIndex(e => e.ExecutedAt).HasDatabaseName("idx_shoutout_date");

                entity.ToTable("shoutout_history");
            });

            // Timer Configuration
            modelBuilder.Entity<TimerModel>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.Name).IsRequired().HasMaxLength(100).HasColumnName("name");
                entity.Property(e => e.Message).IsRequired().HasMaxLength(500).HasColumnName("message");
                entity.Property(e => e.IntervalMinutes).IsRequired().HasColumnName("interval_minutes");
                entity.Property(e => e.IntervalMessages).IsRequired().HasColumnName("interval_messages");
                entity.Property(e => e.StreamStatus).IsRequired().HasMaxLength(20).HasColumnName("stream_status");
                entity.Property(e => e.Priority).IsRequired().HasColumnName("priority");
                entity.Property(e => e.IsActive).IsRequired().HasColumnName("is_active");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");
                entity.Property(e => e.CreatedBy).IsRequired().HasColumnName("created_by");
                entity.Property(e => e.LastExecutedAt).HasColumnName("last_executed_at");
                entity.Property(e => e.ExecutionCount).IsRequired().HasColumnName("execution_count");
                entity.Property(e => e.MessagesSinceLastExecution).IsRequired().HasColumnName("messages_since_last_execution");
                entity.Property(e => e.CategoryName).HasMaxLength(255).HasColumnName("category_name");

                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_timer_channel");
                entity.HasIndex(e => e.IsActive).HasDatabaseName("idx_timer_active");
                entity.HasIndex(e => e.Priority).HasDatabaseName("idx_timer_priority");
                entity.HasIndex(e => new { e.ChannelName, e.IsActive }).HasDatabaseName("idx_timer_channel_active");

                entity.HasOne(e => e.CreatedByUser)
                    .WithMany()
                    .HasForeignKey(e => e.CreatedBy)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.ToTable("timers");
            });

            // BannedWord Configuration
            modelBuilder.Entity<BannedWord>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.Word).IsRequired().HasMaxLength(500).HasColumnName("word");
                entity.Property(e => e.Severity).IsRequired().HasMaxLength(20).HasColumnName("severity");
                entity.Property(e => e.Detections).IsRequired().HasColumnName("detections");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => new { e.ChannelName, e.Word })
                    .IsUnique()
                    .HasDatabaseName("idx_banned_word_channel_word");
                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_banned_word_channel");

                entity.ToTable("banned_words");
            });

            // ModerationConfig Configuration
            modelBuilder.Entity<ModerationConfig>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.VipImmunity).IsRequired().HasMaxLength(20).HasColumnName("vip_immunity");
                entity.Property(e => e.SubImmunity).IsRequired().HasMaxLength(20).HasColumnName("sub_immunity");
                entity.Property(e => e.WhitelistUsers).IsRequired().HasColumnName("whitelist_users").HasColumnType("jsonb");
                entity.Property(e => e.WarningMessage).IsRequired().HasMaxLength(500).HasColumnName("warning_message");
                entity.Property(e => e.StrikeExpiration).IsRequired().HasMaxLength(20).HasColumnName("strike_expiration");
                entity.Property(e => e.Strike1Action).IsRequired().HasMaxLength(20).HasColumnName("strike1_action");
                entity.Property(e => e.Strike2Action).IsRequired().HasMaxLength(20).HasColumnName("strike2_action");
                entity.Property(e => e.Strike3Action).IsRequired().HasMaxLength(20).HasColumnName("strike3_action");
                entity.Property(e => e.Strike4Action).IsRequired().HasMaxLength(20).HasColumnName("strike4_action");
                entity.Property(e => e.Strike5Action).IsRequired().HasMaxLength(20).HasColumnName("strike5_action");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => e.ChannelName)
                    .IsUnique()
                    .HasDatabaseName("idx_moderation_config_channel");

                entity.ToTable("moderation_configs");
            });

            // UserStrike Configuration
            modelBuilder.Entity<UserStrike>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.Username).IsRequired().HasMaxLength(100).HasColumnName("username");
                entity.Property(e => e.StrikeLevel).IsRequired().HasColumnName("strike_level");
                entity.Property(e => e.LastInfractionAt).IsRequired().HasColumnName("last_infraction_at");
                entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => new { e.ChannelName, e.Username })
                    .IsUnique()
                    .HasDatabaseName("idx_user_strike_channel_user");
                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_user_strike_channel");

                entity.ToTable("user_strikes");
            });

            // ModerationLog Configuration
            modelBuilder.Entity<ModerationLog>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.Username).IsRequired().HasMaxLength(100).HasColumnName("username");
                entity.Property(e => e.DetectedWord).IsRequired().HasMaxLength(500).HasColumnName("detected_word");
                entity.Property(e => e.Severity).IsRequired().HasMaxLength(20).HasColumnName("severity");
                entity.Property(e => e.ActionTaken).IsRequired().HasMaxLength(50).HasColumnName("action_taken");
                entity.Property(e => e.StrikeLevel).IsRequired().HasColumnName("strike_level");
                entity.Property(e => e.FullMessage).HasColumnName("full_message");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_moderation_log_channel");
                entity.HasIndex(e => e.CreatedAt).HasDatabaseName("idx_moderation_log_date");
                entity.HasIndex(e => new { e.ChannelName, e.CreatedAt }).HasDatabaseName("idx_moderation_log_channel_date");

                entity.ToTable("moderation_logs");
            });

            // SoundAlertConfig Configuration
            modelBuilder.Entity<SoundAlertConfig>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Username).IsRequired().HasMaxLength(100).HasColumnName("username");
                entity.Property(e => e.GlobalVolume).IsRequired().HasColumnName("global_volume");
                entity.Property(e => e.GlobalEnabled).IsRequired().HasColumnName("global_enabled");
                entity.Property(e => e.Duration).IsRequired().HasColumnName("duration");
                entity.Property(e => e.TextLines).IsRequired().HasColumnName("text_lines").HasColumnType("jsonb");
                entity.Property(e => e.Styles).IsRequired().HasColumnName("styles").HasColumnType("jsonb");
                entity.Property(e => e.Layout).IsRequired().HasColumnName("layout").HasColumnType("jsonb");
                entity.Property(e => e.AnimationType).IsRequired().HasMaxLength(50).HasColumnName("animation_type");
                entity.Property(e => e.AnimationSpeed).IsRequired().HasMaxLength(50).HasColumnName("animation_speed");
                entity.Property(e => e.TextOutlineEnabled).IsRequired().HasColumnName("text_outline_enabled");
                entity.Property(e => e.TextOutlineColor).IsRequired().HasMaxLength(50).HasColumnName("text_outline_color");
                entity.Property(e => e.TextOutlineWidth).IsRequired().HasColumnName("text_outline_width");
                entity.Property(e => e.CooldownMs).IsRequired().HasColumnName("cooldown_ms");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => e.Username)
                    .IsUnique()
                    .HasDatabaseName("idx_sound_alert_config_username");

                entity.ToTable("sound_alert_configs");
            });

            // SoundAlertFile Configuration
            modelBuilder.Entity<SoundAlertFile>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Username).IsRequired().HasMaxLength(100).HasColumnName("username");
                entity.Property(e => e.RewardId).IsRequired().HasMaxLength(100).HasColumnName("reward_id");
                entity.Property(e => e.RewardTitle).IsRequired().HasMaxLength(200).HasColumnName("reward_title");
                entity.Property(e => e.FileType).IsRequired().HasMaxLength(20).HasColumnName("file_type");
                entity.Property(e => e.FilePath).IsRequired().HasMaxLength(500).HasColumnName("file_path");
                entity.Property(e => e.FileName).IsRequired().HasMaxLength(255).HasColumnName("file_name");
                entity.Property(e => e.FileSize).IsRequired().HasColumnName("file_size");
                entity.Property(e => e.DurationSeconds).IsRequired().HasColumnName("duration_seconds");
                entity.Property(e => e.Volume).HasColumnName("volume");
                entity.Property(e => e.Enabled).IsRequired().HasColumnName("enabled");
                entity.Property(e => e.PlayCount).IsRequired().HasColumnName("play_count");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => new { e.Username, e.RewardId })
                    .IsUnique()
                    .HasDatabaseName("idx_sound_alert_file_username_reward");
                entity.HasIndex(e => e.Username).HasDatabaseName("idx_sound_alert_file_username");
                entity.HasIndex(e => e.RewardId).HasDatabaseName("idx_sound_alert_file_reward");

                entity.ToTable("sound_alert_files");
            });

            // SoundAlertHistory Configuration
            modelBuilder.Entity<SoundAlertHistory>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.RewardId).IsRequired().HasMaxLength(100).HasColumnName("reward_id");
                entity.Property(e => e.RewardTitle).IsRequired().HasMaxLength(200).HasColumnName("reward_title");
                entity.Property(e => e.FilePath).HasMaxLength(500).HasColumnName("file_path");
                entity.Property(e => e.RedeemedBy).IsRequired().HasMaxLength(100).HasColumnName("redeemed_by");
                entity.Property(e => e.RedeemedById).HasMaxLength(100).HasColumnName("redeemed_by_id");
                entity.Property(e => e.RedeemedAt).IsRequired().HasColumnName("redeemed_at");
                entity.Property(e => e.PlayedSuccessfully).IsRequired().HasColumnName("played_successfully");
                entity.Property(e => e.ErrorMessage).HasMaxLength(500).HasColumnName("error_message");

                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_sound_alert_history_channel");
                entity.HasIndex(e => e.RedeemedAt).HasDatabaseName("idx_sound_alert_history_date");
                entity.HasIndex(e => new { e.ChannelName, e.RedeemedAt }).HasDatabaseName("idx_sound_alert_history_channel_date");

                entity.ToTable("sound_alert_history");
            });

            // SystemAdmin Configuration
            modelBuilder.Entity<SystemAdmin>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.Username).IsRequired().HasMaxLength(100).HasColumnName("username");
                entity.Property(e => e.Role).IsRequired().HasMaxLength(50).HasColumnName("role");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => e.UserId).IsUnique();
                entity.HasIndex(e => e.Username);

                entity.ToTable("system_admins");
            });

            // DecatronAIGlobalConfig Configuration
            modelBuilder.Entity<DecatronAIGlobalConfig>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Enabled).IsRequired().HasColumnName("enabled");
                entity.Property(e => e.Model).IsRequired().HasMaxLength(100).HasColumnName("model");
                entity.Property(e => e.MaxTokens).IsRequired().HasColumnName("max_tokens");
                entity.Property(e => e.SystemPrompt).IsRequired().HasColumnName("system_prompt");
                entity.Property(e => e.ResponsePrefix).IsRequired().HasMaxLength(100).HasColumnName("response_prefix");
                entity.Property(e => e.GlobalCooldownSeconds).IsRequired().HasColumnName("global_cooldown_seconds");
                entity.Property(e => e.MinChannelCooldownSeconds).IsRequired().HasColumnName("min_channel_cooldown_seconds");
                entity.Property(e => e.DefaultChannelCooldownSeconds).IsRequired().HasColumnName("default_channel_cooldown_seconds");
                entity.Property(e => e.MaxPromptLength).IsRequired().HasColumnName("max_prompt_length");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.ToTable("decatron_ai_global_config");
            });

            // DecatronAIChannelPermission Configuration
            modelBuilder.Entity<DecatronAIChannelPermission>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.Enabled).IsRequired().HasColumnName("enabled");
                entity.Property(e => e.CanConfigure).IsRequired().HasColumnName("can_configure");
                entity.Property(e => e.Notes).HasColumnName("notes");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => e.ChannelName).IsUnique();

                entity.ToTable("decatron_ai_channel_permissions");
            });

            // DecatronAIChannelConfig Configuration
            modelBuilder.Entity<DecatronAIChannelConfig>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.PermissionLevel).IsRequired().HasMaxLength(50).HasColumnName("permission_level");
                entity.Property(e => e.WhitelistEnabled).IsRequired().HasColumnName("whitelist_enabled");
                entity.Property(e => e.WhitelistUsers).HasColumnName("whitelist_users");
                entity.Property(e => e.BlacklistUsers).HasColumnName("blacklist_users");
                entity.Property(e => e.ChannelCooldownSeconds).IsRequired().HasColumnName("channel_cooldown_seconds");
                entity.Property(e => e.UserCooldownSeconds).HasColumnName("user_cooldown_seconds");
                entity.Property(e => e.CustomPrefix).HasMaxLength(100).HasColumnName("custom_prefix");
                entity.Property(e => e.CustomSystemPrompt).HasColumnName("custom_system_prompt");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => e.ChannelName).IsUnique();

                entity.ToTable("decatron_ai_channel_config");
            });

            // DecatronAIUsage Configuration
            modelBuilder.Entity<DecatronAIUsage>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.Username).IsRequired().HasMaxLength(100).HasColumnName("username");
                entity.Property(e => e.Prompt).IsRequired().HasColumnName("prompt");
                entity.Property(e => e.Response).HasColumnName("response");
                entity.Property(e => e.TokensUsed).IsRequired().HasColumnName("tokens_used");
                entity.Property(e => e.ResponseTimeMs).IsRequired().HasColumnName("response_time_ms");
                entity.Property(e => e.Success).IsRequired().HasColumnName("success");
                entity.Property(e => e.ErrorMessage).HasColumnName("error_message");
                entity.Property(e => e.UsedAt).IsRequired().HasColumnName("used_at");

                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_decatron_ai_usage_channel");
                entity.HasIndex(e => e.UsedAt).HasDatabaseName("idx_decatron_ai_usage_date");
                entity.HasIndex(e => new { e.ChannelName, e.UsedAt }).HasDatabaseName("idx_decatron_ai_usage_channel_date");

                entity.ToTable("decatron_ai_usage");
            });

            // DecatronChatPermission Configuration
            modelBuilder.Entity<DecatronChatPermission>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.ChannelOwnerId).IsRequired().HasColumnName("channel_owner_id");
                entity.Property(e => e.CanView).IsRequired().HasColumnName("can_view");
                entity.Property(e => e.CanChat).IsRequired().HasColumnName("can_chat");
                entity.Property(e => e.GrantedBy).IsRequired().HasColumnName("granted_by");
                entity.Property(e => e.Notes).HasColumnName("notes");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => new { e.ChannelOwnerId, e.UserId })
                    .IsUnique()
                    .HasDatabaseName("idx_chat_permission_channel_user");
                entity.HasIndex(e => e.ChannelOwnerId).HasDatabaseName("idx_chat_permission_channel");

                entity.ToTable("decatron_chat_permissions");
            });

            // DecatronChatConversation Configuration
            modelBuilder.Entity<DecatronChatConversation>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.ChannelOwnerId).IsRequired().HasColumnName("channel_owner_id");
                entity.Property(e => e.Title).IsRequired().HasMaxLength(200).HasColumnName("title");
                entity.Property(e => e.MessageCount).IsRequired().HasColumnName("message_count");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => new { e.ChannelOwnerId, e.UserId, e.CreatedAt })
                    .HasDatabaseName("idx_chat_conversation_channel_user_date");
                entity.HasIndex(e => e.UserId).HasDatabaseName("idx_chat_conversation_user");

                entity.ToTable("decatron_chat_conversations");
            });

            // DecatronChatMessage Configuration
            modelBuilder.Entity<DecatronChatMessage>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ConversationId).IsRequired().HasColumnName("conversation_id");
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.Role).IsRequired().HasMaxLength(20).HasColumnName("role");
                entity.Property(e => e.Content).IsRequired().HasColumnName("content");
                entity.Property(e => e.TokensUsed).IsRequired().HasColumnName("tokens_used");
                entity.Property(e => e.ResponseTimeMs).IsRequired().HasColumnName("response_time_ms");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => new { e.ConversationId, e.CreatedAt })
                    .HasDatabaseName("idx_chat_message_conversation_date");
                entity.HasIndex(e => e.ConversationId).HasDatabaseName("idx_chat_message_conversation");

                entity.ToTable("decatron_chat_messages");
            });

            // DecatronChatConfig Configuration
            modelBuilder.Entity<DecatronChatConfig>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Enabled).IsRequired().HasColumnName("enabled");
                entity.Property(e => e.AIProvider).IsRequired().HasMaxLength(50).HasColumnName("ai_provider");
                entity.Property(e => e.FallbackEnabled).IsRequired().HasColumnName("fallback_enabled");
                entity.Property(e => e.Model).IsRequired().HasMaxLength(100).HasColumnName("model");
                entity.Property(e => e.OpenRouterModel).HasMaxLength(100).HasColumnName("openrouter_model");
                entity.Property(e => e.MaxTokens).IsRequired().HasColumnName("max_tokens");
                entity.Property(e => e.SystemPrompt).IsRequired().HasColumnName("system_prompt");
                entity.Property(e => e.MaxConversationsPerUser).IsRequired().HasColumnName("max_conversations_per_user");
                entity.Property(e => e.MaxMessagesPerConversation).IsRequired().HasColumnName("max_messages_per_conversation");
                entity.Property(e => e.ContextMessages).IsRequired().HasColumnName("context_messages");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.ToTable("decatron_chat_config");
            });

            // FollowAlertConfig Configuration
            modelBuilder.Entity<FollowAlertConfig>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.Enabled).IsRequired().HasColumnName("enabled");
                entity.Property(e => e.Message).IsRequired().HasMaxLength(500).HasColumnName("message");
                entity.Property(e => e.CooldownMinutes).IsRequired().HasColumnName("cooldown_minutes");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => e.ChannelName)
                    .IsUnique()
                    .HasDatabaseName("idx_follow_alert_config_channel");

                entity.ToTable("follow_alert_configs");
            });

            // FollowAlertHistory Configuration
            modelBuilder.Entity<FollowAlertHistory>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.FollowerUsername).IsRequired().HasMaxLength(100).HasColumnName("follower_username");
                entity.Property(e => e.FollowedAt).IsRequired().HasColumnName("followed_at");
                entity.Property(e => e.MessageSent).IsRequired().HasColumnName("message_sent");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_follow_alert_history_channel");
                entity.HasIndex(e => e.FollowedAt).HasDatabaseName("idx_follow_alert_history_date");
                entity.HasIndex(e => new { e.ChannelName, e.FollowedAt }).HasDatabaseName("idx_follow_alert_history_channel_date");

                entity.ToTable("follow_alert_history");
            });

            // ChannelFollower Configuration
            modelBuilder.Entity<ChannelFollower>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.BroadcasterId).IsRequired().HasMaxLength(50).HasColumnName("broadcaster_id");
                entity.Property(e => e.BroadcasterName).IsRequired().HasMaxLength(100).HasColumnName("broadcaster_name");
                entity.Property(e => e.UserId).IsRequired().HasMaxLength(50).HasColumnName("user_id");
                entity.Property(e => e.UserName).IsRequired().HasMaxLength(150).HasColumnName("user_name");
                entity.Property(e => e.UserLogin).IsRequired().HasMaxLength(100).HasColumnName("user_login");
                entity.Property(e => e.FollowedAt).IsRequired().HasColumnName("followed_at");
                entity.Property(e => e.AccountCreatedAt).HasColumnName("account_created_at");
                entity.Property(e => e.IsFollowing).IsRequired().HasDefaultValue(0).HasColumnName("is_following");
                entity.Property(e => e.UnfollowedAt).HasColumnName("unfollowed_at");
                entity.Property(e => e.IsBlocked).IsRequired().HasDefaultValue(0).HasColumnName("is_blocked");
                entity.Property(e => e.WasBlocked).IsRequired().HasDefaultValue(0).HasColumnName("was_blocked");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                // Índice único para evitar duplicados
                entity.HasIndex(e => new { e.BroadcasterId, e.UserId })
                    .IsUnique()
                    .HasDatabaseName("idx_channel_followers_broadcaster_user");

                // Índices para búsquedas
                entity.HasIndex(e => e.BroadcasterId).HasDatabaseName("idx_channel_followers_broadcaster");
                entity.HasIndex(e => e.UserId).HasDatabaseName("idx_channel_followers_user");
                entity.HasIndex(e => e.IsFollowing).HasDatabaseName("idx_channel_followers_status");
                entity.HasIndex(e => e.FollowedAt).HasDatabaseName("idx_channel_followers_date");

                entity.ToTable("channel_followers");
            });

            // FollowerHistory Configuration
            modelBuilder.Entity<FollowerHistory>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.BroadcasterId).IsRequired().HasMaxLength(50).HasColumnName("broadcaster_id");
                entity.Property(e => e.UserId).IsRequired().HasMaxLength(50).HasColumnName("user_id");
                entity.Property(e => e.Action).IsRequired().HasColumnName("action");
                entity.Property(e => e.ActionTimestamp).IsRequired().HasColumnName("action_timestamp");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                // Índices para búsquedas
                entity.HasIndex(e => new { e.BroadcasterId, e.UserId })
                    .HasDatabaseName("idx_follower_history_broadcaster_user");

                entity.HasIndex(e => e.BroadcasterId).HasDatabaseName("idx_follower_history_broadcaster");
                entity.HasIndex(e => e.ActionTimestamp).HasDatabaseName("idx_follower_history_timestamp");

                entity.ToTable("follower_history");
            });

            // TimerConfig Configuration
            modelBuilder.Entity<TimerConfig>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.DefaultDuration).IsRequired().HasColumnName("default_duration");
                entity.Property(e => e.AutoStart).IsRequired().HasColumnName("auto_start");
                entity.Property(e => e.DisplayConfig).IsRequired().HasColumnName("display_config").HasColumnType("jsonb");
                entity.Property(e => e.ProgressBarConfig).IsRequired().HasColumnName("progressbar_config").HasColumnType("jsonb");
                entity.Property(e => e.StyleConfig).IsRequired().HasColumnName("style_config").HasColumnType("jsonb");
                entity.Property(e => e.AnimationConfig).IsRequired().HasColumnName("animation_config").HasColumnType("jsonb");
                entity.Property(e => e.ThemeConfig).IsRequired().HasColumnName("theme_config").HasColumnType("jsonb");
                entity.Property(e => e.EventsConfig).IsRequired().HasColumnName("events_config").HasColumnType("jsonb");
                entity.Property(e => e.CommandsConfig).IsRequired().HasColumnName("commands_config").HasColumnType("jsonb");
                entity.Property(e => e.AlertsConfig).IsRequired().HasColumnName("alerts_config").HasColumnType("jsonb");
                entity.Property(e => e.GoalConfig).IsRequired().HasColumnName("goal_config").HasColumnType("jsonb");
                entity.Property(e => e.AdvancedConfig).IsRequired().HasColumnName("advanced_config").HasColumnType("jsonb");
                entity.Property(e => e.HistoryConfig).IsRequired().HasColumnName("history_config").HasColumnType("jsonb");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => e.ChannelName).IsUnique().HasDatabaseName("idx_timer_config_channel");
                entity.HasIndex(e => e.UserId).HasDatabaseName("idx_timer_config_user");

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.ToTable("timer_configs");
            });

            // TimerState Configuration
            modelBuilder.Entity<TimerState>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20).HasColumnName("status");
                entity.Property(e => e.CurrentTime).IsRequired().HasColumnName("time_remaining");
                entity.Property(e => e.TotalTime).IsRequired().HasColumnName("total_time");
                entity.Property(e => e.StartedAt).HasColumnName("started_at");
                entity.Property(e => e.PausedAt).HasColumnName("paused_at");
                entity.Property(e => e.StoppedAt).HasColumnName("stopped_at");
                entity.Property(e => e.ElapsedPausedTime).IsRequired().HasColumnName("elapsed_paused_time");
                entity.Property(e => e.IsVisible).IsRequired().HasColumnName("is_visible");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => e.ChannelName).IsUnique().HasDatabaseName("idx_timer_state_channel");
                entity.HasIndex(e => e.Status).HasDatabaseName("idx_timer_state_status");

                entity.ToTable("timer_states");
            });

            // TimerMediaFile Configuration
            modelBuilder.Entity<TimerMediaFile>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.FileType).IsRequired().HasMaxLength(20).HasColumnName("file_type");
                entity.Property(e => e.FilePath).IsRequired().HasMaxLength(500).HasColumnName("file_path");
                entity.Property(e => e.FileName).IsRequired().HasMaxLength(255).HasColumnName("file_name");
                entity.Property(e => e.FileSize).IsRequired().HasColumnName("file_size");
                entity.Property(e => e.DurationSeconds).HasColumnName("duration_seconds");
                entity.Property(e => e.UploadedAt).IsRequired().HasColumnName("uploaded_at");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_timer_media_channel");
                entity.HasIndex(e => e.FileType).HasDatabaseName("idx_timer_media_type");
                entity.HasIndex(e => new { e.ChannelName, e.FileType }).HasDatabaseName("idx_timer_media_channel_type");

                entity.ToTable("timer_media_files");
            });

            // TimerEventLog Configuration
            modelBuilder.Entity<TimerEventLog>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.EventType).IsRequired().HasMaxLength(50).HasColumnName("event_type");
                entity.Property(e => e.Username).IsRequired().HasMaxLength(100).HasColumnName("username");
                entity.Property(e => e.UserId).HasMaxLength(50).HasColumnName("user_id");
                entity.Property(e => e.TimeAdded).IsRequired().HasColumnName("time_added");
                entity.Property(e => e.Details).HasMaxLength(500).HasColumnName("details");
                entity.Property(e => e.EventData).HasColumnName("event_data").HasColumnType("jsonb");
                entity.Property(e => e.OccurredAt).IsRequired().HasColumnName("occurred_at");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_timer_event_log_channel");
                entity.HasIndex(e => e.EventType).HasDatabaseName("idx_timer_event_log_type");
                entity.HasIndex(e => e.OccurredAt).HasDatabaseName("idx_timer_event_log_date");
                entity.HasIndex(e => new { e.ChannelName, e.OccurredAt }).HasDatabaseName("idx_timer_event_log_channel_date");
                entity.HasIndex(e => e.TimerSessionId).HasDatabaseName("idx_timer_event_log_session");

                entity.HasOne(e => e.TimerSession)
                    .WithMany(s => s.Logs)
                    .HasForeignKey(e => e.TimerSessionId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.ToTable("timer_event_logs");
            });

            // TimerSession Configuration
            modelBuilder.Entity<TimerSession>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.StartedAt).IsRequired().HasColumnName("started_at");
                entity.Property(e => e.EndedAt).HasColumnName("ended_at");
                entity.Property(e => e.InitialDuration).IsRequired().HasColumnName("initial_duration");
                entity.Property(e => e.TotalAddedTime).IsRequired().HasDefaultValue(0).HasColumnName("total_added_time");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_timer_session_channel");
                entity.HasIndex(e => e.StartedAt).HasDatabaseName("idx_timer_session_start");
                entity.HasIndex(e => new { e.ChannelName, e.StartedAt }).HasDatabaseName("idx_timer_session_channel_start");

                entity.ToTable("timer_sessions");
            });
            // Raffle Configuration
            modelBuilder.Entity<Raffle>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.Name).IsRequired().HasMaxLength(200).HasColumnName("name");
                entity.Property(e => e.Description).HasMaxLength(500).HasColumnName("description");
                entity.Property(e => e.WinnersCount).IsRequired().HasDefaultValue(1).HasColumnName("winners_count");
                entity.Property(e => e.Status).IsRequired().HasMaxLength(20).HasDefaultValue("open").HasColumnName("status");
                entity.Property(e => e.ConfigJson).IsRequired().HasColumnName("config_json").HasColumnType("jsonb");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");
                entity.Property(e => e.ClosedAt).HasColumnName("closed_at");
                entity.Property(e => e.DrawnAt).HasColumnName("drawn_at");
                entity.Property(e => e.CreatedBy).IsRequired().HasColumnName("created_by");
                entity.Property(e => e.TotalParticipants).IsRequired().HasDefaultValue(0).HasColumnName("total_participants");
                entity.Property(e => e.TotalTickets).IsRequired().HasDefaultValue(0).HasColumnName("total_tickets");

                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_raffles_channel_name");
                entity.HasIndex(e => e.Status).HasDatabaseName("idx_raffles_status");
                entity.HasIndex(e => e.CreatedAt).HasDatabaseName("idx_raffles_created_at");
                entity.HasIndex(e => e.CreatedBy).HasDatabaseName("idx_raffles_created_by");

                entity.ToTable("raffles");
            });

            // RaffleParticipant Configuration
            modelBuilder.Entity<RaffleParticipant>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.RaffleId).IsRequired().HasColumnName("raffle_id");
                entity.Property(e => e.Username).IsRequired().HasMaxLength(100).HasColumnName("username");
                entity.Property(e => e.TwitchUserId).HasColumnName("twitch_user_id");
                entity.Property(e => e.Tickets).IsRequired().HasDefaultValue(1).HasColumnName("tickets");
                entity.Property(e => e.EntryMethod).IsRequired().HasMaxLength(50).HasDefaultValue("command").HasColumnName("entry_method");
                entity.Property(e => e.MetadataJson).HasColumnName("metadata_json").HasColumnType("jsonb");
                entity.Property(e => e.JoinedAt).IsRequired().HasColumnName("joined_at");
                entity.Property(e => e.IsDisqualified).IsRequired().HasDefaultValue(false).HasColumnName("is_disqualified");
                entity.Property(e => e.DisqualificationReason).HasMaxLength(255).HasColumnName("disqualification_reason");

                entity.HasIndex(e => e.RaffleId).HasDatabaseName("idx_raffle_participants_raffle_id");
                entity.HasIndex(e => e.Username).HasDatabaseName("idx_raffle_participants_username");

                entity.HasOne(e => e.Raffle)
                    .WithMany(r => r.Participants)
                    .HasForeignKey(e => e.RaffleId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.ToTable("raffle_participants");
            });

            // RaffleWinner Configuration
            modelBuilder.Entity<RaffleWinner>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.RaffleId).IsRequired().HasColumnName("raffle_id");
                entity.Property(e => e.ParticipantId).IsRequired().HasColumnName("participant_id");
                entity.Property(e => e.Username).IsRequired().HasMaxLength(100).HasColumnName("username");
                entity.Property(e => e.Position).IsRequired().HasColumnName("position");
                entity.Property(e => e.WonAt).IsRequired().HasColumnName("won_at");
                entity.Property(e => e.HasConfirmed).IsRequired().HasDefaultValue(false).HasColumnName("has_confirmed");
                entity.Property(e => e.ConfirmedAt).HasColumnName("confirmed_at");
                entity.Property(e => e.WasRerolled).IsRequired().HasDefaultValue(false).HasColumnName("was_rerolled");
                entity.Property(e => e.RerollReason).HasMaxLength(255).HasColumnName("reroll_reason");

                entity.HasIndex(e => e.RaffleId).HasDatabaseName("idx_raffle_winners_raffle_id");
                entity.HasIndex(e => e.ParticipantId).HasDatabaseName("idx_raffle_winners_participant_id");

                entity.HasOne(e => e.Raffle)
                    .WithMany(r => r.Winners)
                    .HasForeignKey(e => e.RaffleId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Participant)
                    .WithMany()
                    .HasForeignKey(e => e.ParticipantId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.ToTable("raffle_winners");
            });

            // TipsConfig Configuration
            modelBuilder.Entity<TipsConfig>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.IsEnabled).IsRequired().HasColumnName("is_enabled");
                entity.Property(e => e.PayPalEmail).HasMaxLength(2000).HasColumnName("paypal_email");
                if (encConverter != null) { entity.Property(e => e.PayPalEmail).HasConversion(encConverter); }
                entity.Property(e => e.PayPalConnected).IsRequired().HasColumnName("paypal_connected");
                entity.Property(e => e.Currency).IsRequired().HasMaxLength(10).HasColumnName("currency");
                entity.Property(e => e.MinAmount).IsRequired().HasColumnName("min_amount");
                entity.Property(e => e.MaxAmount).IsRequired().HasColumnName("max_amount");
                entity.Property(e => e.SuggestedAmounts).IsRequired().HasMaxLength(100).HasColumnName("suggested_amounts");
                entity.Property(e => e.PageTitle).IsRequired().HasMaxLength(200).HasColumnName("page_title");
                entity.Property(e => e.PageDescription).HasMaxLength(1000).HasColumnName("page_description");
                entity.Property(e => e.PageAccentColor).IsRequired().HasMaxLength(50).HasColumnName("page_accent_color");
                entity.Property(e => e.PageBackgroundImage).HasMaxLength(500).HasColumnName("page_background_image");
                entity.Property(e => e.AlertConfig).IsRequired().HasColumnName("alert_config").HasColumnType("jsonb");
                entity.Property(e => e.TimerIntegrationEnabled).IsRequired().HasColumnName("timer_integration_enabled");
                entity.Property(e => e.SecondsPerCurrency).IsRequired().HasColumnName("seconds_per_currency");
                entity.Property(e => e.TimeUnit).IsRequired().HasMaxLength(20).HasColumnName("time_unit").HasDefaultValue("seconds");
                entity.Property(e => e.MaxMessageLength).IsRequired().HasColumnName("max_message_length");
                entity.Property(e => e.CooldownSeconds).IsRequired().HasColumnName("cooldown_seconds");
                entity.Property(e => e.BadWordsFilter).IsRequired().HasColumnName("bad_words_filter");
                entity.Property(e => e.RequireMessage).IsRequired().HasColumnName("require_message");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).IsRequired().HasColumnName("updated_at");

                entity.HasIndex(e => e.ChannelName).IsUnique().HasDatabaseName("idx_tips_config_channel");
                entity.HasIndex(e => e.UserId).HasDatabaseName("idx_tips_config_user");

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.ToTable("tips_configs");
            });

            // TipHistory Configuration
            modelBuilder.Entity<TipHistory>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChannelName).IsRequired().HasMaxLength(100).HasColumnName("channel_name");
                entity.Property(e => e.DonorName).IsRequired().HasMaxLength(100).HasColumnName("donor_name");
                entity.Property(e => e.DonorEmail).HasMaxLength(255).HasColumnName("donor_email");
                entity.Property(e => e.Amount).IsRequired().HasColumnName("amount");
                entity.Property(e => e.Currency).IsRequired().HasMaxLength(10).HasColumnName("currency");
                entity.Property(e => e.Message).HasMaxLength(500).HasColumnName("message");
                entity.Property(e => e.PayPalTransactionId).HasMaxLength(100).HasColumnName("paypal_transaction_id");
                entity.Property(e => e.Status).IsRequired().HasMaxLength(50).HasColumnName("status");
                entity.Property(e => e.TimeAdded).IsRequired().HasColumnName("time_added");
                entity.Property(e => e.AlertShown).IsRequired().HasColumnName("alert_shown");
                entity.Property(e => e.DonatedAt).IsRequired().HasColumnName("donated_at");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => e.ChannelName).HasDatabaseName("idx_tips_history_channel");
                entity.HasIndex(e => e.DonatedAt).HasDatabaseName("idx_tips_history_date");
                entity.HasIndex(e => new { e.ChannelName, e.DonatedAt }).HasDatabaseName("idx_tips_history_channel_date");
                entity.HasIndex(e => e.PayPalTransactionId).HasDatabaseName("idx_tips_history_transaction");

                entity.ToTable("tips_history");
            });

            // ═══════════════════════════════════════════════════════════════════
            // OAuth2 System Configurations
            // ═══════════════════════════════════════════════════════════════════

            // OAuthApplication Configuration
            modelBuilder.Entity<OAuthApplication>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.OwnerId).IsRequired().HasColumnName("owner_id");
                entity.Property(e => e.Name).IsRequired().HasMaxLength(100).HasColumnName("name");
                entity.Property(e => e.Description).HasMaxLength(1000).HasColumnName("description");
                entity.Property(e => e.ClientId).IsRequired().HasMaxLength(50).HasColumnName("client_id");
                entity.Property(e => e.ClientSecretHash).IsRequired().HasMaxLength(255).HasColumnName("client_secret_hash");
                entity.Property(e => e.RedirectUris).IsRequired().HasColumnName("redirect_uris");
                entity.Property(e => e.Scopes).IsRequired().HasColumnName("scopes");
                entity.Property(e => e.IconUrl).HasMaxLength(500).HasColumnName("icon_url");
                entity.Property(e => e.WebsiteUrl).HasMaxLength(500).HasColumnName("website_url");
                entity.Property(e => e.IsActive).IsRequired().HasDefaultValue(true).HasColumnName("is_active");
                entity.Property(e => e.IsVerified).IsRequired().HasDefaultValue(false).HasColumnName("is_verified");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

                entity.HasIndex(e => e.ClientId).IsUnique().HasDatabaseName("idx_oauth_apps_client_id");
                entity.HasIndex(e => e.OwnerId).HasDatabaseName("idx_oauth_apps_owner");

                entity.HasOne(e => e.Owner)
                    .WithMany()
                    .HasForeignKey(e => e.OwnerId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.ToTable("oauth_applications");
            });

            // OAuthAuthorizationCode Configuration
            modelBuilder.Entity<OAuthAuthorizationCode>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Code).IsRequired().HasMaxLength(64).HasColumnName("code");
                entity.Property(e => e.ApplicationId).IsRequired().HasColumnName("application_id");
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.Scopes).IsRequired().HasColumnName("scopes");
                entity.Property(e => e.RedirectUri).IsRequired().HasMaxLength(500).HasColumnName("redirect_uri");
                entity.Property(e => e.CodeChallenge).HasMaxLength(128).HasColumnName("code_challenge");
                entity.Property(e => e.CodeChallengeMethod).HasMaxLength(10).HasColumnName("code_challenge_method");
                entity.Property(e => e.State).HasMaxLength(128).HasColumnName("state");
                entity.Property(e => e.ExpiresAt).IsRequired().HasColumnName("expires_at");
                entity.Property(e => e.Used).IsRequired().HasDefaultValue(false).HasColumnName("used");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");

                entity.HasIndex(e => e.Code).IsUnique().HasDatabaseName("idx_oauth_codes_code");
                entity.HasIndex(e => e.ExpiresAt).HasDatabaseName("idx_oauth_codes_expires");

                entity.HasOne(e => e.Application)
                    .WithMany(a => a.AuthorizationCodes)
                    .HasForeignKey(e => e.ApplicationId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.ToTable("oauth_authorization_codes");
            });

            // OAuthAccessToken Configuration
            modelBuilder.Entity<OAuthAccessToken>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Token).IsRequired().HasMaxLength(64).HasColumnName("token");
                entity.Property(e => e.ApplicationId).IsRequired().HasColumnName("application_id");
                entity.Property(e => e.UserId).IsRequired().HasColumnName("user_id");
                entity.Property(e => e.Scopes).IsRequired().HasColumnName("scopes");
                entity.Property(e => e.ExpiresAt).IsRequired().HasColumnName("expires_at");
                entity.Property(e => e.Revoked).IsRequired().HasDefaultValue(false).HasColumnName("revoked");
                entity.Property(e => e.RevokedReason).HasMaxLength(255).HasColumnName("revoked_reason");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.IpAddress).HasMaxLength(45).HasColumnName("ip_address");
                entity.Property(e => e.UserAgent).HasMaxLength(500).HasColumnName("user_agent");

                entity.HasIndex(e => e.Token).IsUnique().HasDatabaseName("idx_oauth_tokens_token");
                entity.HasIndex(e => e.UserId).HasDatabaseName("idx_oauth_tokens_user");
                entity.HasIndex(e => e.ApplicationId).HasDatabaseName("idx_oauth_tokens_app");

                entity.HasOne(e => e.Application)
                    .WithMany(a => a.AccessTokens)
                    .HasForeignKey(e => e.ApplicationId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.ToTable("oauth_access_tokens");
            });

            // OAuthRefreshToken Configuration
            modelBuilder.Entity<OAuthRefreshToken>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Token).IsRequired().HasMaxLength(64).HasColumnName("token");
                entity.Property(e => e.AccessTokenId).IsRequired().HasColumnName("access_token_id");
                entity.Property(e => e.ExpiresAt).IsRequired().HasColumnName("expires_at");
                entity.Property(e => e.Revoked).IsRequired().HasDefaultValue(false).HasColumnName("revoked");
                entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("created_at");
                entity.Property(e => e.UsedAt).HasColumnName("used_at");

                entity.HasIndex(e => e.Token).IsUnique().HasDatabaseName("idx_oauth_refresh_token");
                entity.HasIndex(e => e.AccessTokenId).HasDatabaseName("idx_oauth_refresh_access");

                entity.HasOne(e => e.AccessToken)
                    .WithMany()
                    .HasForeignKey(e => e.AccessTokenId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.ToTable("oauth_refresh_tokens");
            });

            // Supporters System
            modelBuilder.Entity<DiscountCode>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Code).IsRequired().HasMaxLength(50).HasColumnName("code");
                entity.Property(e => e.DiscountType).IsRequired().HasMaxLength(10).HasColumnName("discount_type");
                entity.Property(e => e.DiscountValue).HasColumnType("decimal(10,2)").HasColumnName("discount_value");
                entity.Property(e => e.AppliesTo).HasMaxLength(20).HasColumnName("applies_to");
                entity.Property(e => e.MaxUses).HasColumnName("max_uses");
                entity.Property(e => e.UsedCount).HasDefaultValue(0).HasColumnName("used_count");
                entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
                entity.Property(e => e.Active).HasDefaultValue(true).HasColumnName("active");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.HasIndex(e => e.Code).IsUnique().HasDatabaseName("idx_discount_codes_code");
                entity.ToTable("discount_codes");
            });

            // Encrypt Spotify tokens in NowPlayingConfigs
            if (encConverter != null)
            {
                modelBuilder.Entity<NowPlayingConfig>(entity =>
                {
                    entity.Property(e => e.SpotifyAccessToken).HasConversion(encConverter);
                    entity.Property(e => e.SpotifyRefreshToken).HasConversion(encConverter);
                });
            }

            // Supporter Payments
            modelBuilder.Entity<SupporterPayment>(entity =>
            {
                entity.HasIndex(e => e.UserId).HasDatabaseName("idx_supporter_payments_user");
                entity.HasIndex(e => e.CapturedAt).HasDatabaseName("idx_supporter_payments_captured");
            });

            // User Subscription Tiers
            modelBuilder.Entity<UserSubscriptionTier>(entity =>
            {
                entity.HasIndex(e => e.UserId).IsUnique();
                entity.HasIndex(e => e.Tier).HasDatabaseName("idx_user_tier");
                entity.HasIndex(e => e.TierExpiresAt).HasDatabaseName("idx_tier_expires");
                entity.HasIndex(e => e.Source).HasDatabaseName("idx_tier_source");
                entity.HasOne(e => e.User).WithOne().HasForeignKey<UserSubscriptionTier>(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(e => e.GrantedByUser).WithMany().HasForeignKey(e => e.GrantedBy).OnDelete(DeleteBehavior.SetNull);
            });

            // Tier Features
            modelBuilder.Entity<TierFeature>(entity =>
            {
                entity.HasIndex(e => e.Tier).HasDatabaseName("idx_tier_feature_tier");
                entity.HasIndex(e => e.FeatureKey).HasDatabaseName("idx_tier_feature_key");
                entity.HasIndex(e => new { e.Tier, e.FeatureKey }).IsUnique();
            });

            // Tier History
            modelBuilder.Entity<TierHistory>(entity =>
            {
                entity.HasIndex(e => e.UserId).HasDatabaseName("idx_tier_history_user");
                entity.HasIndex(e => e.ChangedAt).HasDatabaseName("idx_tier_history_date");
                entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(e => e.ChangedByUser).WithMany().HasForeignKey(e => e.ChangedBy).OnDelete(DeleteBehavior.SetNull);
            });
        }
    }
}