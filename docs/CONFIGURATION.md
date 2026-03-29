# Configuration Reference

Complete reference for all Decatron v2 configuration options, environment variables, application settings, Twitch setup, and database configuration.

---

## Table of Contents

- [Overview](#overview)
- [Configuration Files](#configuration-files)
- [Environment Variables and Secrets](#environment-variables-and-secrets)
- [appsettings.json Structure](#appsettingsjson-structure)
- [Twitch Setup](#twitch-setup)
- [Database Setup](#database-setup)
- [AWS Polly (TTS)](#aws-polly-tts)
- [PayPal Integration](#paypal-integration)
- [Spotify Integration](#spotify-integration)
- [CORS Configuration](#cors-configuration)
- [Static File Paths](#static-file-paths)
- [Background Services](#background-services)
- [Session and Authentication](#session-and-authentication)
- [Permission System](#permission-system)
- [Logging Configuration](#logging-configuration)

---

## Overview

Decatron v2 is built on ASP.NET Core 8 and uses a layered configuration system:

1. **`appsettings.json`** -- Public configuration (logging, allowed hosts, Twitch scopes)
2. **`appsettings.Secrets.json`** -- Private credentials (not committed to source control)
3. **`appsettings.Secrets.{Environment}.json`** -- Environment-specific overrides (staging, production)
4. **Environment variables** -- Can override any setting using the standard ASP.NET Core pattern

Configuration is loaded at startup in `Program.cs` and bound to strongly-typed settings classes via `IOptions<T>`.

```mermaid
flowchart TD
    A[appsettings.json] --> D[Configuration Builder]
    B[appsettings.Secrets.json] --> D
    C[Environment Variables] --> D
    D --> E[IConfiguration]
    E --> F[JwtSettings]
    E --> G[TwitchSettings]
    E --> H[AwsPollySettings]
    E --> I[GachaSettings]
    E --> J[ConnectionStrings]

    style D fill:#0f3460,stroke:#e94560,color:#eee
    style E fill:#0f3460,stroke:#e94560,color:#eee
```

---

## Configuration Files

### appsettings.json (committed to repo)

This file contains non-sensitive settings that are safe to share:

```json
{
  "TwitchSettings": {
    "Scopes": "user:read:email chat:edit chat:read channel:manage:broadcast channel:read:subscriptions bits:read channel:read:redemptions moderator:manage:banned_users moderator:manage:chat_messages moderator:read:followers channel:manage:raids user:write:chat"
  },
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "System": "Warning"
      }
    },
    "WriteTo": [
      { "Name": "Console" },
      {
        "Name": "File",
        "Args": {
          "path": "logs/decatron-.log",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 30
        }
      }
    ]
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

### appsettings.Secrets.json (NOT in source control)

This file must be created manually on each deployment. It contains all credentials and connection strings.

---

## Environment Variables and Secrets

All secrets are configured in `appsettings.Secrets.json` or via environment variables. The table below shows every required and optional setting.

### Required Settings

| Setting Path | Type | Description |
|-------------|------|-------------|
| `ConnectionStrings:DefaultConnection` | string | PostgreSQL connection string |
| `JwtSettings:SecretKey` | string | Secret key for signing JWT tokens (minimum 32 characters recommended) |
| `JwtSettings:ExpiryMinutes` | int | JWT token lifetime in minutes |
| `JwtSettings:RefreshTokenExpiryDays` | int | Refresh token lifetime in days |
| `TwitchSettings:ClientId` | string | Twitch application Client ID |
| `TwitchSettings:ClientSecret` | string | Twitch application Client Secret |
| `TwitchSettings:BotToken` | string | OAuth token for the bot's Twitch account |
| `TwitchSettings:BotUsername` | string | Twitch username of the bot account |
| `TwitchSettings:ChannelId` | string | Twitch ID of the primary channel |
| `TwitchSettings:RedirectUri` | string | OAuth redirect URI (e.g., `https://yourdomain.com/api/auth/callback`) |

### Optional Settings

| Setting Path | Type | Default | Description |
|-------------|------|---------|-------------|
| `TwitchSettings:FrontendUrl` | string | `http://localhost:5173` | URL of the React frontend |
| `TwitchSettings:WebhookSecret` | string | -- | Secret for verifying generic webhooks |
| `TwitchSettings:EventSubWebhookSecret` | string | -- | Secret for HMAC verification of EventSub webhooks |
| `TwitchSettings:EventSubWebhookUrl` | string | -- | Public URL where Twitch sends EventSub notifications |
| `TwitchSettings:EventSubWebhookPort` | int | `7264` | Port for the EventSub webhook endpoint |
| `AwsPolly:AccessKeyId` | string | -- | AWS access key for Amazon Polly TTS |
| `AwsPolly:SecretAccessKey` | string | -- | AWS secret key for Amazon Polly TTS |
| `AwsPolly:Region` | string | `us-east-1` | AWS region for Polly |
| `AwsPolly:CachePath` | string | `/var/www/html/decatron/tts-cache` | Local disk path for TTS audio cache |
| `GachaSettings:WebUrl` | string | `http://localhost:3000` | URL of the GachaVerse frontend |
| `GachaSettings:BotUsername` | string | `decatronstreambot` | GachaVerse bot username |
| `PayPal:ClientId` | string | -- | PayPal application Client ID |
| `PayPal:ClientSecret` | string | -- | PayPal application Client Secret |
| `PayPal:Mode` | string | -- | `sandbox` or `live` |
| `Spotify:ClientId` | string | -- | Spotify application Client ID |
| `Spotify:ClientSecret` | string | -- | Spotify application Client Secret |
| `Spotify:RedirectUri` | string | -- | Spotify OAuth redirect URI |
| `LastFm:ApiKey` | string | -- | Last.fm API key for Now Playing |

### Example appsettings.Secrets.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=decatron;Username=decatron_user;Password=YOUR_PASSWORD"
  },
  "JwtSettings": {
    "SecretKey": "your-secret-key-at-least-32-characters-long",
    "ExpiryMinutes": 60,
    "RefreshTokenExpiryDays": 30
  },
  "TwitchSettings": {
    "ClientId": "your_twitch_client_id",
    "ClientSecret": "your_twitch_client_secret",
    "BotToken": "oauth:your_bot_token",
    "BotUsername": "your_bot_username",
    "ChannelId": "12345678",
    "RedirectUri": "https://yourdomain.com/api/auth/callback",
    "FrontendUrl": "https://yourdomain.com",
    "EventSubWebhookSecret": "your_eventsub_secret",
    "EventSubWebhookUrl": "https://yourdomain.com/api/twitch/webhook"
  },
  "AwsPolly": {
    "AccessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "Region": "us-east-1",
    "CachePath": "/var/www/html/decatron/tts-cache"
  }
}
```

---

## appsettings.json Structure

### Settings Classes

The configuration is bound to these strongly-typed C# classes:

#### JwtSettings (`Decatron.Core/Settings/JwtSettings.cs`)

```csharp
public class JwtSettings
{
    public string SecretKey { get; set; }
    public int ExpiryMinutes { get; set; }
    public int RefreshTokenExpiryDays { get; set; }
}
```

#### TwitchSettings (`Decatron.Core/Settings/TwitchSettings.cs`)

```csharp
public class TwitchSettings
{
    public string ClientId { get; set; }
    public string ClientSecret { get; set; }
    public string BotToken { get; set; }
    public string BotUsername { get; set; }
    public string ChannelId { get; set; }
    public string RedirectUri { get; set; }
    public string Scopes { get; set; }
    public string FrontendUrl { get; set; }           // default: http://localhost:5173
    public string WebhookSecret { get; set; }
    public string EventSubWebhookSecret { get; set; }
    public string EventSubWebhookUrl { get; set; }
    public int EventSubWebhookPort { get; set; }       // default: 7264
}
```

#### AwsPollySettings (`Decatron.Core/Settings/AwsPollySettings.cs`)

```csharp
public class AwsPollySettings
{
    public string AccessKeyId { get; set; }
    public string SecretAccessKey { get; set; }
    public string Region { get; set; }                 // default: us-east-1
    public string CachePath { get; set; }              // default: /var/www/html/decatron/tts-cache
}
```

#### GachaSettings (`Decatron.Core/Settings/GachaSettings.cs`)

```csharp
public class GachaSettings
{
    public string WebUrl { get; set; }                 // default: http://localhost:3000
    public string BotUsername { get; set; }             // default: decatronstreambot
}
```

---

## Twitch Setup

### Step 1: Create a Twitch Application

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Click **Register Your Application**.
3. Fill in:
   - **Name:** Your bot name (e.g., "Decatron Bot")
   - **OAuth Redirect URLs:** `https://yourdomain.com/api/auth/callback`
   - **Category:** Chat Bot
4. Note the **Client ID**.
5. Generate and note the **Client Secret**.

### Step 2: Create a Bot Account

1. Create a separate Twitch account for the bot.
2. Generate an OAuth token for the bot account with the required scopes (see below).
3. Note the bot's **username** and **channel ID** (numeric Twitch user ID).

### Step 3: Required Twitch Scopes

The following scopes are required for full functionality:

| Scope | Used For |
|-------|----------|
| `user:read:email` | Reading user email during OAuth login |
| `chat:edit` | Sending messages to chat |
| `chat:read` | Reading chat messages |
| `channel:manage:broadcast` | Changing stream title and category |
| `channel:read:subscriptions` | Reading subscriber data |
| `bits:read` | Reading bits/cheers events |
| `channel:read:redemptions` | Reading Channel Points redemptions |
| `moderator:manage:banned_users` | Banning/unbanning users |
| `moderator:manage:chat_messages` | Deleting chat messages |
| `moderator:read:followers` | Reading follower data |
| `channel:manage:raids` | Managing raids |
| `user:write:chat` | Sending chat messages via Helix API |

### Step 4: EventSub Webhook Configuration

EventSub is used for real-time Twitch event notifications. The webhook endpoint must be publicly accessible.

1. Set `TwitchSettings:EventSubWebhookUrl` to your public webhook URL:
   ```
   https://yourdomain.com/api/twitch/webhook
   ```
2. Set `TwitchSettings:EventSubWebhookSecret` to a random secret string (used for HMAC-SHA256 verification).
3. Ensure the endpoint is accessible from the internet (Twitch sends HTTP POST requests).

### EventSub Subscriptions

The following EventSub subscriptions are automatically registered per user at login:

| Subscription Type | Event |
|-------------------|-------|
| `channel.chat.message` | Chat messages |
| `channel.channel_points_custom_reward_redemption.add` | Channel Points redemptions |
| `channel.follow` | New followers |
| `channel.cheer` | Bits/cheers |
| `channel.subscribe` | New subscriptions |
| `channel.subscription.gift` | Gift subscriptions |
| `channel.subscription.message` | Resub messages |
| `channel.raid` | Incoming raids |
| `channel.hype_train.begin` | Hype train start |
| `stream.online` | Stream goes live |
| `stream.offline` | Stream goes offline |

### EventSub Webhook Verification

Twitch verifies webhooks using HMAC-SHA256. The verification flow:

```mermaid
sequenceDiagram
    participant Twitch
    participant Decatron as TwitchWebhookController

    Twitch->>Decatron: POST /api/twitch/webhook (challenge)
    Decatron->>Decatron: Verify HMAC signature
    Decatron-->>Twitch: 200 OK (challenge response)

    Note over Twitch,Decatron: Subscription is now active

    Twitch->>Decatron: POST /api/twitch/webhook (notification)
    Decatron->>Decatron: Verify HMAC signature
    Decatron->>Decatron: Dispatch to handler
    Decatron-->>Twitch: 200 OK
```

---

## Database Setup

### PostgreSQL Requirements

- **Version:** PostgreSQL 14+
- **Extensions:** None required (standard PostgreSQL)
- **Character set:** UTF-8

### Connection String Format

```
Host=localhost;Port=5432;Database=decatron;Username=decatron_user;Password=YOUR_PASSWORD
```

### Initial Setup

1. **Create the database and user:**

```sql
CREATE USER decatron_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE decatron OWNER decatron_user;
GRANT ALL PRIVILEGES ON DATABASE decatron TO decatron_user;
```

2. **Run the application.** EF Core auto-creates all tables on first startup (Code-First). No manual migrations are needed.

3. **Seed data.** On first startup, `Program.cs` automatically seeds the database with initial data.

### Database Schema Overview

The database contains 78 tables organized into these categories:

```mermaid
erDiagram
    users ||--o{ user_channel_permissions : has
    users ||--o{ bot_tokens : manages
    users ||--o{ timer_configs : configures
    users ||--o{ event_alerts_configs : configures
    users ||--o{ tips_configs : configures
    users ||--o{ oauth_applications : creates
    users ||--o{ giveaway_configs : creates

    timer_configs ||--o{ timer_states : has
    timer_configs ||--o{ timer_sessions : tracks
    timer_sessions ||--o{ timer_event_logs : contains
    timer_sessions ||--o{ timer_session_backups : backed_by

    giveaway_configs ||--o{ giveaway_sessions : runs
    giveaway_sessions ||--o{ giveaway_participants : has
    giveaway_sessions ||--o{ giveaway_winners : selects

    oauth_applications ||--o{ oauth_authorization_codes : issues
    oauth_applications ||--o{ oauth_access_tokens : grants
    oauth_access_tokens ||--o{ oauth_refresh_tokens : refreshed_by
```

### Table Categories

| Category | Tables | Description |
|----------|--------|-------------|
| **Users & Auth** | `users`, `bot_tokens`, `user_channel_permissions`, `user_access`, `system_admins`, `system_settings` | User accounts, permissions, bot tokens |
| **OAuth2** | `oauth_applications`, `oauth_authorization_codes`, `oauth_access_tokens`, `oauth_refresh_tokens` | Developer API OAuth system |
| **Commands** | `custom_commands`, `scripted_commands`, `micro_game_commands`, `command_settings`, `command_counters`, `command_uses` | Bot commands and scripting |
| **Timer** | `timer_configs`, `timer_states`, `timer_sessions`, `timer_session_backups`, `timer_event_logs`, `timer_event_cooldowns`, `timer_schedules`, `timer_happyhour`, `timer_templates`, `timer_media_files`, `timers` | Timer Extension + message timers |
| **Alerts** | `event_alerts_configs`, `sound_alert_configs`, `sound_alert_files`, `sound_alert_history`, `follow_alert_configs`, `follow_alert_history` | Event and sound alert systems |
| **Overlays** | `shoutout_configs`, `shoutout_history`, `now_playing_configs`, `goals_configs`, `goals_progress_logs` | Overlay configurations |
| **Giveaways** | `giveaway_configs`, `giveaway_sessions`, `giveaway_participants`, `giveaway_winners`, `giveaway_winner_cooldowns`, `giveaway_blacklist`, `raffles`, `raffle_participants`, `raffle_winners` | Giveaway and raffle systems |
| **Tips** | `tips_configs`, `tips_history` | Donation system |
| **Moderation** | `banned_words`, `moderation_configs`, `moderation_logs`, `user_strikes` | Chat moderation |
| **AI/Chat** | `decatron_ai_global_config`, `decatron_ai_channel_config`, `decatron_ai_channel_permissions`, `decatron_ai_usage`, `decatron_chat_config`, `decatron_chat_conversations`, `decatron_chat_messages`, `decatron_chat_permissions` | AI and private chat features |
| **Streaming** | `game_cache`, `game_aliases`, `game_history`, `title_history`, `categories`, `stream_watch_times`, `stream_chat_activities`, `channel_followers`, `follower_history` | Stream data and tracking |
| **Misc** | `tts_cache_entries`, `discount_codes`, `gacha_linked_accounts`, `chat_messages` | TTS cache, promo codes, integrations |
| **Tiers** | `user_subscription_tiers`, `tier_features`, `tier_history`, `supporter_payments`, `supporters_page_config` | Subscription tier system (managed externally) |

### Database Naming Convention

- All table names use **snake_case** (e.g., `timer_event_logs`)
- All column names use **snake_case** (e.g., `channel_name`, `created_at`)
- Primary keys are named `id` (bigint/serial)
- Foreign keys follow the pattern `{referenced_table_singular}_id`
- Timestamps use `created_at`, `updated_at` (UTC)
- JSON/JSONB columns are used for flexible configuration storage (e.g., `event_alerts_configs.config`)

### Key Indexes

The database has 296 indexes. The most indexed tables:

| Table | Index Count | Reason |
|-------|-------------|--------|
| `decatron_ai_usage` | 6 | Frequent queries by channel, user, date |
| `channel_followers` | 6 | Lookups by channel + user, follower status |
| `user_channel_permissions` | 6 | Permission checks on every authenticated request |
| `oauth_access_tokens` | 6 | Token validation on every API request |
| `timer_states` | 5 | Frequent state lookups during timer operation |

---

## AWS Polly (TTS)

Amazon Polly is used for Text-to-Speech in event alerts, timer alerts, and tips alerts.

### Configuration

| Setting | Description |
|---------|-------------|
| `AwsPolly:AccessKeyId` | Your AWS IAM access key with Polly permissions |
| `AwsPolly:SecretAccessKey` | Your AWS IAM secret key |
| `AwsPolly:Region` | AWS region (default: `us-east-1`) |
| `AwsPolly:CachePath` | Local directory for caching generated audio files |

### Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech",
        "polly:DescribeVoices"
      ],
      "Resource": "*"
    }
  ]
}
```

### TTS Caching

TTS audio is cached using a SHA-256 hash of the normalized text content:
1. Generate hash from `text.Trim().ToLowerInvariant()`
2. Check database (`tts_cache_entries`) for existing entry
3. If cached and file exists on disk, return cached URL
4. If not cached, call Polly API, save MP3 to disk, upsert cache entry
5. Return public URL: `/tts-audio/{hash}.mp3`

### Fallback Behavior

If AWS credentials are not configured, the system creates a Polly client with anonymous credentials. TTS generation calls will fail at runtime but the application will start normally. All TTS-dependent features (event alert TTS, timer TTS, tips TTS) will gracefully skip TTS generation.

---

## PayPal Integration

PayPal is used for the Tips/Donations system. Payments go directly to the streamer's PayPal account.

### Configuration

| Setting | Description |
|---------|-------------|
| `PayPal:ClientId` | PayPal REST API Client ID |
| `PayPal:ClientSecret` | PayPal REST API Client Secret |
| `PayPal:Mode` | `sandbox` for testing, `live` for production |

### Setup Flow

1. The streamer connects their PayPal account via OAuth from the Tips configuration page.
2. The OAuth callback captures the streamer's PayPal email.
3. When a viewer donates, the payment is sent directly to the streamer's PayPal email (the streamer is the `payee`).
4. Decatron acts as the intermediary that creates and captures the order via the PayPal API.

---

## Spotify Integration

Spotify is an optional provider for the Now Playing overlay.

### Configuration

| Setting | Description |
|---------|-------------|
| `Spotify:ClientId` | Spotify Developer application Client ID |
| `Spotify:ClientSecret` | Spotify Developer application Client Secret |
| `Spotify:RedirectUri` | OAuth callback URL (e.g., `https://yourdomain.com/api/spotify/callback`) |

### Setup

1. Create a Spotify Developer application at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add the redirect URI to the application settings.
3. Configure the Client ID, Secret, and Redirect URI in `appsettings.Secrets.json`.

---

## CORS Configuration

CORS origins are configured in `Program.cs`. The following origins are allowed:

| Origin | Environment |
|--------|-------------|
| `http://localhost:5173` | Development (Vite dev server) |
| `https://twitch.decatron.net` | Production (Twitch subdomain) |
| `https://decatron.net` | Production (main domain) |
| `https://www.decatron.net` | Production (www subdomain) |

CORS policy allows:
- Any HTTP method
- Any header
- Credentials (cookies, authorization headers)

To add custom origins, modify the CORS policy in `Program.cs`:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins(
            "http://localhost:5173",
            "https://your-custom-domain.com"
        )
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials();
    });
});
```

---

## Static File Paths

Decatron serves static files from several directories. These paths are configured in `Program.cs`:

| URL Path | Physical Path | Description |
|----------|---------------|-------------|
| `/downloads/*` | `ClientApp/public/downloads` | Downloaded Twitch clips (for shoutouts) |
| `/uploads/soundalerts/*` | `ClientApp/public/uploads/soundalerts` | Uploaded sound alert media files |
| `/timerextensible/*` | `ClientApp/public/timerextensible` | Timer extension media files |
| `/tts-audio/*` | `{AwsPolly:CachePath}` (default: `/var/www/html/decatron/tts-cache`) | Generated TTS audio cache |
| `/system-files/*` | `ClientApp/public/system-files` | Pre-loaded system media files |

Ensure these directories exist and have appropriate write permissions for the application user.

---

## Background Services

Decatron launches 9 background services at startup:

| Service | Interval | Description |
|---------|----------|-------------|
| `BotTokenRefreshBackgroundService` | 30 minutes | Refreshes bot OAuth tokens expiring within 7 days |
| `UserTokenRefreshBackgroundService` | 30 minutes | Refreshes user OAuth tokens expiring within 7 days |
| `GameCacheUpdateService` | Periodic | Updates local game/category cache from Twitch API |
| `TimerBackgroundService` | 1 second | Timer ticks, auto-pause schedules, auto-save backups, message timer execution |
| `EventSubBackgroundService` | Startup + periodic | Registers EventSub subscriptions for all active users |
| `TimerStateRestorationService` | Startup | Restores active timer states after server restart |
| `GiveawayBackgroundService` | 5 seconds | Auto-finalize giveaways, process winner timeouts, promote backups |
| `NowPlayingBackgroundService` | 3 seconds | Polls Last.fm/Spotify for all active Now Playing channels |
| `StreamStatusService` | Periodic | Monitors stream online/offline status, auto-pause/resume timers |

### Startup Sequence

```mermaid
flowchart TD
    A[Application Start] --> B[Configure Services DI]
    B --> C[Build Pipeline]
    C --> D[Seed Database]
    D --> E[Refresh Bot Tokens]
    E --> F[Verify yt-dlp Installation]
    F --> G[Start Twitch Bot]
    G --> H[Launch Background Services]
    H --> I[Application Ready]

    style A fill:#1a1a2e,stroke:#e94560,color:#eee
    style I fill:#1a1a2e,stroke:#16c79a,color:#eee
```

---

## Session and Authentication

### JWT Configuration

Decatron uses JWT Bearer authentication for the API:

| Parameter | Description |
|-----------|-------------|
| Token type | JWT Bearer |
| Signing algorithm | HMAC-SHA256 |
| Token location | `Authorization: Bearer {token}` header |
| Issuer validation | Disabled (configurable) |
| Audience validation | Disabled (configurable) |
| Clock skew | Default (5 minutes) |

### JWT Claims

| Claim | Description |
|-------|-------------|
| `sub` / `NameIdentifier` | User ID (numeric) |
| `Name` | Twitch display name |
| `Login` | Twitch login (lowercase) |
| `TwitchId` | Twitch user ID |
| `Email` | User email |
| `ProfileImage` | Profile image URL |
| `ChannelOwnerId` | Active channel ID (injected by middleware) |

### Session Storage

ASP.NET Core sessions are used to store the active channel context for multi-channel management:

| Key | Type | Description |
|-----|------|-------------|
| `ActiveChannelId` | string | The ID of the channel the user is currently managing |

Sessions use in-memory distributed cache (`AddDistributedMemoryCache`). Sessions are lost on server restart.

### Dual Authentication Scheme

The application supports two authentication schemes:

1. **JWT Bearer** -- For the web dashboard and standard API calls
2. **OAuth2 Bearer** -- For third-party API access via the public OAuth2 system

```mermaid
flowchart TD
    R[Incoming Request] --> A{Has Authorization header?}
    A -->|No| U[Unauthenticated]
    A -->|Yes| B{Token format?}
    B -->|JWT| C[JWT Bearer Handler]
    B -->|Opaque token| D[OAuth Bearer Handler]
    C --> E{Valid signature?}
    D --> F{Token in DB?}
    E -->|Yes| G[Authenticated - JWT Claims]
    E -->|No| U
    F -->|Yes| H[Authenticated - OAuth Scopes]
    F -->|No| U

    style G fill:#1a1a2e,stroke:#16c79a,color:#eee
    style H fill:#1a1a2e,stroke:#16c79a,color:#eee
    style U fill:#1a1a2e,stroke:#e94560,color:#eee
```

### Channel Context Resolution

Multiple controllers use a priority-based pattern to determine which channel the user is operating on:

| Priority | Source | Description |
|----------|--------|-------------|
| 1 (highest) | `HttpContext.Session["ActiveChannelId"]` | Set when switching channels via the dashboard |
| 2 | JWT claim `ChannelOwnerId` | Injected by `ChannelAccessMiddleware` |
| 3 (fallback) | JWT claim `NameIdentifier` (user's own ID) | Default to the user's own channel |

The `ChannelAccessMiddleware` runs on every authenticated request and injects the `ChannelOwnerId` claim based on the session value or the user's own ID.

---

## Permission System

### Permission Hierarchy

| Level | Value | Access |
|-------|-------|--------|
| `commands` | 1 | Basic command management |
| `moderation` | 2 | Moderation tools + commands |
| `control_total` | 3 | Full channel control + moderation + commands |

### Section to Permission Mapping

| Section | Required Level |
|---------|---------------|
| `commands` | `commands` (1) |
| `custom_commands` | `commands` (1) |
| `timers` | `moderation` (2) |
| `moderation` | `moderation` (2) |
| `sound_alerts` | `moderation` (2) |
| `event_alerts` | `moderation` (2) |
| `overlays` | `moderation` (2) |
| `giveaways` | `moderation` (2) |
| `raffles` | `moderation` (2) |
| `settings` | `control_total` (3) |
| `user_management` | `control_total` (3) |
| `game` | `commands` (1) |

### Permission Enforcement

Permissions are enforced via the `[RequirePermission]` attribute:

```csharp
[RequirePermission("moderation")]  // Requires moderation level or higher
public async Task<IActionResult> GetConfig()
```

The attribute:
1. Reads `ChannelOwnerId` from JWT claims
2. Falls back to user's own ID if not present
3. Checks `user_channel_permissions` table for the user's access level on that channel
4. Channel owners automatically have `control_total` on their own channel

### OAuth2 Scopes (Public API)

For the public OAuth2 API, 20 scopes are available in 3 categories:

| Category | Scopes |
|----------|--------|
| **Read** | `read:profile`, `read:channel`, `read:commands`, `read:timers`, `read:moderation`, `read:alerts`, `read:followers` |
| **Write** | `write:channel`, `write:commands`, `write:timers`, `write:moderation`, `write:alerts` |
| **Action** | `action:chat`, `action:shoutout`, `action:timer`, `action:moderation`, `action:giveaway`, `action:alerts`, `action:tts` |

---

## Logging Configuration

### Serilog

Decatron uses Serilog for structured logging with two sinks:

| Sink | Configuration |
|------|--------------|
| **Console** | All log levels, useful for development |
| **File** | Rolling daily files in `logs/decatron-{date}.log`, retains 30 files |

### Log Levels

| Level | Usage |
|-------|-------|
| `Debug` | Detailed diagnostic information |
| `Information` | General operational events (default minimum) |
| `Warning` | Unexpected situations that are not errors |
| `Error` | Errors that prevent a specific operation |
| `Fatal` | Application-level failures |

### Override Levels

| Namespace | Level | Reason |
|-----------|-------|--------|
| `Microsoft` | Warning | Suppress verbose ASP.NET Core framework logs |
| `System` | Warning | Suppress verbose system logs |
| `Microsoft.AspNetCore` | Warning | Suppress per-request middleware logs |

### Webhook Logging

The `TwitchWebhookController` maintains a separate log file at `logs/webhook_logs.txt` for debugging EventSub notifications. This file is downloadable via `GET /api/twitch/download-logs` (requires `control_total` permission).

### Swagger

Swagger UI is available in the Development environment at `/swagger`. It is automatically disabled in production.
