# Environment Variables and Settings

> Español: [es/ENV_VARIABLES.md](es/ENV_VARIABLES.md)

Reference for every setting the Decatron backend reads. Settings are plain ASP.NET Core configuration keys: `Section:Key` in code and environment variables (`Section__Key`), or nested `"Section": { "Key": ... }` in the JSON files. For a task-oriented guide (Twitch setup, database, logging) see [CONFIGURATION.md](CONFIGURATION.md).

This page lists names, types and defaults taken from the code. Real values never go in the repository.

---

## Contents

1. [Configuration files and load order](#configuration-files-and-load-order)
2. [System environment variables](#system-environment-variables)
3. [Minimum secrets file](#minimum-secrets-file)
4. [Database](#database)
5. [Twitch](#twitch)
6. [JWT](#jwt)
7. [Kick](#kick)
8. [Discord](#discord)
9. [Payments: PayPal and Culqi](#payments-paypal-and-culqi)
10. [Music: Spotify and Last.fm](#music-spotify-and-lastfm)
11. [AI providers](#ai-providers)
12. [Text-to-speech and speech-to-text](#text-to-speech-and-speech-to-text)
13. [Live translation](#live-translation)
14. [Games: Riot, Epic and Fortnite](#games-riot-epic-and-fortnite)
15. [Song Request, tournaments, trading cards, emotes and brand](#song-request-tournaments-trading-cards-emotes-and-brand)
16. [E-mail and invoicing](#e-mail-and-invoicing)
17. [Public settings in appsettings.json](#public-settings-in-appsettingsjson)
18. [CORS origins](#cors-origins)
19. [Physical paths](#physical-paths)
20. [External services summary](#external-services-summary)

---

## Configuration files and load order

| File | Purpose | In Git |
|------|---------|--------|
| `appsettings.json` | Public settings: logging, Twitch scopes, module defaults | Yes |
| `appsettings.{Environment}.json` | Standard ASP.NET Core per-environment overrides | Your choice |
| `appsettings.Secrets.json` | **All secrets and credentials** | **No** |
| `appsettings.Secrets.{Environment}.json` | Secrets for one environment (for example `appsettings.Secrets.Staging.json`) | **No** |
| `appsettings.Secrets.json.example` | Template with the minimum keys and no real values | Yes |

`Program.cs` adds the two `appsettings.Secrets*` files (optional, reloaded on change) after the default configuration sources, so when the same key appears in several places the **later source wins**. From lowest to highest priority: `appsettings.json`, `appsettings.{Environment}.json`, user secrets (Development only), environment variables, command-line arguments, `appsettings.Secrets.json`, `appsettings.Secrets.{Environment}.json`.

---

## System environment variables

| Variable | Value | Description |
|----------|-------|-------------|
| `ASPNETCORE_ENVIRONMENT` | `Production`, `Development`, `Staging` | Selects the per-environment files and enables Swagger (`/swagger`) only in `Development`. |
| `ASPNETCORE_URLS` | for example `http://localhost:7264` | Address Kestrel listens on. `--urls` on the command line does the same. |

```bash
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"
```

---

## Minimum secrets file

`appsettings.Secrets.json.example` contains only this minimum. Everything else is optional and depends on the modules you enable.

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=decatron;Username=decatron_user;Password=YOUR_PASSWORD"
  },
  "TwitchSettings": {
    "ClientId": "your_twitch_client_id",
    "ClientSecret": "your_twitch_client_secret",
    "BotUsername": "your_bot_username",
    "ChannelId": "your_numeric_channel_id",
    "RedirectUri": "https://your-domain.com/api/auth/callback",
    "FrontendUrl": "https://your-domain.com"
  },
  "JwtSettings": {
    "SecretKey": "RANDOM_KEY_OF_AT_LEAST_32_CHARACTERS",
    "ExpiryMinutes": 60,
    "RefreshTokenExpiryDays": 7
  }
}
```

---

## Database

### `ConnectionStrings:DefaultConnection` (PostgreSQL)

Required. Without it the database context is not registered and the application cannot work.

```
Host=localhost;Port=5432;Database=decatron;Username=decatron_user;Password=YOUR_PASSWORD
```

| Parameter | Description | Example |
|-----------|-------------|---------|
| `Host` | PostgreSQL server | `localhost` |
| `Port` | PostgreSQL port | `5432` |
| `Database` | Database name | `decatron` |
| `Username` | Database user | `decatron_user` |
| `Password` | User password | |

The schema is not created automatically. Load `Decatron.Data/Schema/baseline.sql` into an empty database and apply later scripts from `Decatron.Data/Migrations/` (see [CONFIGURATION.md](CONFIGURATION.md#database-setup)).

### `ConnectionStrings:GachaConnection` (MySQL, optional)

Used only by the GachaVerse account-linking endpoints (`GachaAuthController`). Without it those endpoints log an error and the rest of the application is unaffected.

| Parameter | Description | Example |
|-----------|-------------|---------|
| `Server` | MySQL server | `localhost` |
| `Port` | MySQL port | `3306` |
| `Database` | GachaVerse database | `gachaverse_db` |
| `Uid` | MySQL user | |
| `Password` | MySQL password | |

### `GachaSettings`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `WebUrl` | string | `http://localhost:3000` | URL of the GachaVerse instance |
| `BotUsername` | string | `decatronstreambot` | Bot username shown in GachaVerse |

---

## Twitch

### `TwitchSettings`

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `ClientId` | string | **Yes** | Client ID of your app in the [Twitch Developer Console](https://dev.twitch.tv/console/apps) |
| `ClientSecret` | string | **Yes** | Client Secret of that app |
| `BotUsername` | string | **Yes** | Username of the bot's Twitch account |
| `ChannelId` | string | **Yes** | Numeric Twitch ID of the primary channel. The bot joins it by default |
| `RedirectUri` | string | **Yes** | OAuth callback. Must match the console exactly, for example `https://your-domain.com/api/auth/callback` |
| `FrontendUrl` | string | No | Base URL of the React app, used for post-login redirects. Default `http://localhost:5173` |
| `Scopes` | string | **Yes** (in `appsettings.json`) | Space-separated Twitch scopes requested at login. Already set in `appsettings.json` |
| `WebhookCallbackUrl` | string | No | Legacy: public URL for EventSub webhook callbacks. Read only when a subscription is created with the webhook transport, which is switched off |
| `WebhookSecret` | string | No | Legacy: HMAC secret of the webhook transport. Same condition |

Notes:

- The bot account's OAuth tokens are stored in the `bot_tokens` table and refreshed in the background. `TwitchSettings` has `BotToken`, `EventSubWebhookSecret`, `EventSubWebhookUrl` and `EventSubWebhookPort` properties, but the code does not read them.
- EventSub runs on a conduit with WebSocket shards (`EventSubSettings:ShardCount`); no public webhook URL is needed. See [CONFIGURATION.md](CONFIGURATION.md#step-4-eventsub-conduit).
- `Twitch:ClientId` and `Twitch:ClientSecret` (without "Settings") are read by the script variables that call the Twitch API (`TwitchInfoVariables`). Set them to the same values if you use those variables.

### Scopes

Defined in `appsettings.json`:

```
chat:read chat:edit clips:edit channel:bot channel:edit:commercial channel:manage:broadcast channel:manage:redemptions channel:manage:moderators channel:read:editors channel:read:redemptions channel:read:subscriptions channel:read:vips moderation:read moderator:read:followers user:read:email user:edit:broadcast channel_editor user:manage:blocked_users user:write:chat bits:read channel:read:hype_train
```

The scopes you request must be allowed for the app in the Twitch console, and streamers must log in again to grant any scope you add.

### `EventSubSettings`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ShardCount` | int | `1` | Number of WebSocket shards of the EventSub conduit |

---

## JWT

### `JwtSettings`

| Key | Type | Required | Description | Recommendation |
|-----|------|----------|-------------|----------------|
| `SecretKey` | string | **Yes** | Key that signs the JWTs. At least 32 characters. The backend refuses to start without it | `openssl rand -base64 48` |
| `ExpiryMinutes` | int | **Yes** | Lifetime of the access token, in minutes | `60` |
| `RefreshTokenExpiryDays` | int | **Yes** | Lifetime of the refresh token, in days | `7` |

Token validation checks signature and lifetime (5 minutes of clock skew). Issuer and audience are **not** validated, so any token signed with the same key is accepted.

---

## Kick

### `KickSettings`

| Key | Type | Description |
|-----|------|-------------|
| `ClientId` | string | Client ID of your Kick app |
| `ClientSecret` | string | Client Secret |
| `RedirectUri` | string | OAuth callback |
| `WebhookUrl` | string | Public URL where Kick sends webhook events |
| `Scopes` | string | Space-separated Kick scopes to request |

Required only if you enable Kick login and Kick-based modules.

---

## Discord

### `DiscordSettings`

| Key | Type | Description |
|-----|------|-------------|
| `BotToken` | string | Token of the Discord bot |
| `AppId` | string | Application ID |
| `ClientSecret` | string | OAuth client secret |
| `RedirectUri` | string | Callback used to link a Discord account |
| `LoginRedirectUri` | string | Callback used for Discord login |
| `FrontendUrl` | string | Base URL of the frontend. Default `https://twitch.decatron.net` (set your own) |

Required only if you run the Discord bot (slash commands, levels, welcome images, live alerts).

---

## Payments: PayPal and Culqi

### `PayPalSettings` (tips and donations)

Donations go directly to the streamer's PayPal account: Decatron creates the order with the streamer as `payee`.

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `Mode` | string | Yes | `sandbox` for tests, `live` for production |
| `ClientId` | string | Yes | Sandbox client ID ([PayPal developer dashboard](https://developer.paypal.com/dashboard/applications/sandbox)) |
| `ClientSecret` | string | Yes | Sandbox client secret |
| `LiveClientId` | string | Yes (production) | Live client ID |
| `LiveClientSecret` | string | Yes (production) | Live client secret |
| `RedirectUri` | string | Yes | Callback when a streamer connects their PayPal, for example `https://your-domain.com/api/tips/paypal/callback` |

### `SupportersPayPal` (tier purchases)

Same keys as above, read by the Supporters controller, plus:

| Key | Type | Description |
|-----|------|-------------|
| `ReturnUrl` | string | Where to send the user after a successful payment |
| `CancelUrl` | string | Where to send the user if they cancel |

### `CulqiSettings` and `CulqiSettingsTest` (card payments for credit packages)

| Key | Type | Description |
|-----|------|-------------|
| `PublicKey` | string | Culqi public key |
| `SecretKey` | string | Culqi secret key |

`CulqiSettings` holds the live keys and `CulqiSettingsTest` the test keys; which pair is used depends on the payment mode managed by `PaymentModeService`.

---

## Music: Spotify and Last.fm

### `SpotifySettings` (Now Playing)

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `ClientId` | string | Only for Spotify | Client ID from the [Spotify dashboard](https://developer.spotify.com/dashboard) |
| `ClientSecret` | string | Only for Spotify | Client Secret |
| `RedirectUri` | string | Only for Spotify | OAuth callback, for example `https://your-domain.com/api/spotify/callback`. Add it to the app's Redirect URIs |

The code limits non-premium Spotify slots to 5 (`MaxSpotifyUsers`), matching the user limit of the Spotify dashboard for apps in development mode, and keeps a waiting list for slots.

### `LastFmSettings`

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `ApiKey` | string | Only for Last.fm | API key from [last.fm/api/account/create](https://www.last.fm/api/account/create) |

Last.fm works with any player that scrobbles to Last.fm. The code calls the Last.fm API over plain HTTP (`http://ws.audioscrobbler.com`), and the API key is part of the query string.

---

## AI providers

Which provider and model each feature uses is stored in the database (`decatron_ai_global_config`) and edited from the admin panel, not in the settings files. The files only hold the keys.

| Section | Key | Description |
|---------|-----|-------------|
| `GeminiSettings` | `ApiKey` | Google Gemini API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) |
| `OpenRouterSettings` | `ApiKey` | OpenRouter API key ([openrouter.ai/keys](https://openrouter.ai/keys)) |

Required only if you use `!ia`, the private AI chat or other AI features.

---

## Text-to-speech and speech-to-text

### `AwsPolly`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `AccessKeyId` | string | | AWS access key ID |
| `SecretAccessKey` | string | | AWS secret key |
| `Region` | string | `us-east-1` | AWS region |
| `CachePath` | string | `/var/www/html/decatron/tts-cache` | Folder for generated audio; served under `/tts-audio` |

The IAM user needs `polly:SynthesizeSpeech` (for example the `AmazonPollyReadOnlyAccess` policy). Without credentials the application starts with anonymous credentials and TTS calls fail at run time; features that use TTS skip it.

### `TtsSettings`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `CachePath` | string | `/var/www/html/decatron/tts-cache` | Cache path read at startup for the `/tts-audio` mapping |

### `Deepgram` and `FishAudio`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `Deepgram:ApiKey` | string | | Deepgram key (speech-to-text and Aura TTS) used by live translation |
| `FishAudio:ApiKey` | string | | FishAudio key (TTS engine of live translation) |
| `FishAudio:Model` | string | `s1` | FishAudio model |

---

## Live translation

The `LiveTranslation` section of `appsettings.json` holds limits and client timing (`SttModel`, `GeminiFallbackModel`, `SttCreditsPerSecond`, `MaxConcurrentChannels`, `MaxLanguagesPerChannel`, `LinkCodeMinutes`, `SmartSegmentation`, `ClientTuning`, ...). The class that binds it is `LiveTranslationOptions`. The section is reloaded without restarting the backend. The desktop link uses `DesktopOptions`.

---

## Games: Riot, Epic and Fortnite

| Section | Key | Default | Description |
|---------|-----|---------|-------------|
| `RiotApi` | `PlatformApiKey` | | Riot key for League of Legends |
| `RiotApi` | `TftApiKey` | | Riot key for Teamfight Tactics |
| `RiotApi` | `ValorantApiKey` | | Riot key for Valorant |
| `EpicSettings` | `ClientId`, `ClientSecret` | | Epic Games OAuth app |
| `EpicSettings` | `RedirectUri` | `https://decatron.net/api/auth/epic/callback` | Epic OAuth callback (set your own domain) |
| `EpicSettings` | `Scopes` | `basic_profile friends_list country presence` | Epic scopes |
| `Fortnite` | `CurrentSeason` | `Unknown` | Season label used by the Fortnite modules |

A missing Riot key is treated as not configured for that game.

---

## Song Request, tournaments, trading cards, emotes and brand

| Key | Default | Description |
|-----|---------|-------------|
| `SongRequest:YtDlpPath` | `yt-dlp` | Command or path of the yt-dlp binary used to resolve media |
| `SongRequest:PublicBaseUrl` | `https://decatron.net` | Base URL used to build public queue links (`/sr/{channel}`); set your own domain |
| `Tournament:FilesPath` | `/var/www/html/decatron/tournament-files` | Folder for tournament screenshots and files |
| `Tournament:PublicAssetsPath` | `/var/www/html/decatron/tournament-public-assets` | Folder for public tournament assets (appearance) |
| `TcgSettings:ImagesPath` | `/var/www/html/decatron/tcg-card-images` | Trading card images; pack images are served from `{ImagesPath}/packs` under `/tcg-packs` |
| `TcgSettings:ImageSigningSecret` | | Secret that signs trading card image URLs |
| `Emotes:AssetsPath` | `/var/www/html/decatron/emote-assets` | Emote images; served under `/uploads/emotes` |
| `Emotes:PublicBase` | `https://decatron.net` | Base URL used to build public emote URLs; set your own domain |
| `Brand:AssetsPath` | `/var/www/html/decatron/brand-assets` | Logos uploaded from the admin brand page; served under `/uploads/brand` |
| `ClipSettings:DownloadsPath` | (see `appsettings.json`) | Downloaded shoutout clips; served under `/downloads` |
| `WheelOfLuck:Enabled` | | Master switch of the Wheel module |

Make sure the application user can write to every folder above.

---

## E-mail and invoicing

### `EmailSettings`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ResendApiKey` | string | empty | API key of the Resend e-mail service |
| `FromAddress` | string | `DecatronAPI <support@decatron.net>` | Sender; set your own |
| `AdminEmail` | string | `support@decatron.net` | Administrator address for notices; set your own |

### `DecatronApi` (optional invoicing link)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `BaseUrl` | string | `https://decatronapi.decatron.net` | Base URL of the invoicing service |
| `ApiKey` | string | | Bearer key for that service; invoicing is skipped when empty |
| `CompanyId` | int | | Issuing company ID |
| `Enabled` | bool | `true` | Master switch for invoicing; invoicing also needs `ApiKey` |

### `TtsCredits`

| Key | Description |
|-----|-------------|
| `TransitionEndsAt` | End date of the TTS credits transition (set in `appsettings.json`) |

---

## Public settings in appsettings.json

`appsettings.json` holds no secrets:

| Key | Description |
|-----|-------------|
| `TwitchSettings:Scopes` | Twitch scopes (see above) |
| `Serilog:MinimumLevel:Default` | Minimum log level: `Verbose`, `Debug`, `Information`, `Warning`, `Error`, `Fatal` |
| `Serilog:WriteTo` | Console sink and a rolling file sink: path `logs/decatron-.txt`, one file per day, 50 MB size limit per file (`fileSizeLimitBytes`), 14 files kept (`retainedFileCountLimit`) |
| `Logging:LogLevel` | Native ASP.NET Core log levels (Serilog overrides them) |
| `AllowedHosts` | `*` accepts any host |
| `ClipSettings`, `EventSubSettings`, `LiveTranslation`, `WheelOfLuck`, `Fortnite`, `DecatronApi`, `TtsCredits` | Module settings described above |

---

## CORS origins

Origins are hard-coded in `Program.cs` (policy `AllowReact`), not configurable through settings:

```
http://localhost:5173
https://twitch.decatron.net
https://decatron.net
https://www.decatron.net
```

To allow another origin, edit the `AddCors` block in `Program.cs`. A second policy, `TournamentEmbed`, allows any origin without credentials for the public tournament overlay and ranking widget.

---

## Physical paths

| Path | Purpose | Configurable |
|------|---------|--------------|
| `{ClipSettings:DownloadsPath}` | Downloaded Twitch clips (`/downloads`) | Yes |
| `ClientApp/public/uploads/soundalerts` | Sound alert media (`/uploads/soundalerts`) | No |
| `ClientApp/public/timerextensible` | Timer media (`/timerextensible`) | No |
| `ClientApp/public/system-files` | Pre-loaded system files (`/system-files`) | No |
| `{AwsPolly:CachePath}` | TTS audio cache (`/tts-audio`) | Yes |
| `{Brand:AssetsPath}`, `{Emotes:AssetsPath}`, `{TcgSettings:ImagesPath}`, `{Tournament:*}` | See the table above | Yes |
| `logs/` | Serilog files | Yes (`Serilog:WriteTo`) |

---

## External services summary

| Service | Needed for | Cost |
|---------|-----------|------|
| PostgreSQL | Everything | Free |
| Twitch developer app | Login, bot, EventSub | Free |
| Kick developer app | Kick login and modules | Free |
| Discord application | Discord bot and login | Free |
| PayPal developer | Tips and tier purchases | Free (PayPal charges fees on payments) |
| Culqi | Card payments for credit packages | Per transaction |
| Spotify developer | Now Playing | Free |
| Last.fm API | Now Playing (alternative to Spotify) | Free |
| Google Gemini, OpenRouter | AI features | Free tiers and paid models |
| AWS Polly | Text-to-speech | Paid (free tier available) |
| Deepgram, FishAudio | Live translation | Paid |
| Riot API, Epic Games | Tournaments, game overlays, Fortnite | Free |
| Resend | E-mail | Free tier and paid |
| MySQL + GachaVerse | GachaVerse linking | Only if you use GachaVerse |
