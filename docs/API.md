# Decatron v2 API Reference

Complete reference for every API endpoint exposed by Decatron. All endpoints are served from the base URL of your Decatron instance (e.g., `https://twitch.decatron.net`).

---

## Table of Contents

- [Authentication](#authentication)
- [Auth / Login](#auth--login)
- [OAuth2 API (Public Developer API)](#oauth2-api-public-developer-api)
- [Developer Portal](#developer-portal)
- [Gacha Auth](#gacha-auth)
- [Bot / Chat](#bot--chat)
- [Custom Commands](#custom-commands)
- [Chat AI (DecatronChat)](#chat-ai-decatronchat)
- [Chat AI Admin](#chat-ai-admin)
- [Twitch API / EventSub / Webhooks](#twitch-api--eventsub--webhooks)
- [Channel Switch](#channel-switch)
- [Timer Extension](#timer-extension)
- [Timer Backup](#timer-backup)
- [Timer Media](#timer-media)
- [Message Timers](#message-timers)
- [Event Alerts](#event-alerts)
- [Follow Alerts (Legacy)](#follow-alerts-legacy)
- [Sound Alerts](#sound-alerts)
- [Tips / Donations](#tips--donations)
- [Supporters / Subscriptions](#supporters--subscriptions)
- [Giveaway](#giveaway)
- [Raffle](#raffle)
- [Goals](#goals)
- [Shoutout](#shoutout)
- [Now Playing / Spotify](#now-playing--spotify)
- [Moderation](#moderation)
- [Followers](#followers)
- [Analytics](#analytics)
- [Scripting](#scripting)
- [Micro Commands](#micro-commands)
- [Game Commands](#game-commands)
- [DecatronAI (Twitch Chat AI)](#decatronai-twitch-chat-ai)
- [DecatronAI Admin](#decatronai-admin)
- [Settings](#settings)
- [Language](#language)
- [TTS (Text-to-Speech)](#tts-text-to-speech)
- [User Permissions](#user-permissions)
- [WebSocket / SignalR Hubs](#websocket--signalr-hubs)
- [Static File Endpoints](#static-file-endpoints)
- [Overlay URLs (Public Pages)](#overlay-urls-public-pages)
- [Error Format](#error-format)
- [Rate Limiting](#rate-limiting)

---

## Authentication

Decatron uses two independent authentication systems:

### 1. JWT (User Sessions)

Used by the dashboard and all authenticated endpoints. Obtained via the Twitch OAuth login flow.

**How to get a token:**

1. Redirect the user to `GET /api/auth/login`
2. Twitch authenticates the user and redirects to `GET /api/auth/callback`
3. The backend generates a JWT and redirects to the frontend with `?token=JWT`

**Header format:**

```
Authorization: Bearer <JWT_TOKEN>
```

The JWT contains claims for `NameIdentifier` (user ID), `ChannelOwnerId` (active channel), `Name`, `Login`, and `Email`.

### 2. OAuth2 (Public API for Third-Party Apps)

Used by external applications that integrate with Decatron's API. Implements Authorization Code flow with PKCE support.

**How to get a token:**

1. Register an application via `POST /api/developer/apps` to obtain `client_id` and `client_secret`
2. Redirect the user to `GET /api/oauth/authorize` with required parameters
3. User approves the request at `POST /api/oauth/authorize`
4. Exchange the authorization code for tokens via `POST /api/oauth/token` (form-urlencoded)

**Header format:**

```
Authorization: Bearer <OAUTH_ACCESS_TOKEN>
```

**Available OAuth Scopes (20 scopes in 3 categories):**

| Category | Scopes |
|----------|--------|
| Read | `read:profile`, `read:commands`, `read:timers`, `read:moderation`, `read:alerts`, `read:followers`, `read:analytics` |
| Write | `write:commands`, `write:timers`, `write:moderation`, `write:alerts`, `write:settings` |
| Action | `action:shoutout`, `action:timer`, `action:giveaway`, `action:raffle`, `action:tts`, `action:bot`, `action:ai` |

---

## Auth / Login

### AuthController (`/api/auth`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/auth/login` | No | Redirects to Twitch OAuth login. Accepts optional `?redirect=` parameter |
| GET | `/api/auth/callback` | No | Twitch OAuth callback. Exchanges code for tokens, creates/updates user, generates JWT, redirects to frontend |
| GET | `/api/auth/validate-scopes/{twitchId}` | No | Validates stored Twitch token scopes for a user |
| GET | `/api/auth/account-tier` | Yes (JWT) | Returns the subscription tier of the authenticated user |

---

## OAuth2 API (Public Developer API)

### OAuthController (`/api/oauth`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/oauth/authorize` | No | Initiates OAuth2 Authorization Code flow. Validates parameters, returns app info and scopes |
| POST | `/api/oauth/authorize` | Yes (JWT) | Processes user decision (approve/deny). Generates authorization code |
| POST | `/api/oauth/token` | No (client credentials in body) | Exchanges authorization code or refresh token for access token. Form-urlencoded |
| POST | `/api/oauth/revoke` | No | Revokes a token (RFC 7009, always returns 200) |
| GET | `/api/oauth/userinfo` | Yes (OAuth + `read:profile`) | Returns authenticated user info via OAuth |
| GET | `/api/oauth/scopes` | No | Lists all available scopes grouped by category |

---

## Developer Portal

### DeveloperController (`/api/developer`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/developer/apps` | Yes (JWT) | Lists all OAuth apps owned by the user |
| GET | `/api/developer/apps/{id}` | Yes (JWT) | App detail with statistics (users, tokens) |
| POST | `/api/developer/apps` | Yes (JWT) | Creates new OAuth app. Returns `client_secret` (shown only once) |
| PUT | `/api/developer/apps/{id}` | Yes (JWT) | Updates app name, description, URIs, scopes |
| POST | `/api/developer/apps/{id}/regenerate-secret` | Yes (JWT) | Regenerates `client_secret`. Revokes all existing tokens |
| DELETE | `/api/developer/apps/{id}` | Yes (JWT) | Deletes app and all its tokens (cascade) |
| GET | `/api/developer/scopes` | No | Lists available scopes with categories for UI |

---

## Gacha Auth

### GachaAuthController (`/api/gacha-auth`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/gacha-auth/config` | No | Public configuration (WebUrl, BotUsername) |
| POST | `/api/gacha-auth/validate` | No | Validates username/password against GachaVerse MySQL |
| POST | `/api/gacha-auth/link` | Yes (JWT) | Links GachaVerse account with Twitch account |
| GET | `/api/gacha-auth/status` | Yes (JWT) | Link status of the current user |
| POST | `/api/gacha-auth/unlink` | Yes (JWT) | Unlinks GachaVerse account |

---

## Bot / Chat

### ChatController (`/api/chat`)

Decatron's private AI chat system.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/chat/check-access` | Yes (JWT) | Checks if user has access to AI chat (canView/canChat) |
| GET | `/api/chat/conversations` | Yes (JWT) | Lists user conversations in the active channel |
| POST | `/api/chat/conversations` | Yes (JWT + CanChat) | Creates a new conversation |
| GET | `/api/chat/conversations/{id}` | Yes (JWT + CanView) | Gets a conversation with its messages |
| POST | `/api/chat/conversations/{id}/messages` | Yes (JWT + CanChat) | Sends a message to the AI and receives a response |
| DELETE | `/api/chat/conversations/{id}` | Yes (JWT) | Deletes a conversation (owner only) |

---

## Chat AI Admin

### ChatAdminController (`/api/admin/chat`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/admin/chat/config` | Yes (JWT + Owner) | Gets AI chat configuration |
| POST | `/api/admin/chat/config` | Yes (JWT + Owner) | Updates AI chat configuration |
| GET | `/api/admin/chat/permissions` | Yes (JWT + Owner) | Lists user permissions |
| POST | `/api/admin/chat/permissions` | Yes (JWT + Owner) | Adds permissions for a user |
| PUT | `/api/admin/chat/permissions/{id}` | Yes (JWT + Owner) | Updates user permissions |
| DELETE | `/api/admin/chat/permissions/{id}` | Yes (JWT + Owner) | Removes user permissions |
| GET | `/api/admin/chat/stats` | Yes (JWT + Owner) | AI chat usage statistics |
| GET | `/api/admin/chat/audit` | Yes (JWT + Owner) | Message audit log (paginated, filterable) |
| GET | `/api/admin/chat/audit/conversations` | Yes (JWT + Owner) | Conversation audit log (paginated) |
| GET | `/api/admin/chat/available-users` | Yes (JWT + Owner) | Search users for permission assignment |

---

## Custom Commands

### CustomCommandsController (`/api/CustomCommands`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/CustomCommands` | Yes (JWT) | Lists custom commands for the active channel |
| GET | `/api/CustomCommands/{id}` | Yes (JWT) | Gets a custom command by ID |
| POST | `/api/CustomCommands` | Yes (JWT + `commands`) | Creates a custom command |
| PUT | `/api/CustomCommands/{id}` | Yes (JWT + `commands`) | Updates a custom command |
| DELETE | `/api/CustomCommands/{id}` | Yes (JWT + `moderation`) | Deletes a custom command |

---

## Twitch API / EventSub / Webhooks

### TwitchWebhookController (`/api/twitch`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/twitch/webhook` | No (HMAC verification) | Receives all EventSub webhook notifications from Twitch |
| GET | `/api/twitch/download-logs` | Yes (`settings:control_total`) | Downloads the webhook log file |
| POST | `/api/twitch/eventsub/subscribe/chat` | Yes (`settings:control_total`) | Subscribes to `channel.chat.message` EventSub |
| POST | `/api/twitch/eventsub/subscribe/channel-points` | Yes (`settings:control_total`) | Subscribes to channel points redemption EventSub |
| POST | `/api/twitch/eventsub/subscribe/follow` | Yes (`settings:control_total`) | Subscribes to `channel.follow` EventSub |
| GET | `/api/twitch/eventsub/subscriptions` | Yes (`settings:control_total`) | Lists all active EventSub subscriptions |
| DELETE | `/api/twitch/eventsub/subscriptions/{subscriptionId}` | Yes (`settings:control_total`) | Deletes an EventSub subscription |

---

## Channel Switch

### ChannelSwitchController (`/api/channel`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/channel/available` | Yes (JWT) | Gets channels the user can manage |
| POST | `/api/channel/switch` | Yes (JWT) | Switches the active channel context |
| GET | `/api/channel/context` | Yes (JWT) | Gets the current active channel context |

---

## Timer Extension

### TimerExtensionController (`/api/timer`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/timer/config` | Yes (JWT) | Gets timer configuration for the active channel |
| POST | `/api/timer/config` | Yes (JWT) | Saves complete timer configuration |
| POST | `/api/timer/config/reset` | Yes (JWT) | Resets all timer configuration to factory defaults |
| GET | `/api/timer/state/current` | Yes (JWT) | Gets current timer state (authenticated) |
| GET | `/api/timer/state/{channel}` | No | Gets timer state for a channel (public) |
| POST | `/api/timer/control` | Yes (JWT) | Controls timer (start/pause/resume/reset/stop/addtime/removetime) |
| GET | `/api/timer/config/overlay/{channel}` | No | Gets config and state for overlay rendering |
| POST | `/api/timer/overlay/{channel}/complete` | No | Marks timer as completed |
| GET | `/api/timer/sessions` | Yes (JWT) | Lists timer sessions |
| GET | `/api/timer/sessions/{id}/logs` | Yes (JWT) | Gets event logs for a specific session |
| POST | `/api/timer/test/event` | Yes (JWT) | Simulates a timer event (bits, sub, raid, etc.) |
| GET | `/api/timer/templates` | Yes (JWT) | Lists saved templates |
| POST | `/api/timer/templates` | Yes (JWT) | Creates a template from current configuration |
| PUT | `/api/timer/templates/{id}` | Yes (JWT) | Updates template metadata |
| DELETE | `/api/timer/templates/{id}` | Yes (JWT) | Deletes a template |
| POST | `/api/timer/templates/{id}/apply` | Yes (JWT) | Applies a template to the current configuration |
| GET | `/api/timer/schedules` | Yes (JWT) | Lists auto-pause schedules |
| POST | `/api/timer/schedules` | Yes (JWT) | Creates a schedule |
| PUT | `/api/timer/schedules/{id}` | Yes (JWT) | Updates a schedule |
| DELETE | `/api/timer/schedules/{id}` | Yes (JWT) | Deletes a schedule |
| GET | `/api/timer/happyhour` | Yes (JWT) | Lists Happy Hours |
| POST | `/api/timer/happyhour` | Yes (JWT) | Creates a Happy Hour |
| PUT | `/api/timer/happyhour/{id}` | Yes (JWT) | Updates a Happy Hour |
| DELETE | `/api/timer/happyhour/{id}` | Yes (JWT) | Deletes a Happy Hour |

---

## Timer Backup

### TimerBackupController (`/api/timer/backup`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/timer/backup` | Yes (JWT) | Creates a manual backup |
| GET | `/api/timer/backup/list` | Yes (JWT) | Lists recent backups |
| GET | `/api/timer/backup/by-session/{sessionId}` | Yes (JWT) | Gets backup by session ID |
| POST | `/api/timer/backup/restore-session` | Yes (JWT) | Restores a session with manual time |
| POST | `/api/timer/backup/restore/{id}` | Yes (JWT) | Restores from a specific backup |

---

## Timer Media

### TimerMediaController (`/api/timer/media`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/timer/media` | Yes (JWT) | Lists multimedia files |
| GET | `/api/timer/media/categories` | Yes (JWT) | Lists available categories |
| POST | `/api/timer/media/upload` | Yes (JWT) | Uploads multimedia file (50MB max) |
| PUT | `/api/timer/media/{id}/rename` | Yes (JWT) | Renames a file |
| PUT | `/api/timer/media/{id}/move` | Yes (JWT) | Moves a file to another category |
| DELETE | `/api/timer/media/{id}` | Yes (JWT) | Deletes a file |

---

## Message Timers

### TimersController (`/api/timers`)

Automated chat message timers (e.g., periodic reminders).

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/timers` | Yes (`timers`) | Lists message timers for the channel |
| GET | `/api/timers/{id}` | Yes (`timers`) | Gets a timer by ID |
| POST | `/api/timers` | Yes (`timers`) | Creates a message timer |
| PUT | `/api/timers/{id}` | Yes (`timers`) | Updates a message timer |
| DELETE | `/api/timers/{id}` | Yes (`timers`) | Deletes a message timer |
| POST | `/api/timers/{id}/test` | Yes (`timers`) | Executes a timer manually |

---

## Event Alerts

### EventAlertsController (`/api/eventalerts`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/eventalerts/config` | Yes (JWT) | Gets event alerts configuration for the active channel |
| POST | `/api/eventalerts/config` | Yes (JWT) | Saves complete configuration (JSON blob, server-side validated) |
| POST | `/api/eventalerts/test` | Yes (JWT) | Sends a test alert to the overlay via SignalR |
| GET | `/api/eventalerts/config/overlay/{channelName}` | No | Gets overlay config for a channel (used by OBS Browser Source) |
| GET | `/api/eventalerts/debug/{channelName}` | No | Debug: shows full configuration for a channel |

---

## Follow Alerts (Legacy)

### FollowAlertController (`/api/followalert`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/followalert/config` | Yes (JWT + `moderation`) | Gets legacy follow alert config |
| POST | `/api/followalert/config` | Yes (JWT + `moderation`) | Updates legacy follow alert config |
| GET | `/api/followalert/stats` | Yes (JWT + `moderation`) | Follow alert statistics |

---

## Sound Alerts

### SoundAlertsController (`/api/soundalerts`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/soundalerts/channel-points-rewards` | Yes (JWT) | Gets Channel Points rewards from Twitch API |
| GET | `/api/soundalerts/config/overlay/{channel}` | No | Gets overlay configuration for a channel (public) |
| GET | `/api/soundalerts/config` | Yes (JWT) | Gets Sound Alerts global configuration |
| POST | `/api/soundalerts/config` | Yes (JWT) | Saves Sound Alerts global configuration |
| GET | `/api/soundalerts/files` | Yes (JWT) | Lists files associated with rewards |
| POST | `/api/soundalerts/upload` | Yes (JWT) | Uploads multimedia file (multipart/form-data) for a reward |
| DELETE | `/api/soundalerts/file/{rewardId}` | Yes (JWT) | Deletes a file associated with a reward |
| PATCH | `/api/soundalerts/file/{rewardId}/volume` | Yes (JWT) | Updates volume for a specific file |
| PATCH | `/api/soundalerts/file/{rewardId}/toggle` | Yes (JWT) | Enables/disables a specific file |
| GET | `/api/soundalerts/system-files` | Yes (JWT) | Lists available system files (scans directories) |
| POST | `/api/soundalerts/assign-system-file` | Yes (JWT) | Assigns a system file to a reward |
| POST | `/api/soundalerts/test` | Yes (JWT) | Sends a test alert via SignalR |

---

## Tips / Donations

### TipsController (`/api/tips`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/tips/config` | Yes (JWT) | Gets tips configuration for the active channel |
| POST | `/api/tips/config` | Yes (JWT) | Saves tips configuration |
| GET | `/api/tips/page/{channelName}` | No | Gets public donation page config (includes PayPal client ID) |
| GET | `/api/tips/paypal/connect` | Yes (JWT) | Generates PayPal OAuth URL |
| GET | `/api/tips/paypal/callback` | No | PayPal OAuth callback, redirects with email in base64 |
| POST | `/api/tips/paypal/disconnect` | Yes (JWT) | Disconnects PayPal from the channel |
| POST | `/api/tips/paypal/create-order` | No | Creates a PayPal order for a tip |
| POST | `/api/tips/paypal/capture-order` | No | Captures (charges) a completed PayPal order |
| POST | `/api/tips/paypal/webhook` | No | Receives PayPal webhooks |
| GET | `/api/tips/history` | Yes (JWT) | Tips history (paginated or legacy) |
| GET | `/api/tips/top-donors` | Yes (JWT) | Top donors by period |
| GET | `/api/tips/statistics` | Yes (JWT) | Donation statistics by period |
| POST | `/api/tips/test` | Yes (JWT) | Sends a test alert |

---

## Supporters / Subscriptions

### SupportersController (`/api/supporters`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/supporters/public-config` | No | Public page config (title, tagline, monthly progress) |
| GET | `/api/supporters/list-public` | No | List of active supporters for the public wall |
| GET | `/api/supporters/config` | Yes (Owner) | Full config + tiers for admin editor |
| POST | `/api/supporters/config` | Yes (Owner) | Saves page config + tiers |
| GET | `/api/supporters/list` | Yes (Owner) | Paginated supporters list (admin) |
| POST | `/api/supporters/assign-tier` | Yes (Owner) | Manually assigns a tier to a user |
| GET | `/api/supporters/discount-codes` | Yes (Owner) | Lists all discount codes |
| POST | `/api/supporters/discount-codes` | Yes (Owner) | Creates a new discount code |
| PATCH | `/api/supporters/discount-codes/{id}` | Yes (Owner) | Enables/disables a discount code |
| DELETE | `/api/supporters/discount-codes/{id}` | Yes (Owner) | Deletes a discount code |
| GET | `/api/supporters/validate-code` | No | Validates a discount code and calculates amount |
| POST | `/api/supporters/create-paypal-order` | No | Creates PayPal order for a tier |
| POST | `/api/supporters/capture-paypal-order` | No | Captures approved PayPal order, assigns tier |
| POST | `/api/supporters/create-donation-order` | No | Creates PayPal order for a free donation |
| POST | `/api/supporters/capture-donation-order` | No | Captures free donation order |
| POST | `/api/supporters/paypal/webhook` | No | PayPal webhook |

---

## Giveaway

### GiveawayController (`/api/giveaway`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/giveaway/config` | Yes (JWT + `giveaways`) | Gets saved giveaway configuration |
| POST | `/api/giveaway/config` | Yes (JWT + `giveaways`) | Saves giveaway configuration |
| POST | `/api/giveaway/start` | Yes (JWT + `giveaways`) | Starts a giveaway (saves config + creates session) |
| POST | `/api/giveaway/end` | Yes (JWT + `giveaways`) | Ends giveaway and selects winners |
| POST | `/api/giveaway/cancel` | Yes (JWT + `giveaways`) | Cancels active giveaway |
| POST | `/api/giveaway/reroll` | Yes (JWT + `giveaways`) | Re-rolls a winner |
| POST | `/api/giveaway/disqualify` | Yes (JWT + `giveaways`) | Disqualifies a winner |
| GET | `/api/giveaway/active` | Yes (JWT + `giveaways`) | Gets active giveaway with participants and winners |
| GET | `/api/giveaway/participants` | Yes (JWT + `giveaways`) | Gets participants of the active giveaway |
| GET | `/api/giveaway/history` | Yes (JWT + `giveaways`) | Giveaway history (param: `limit`) |
| DELETE | `/api/giveaway/history/{id}` | Yes (JWT + `giveaways`) | Deletes a history entry (not yet implemented) |
| GET | `/api/giveaway/statistics` | Yes (JWT + `giveaways`) | General giveaway statistics |
| GET | `/api/giveaway/export` | Yes (JWT + `giveaways`) | Exports history (not yet implemented) |
| POST | `/api/giveaway/debug/generate-participants` | Yes (JWT + `giveaways`) | Generates test participants (debug) |
| DELETE | `/api/giveaway/debug/clear-participants` | Yes (JWT + `giveaways`) | Clears test participants (debug) |

---

## Raffle

### RaffleController (`/api/raffles`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/raffles` | Yes (`raffles`) | Lists raffles for the channel |
| GET | `/api/raffles/{id}` | Yes (`raffles`) | Gets a raffle by ID |
| POST | `/api/raffles` | Yes (`raffles`) | Creates a raffle |
| PUT | `/api/raffles/{id}` | Yes (`raffles`) | Updates a raffle |
| DELETE | `/api/raffles/{id}` | Yes (`raffles`) | Deletes a raffle |
| POST | `/api/raffles/{id}/open` | Yes (`raffles`) | Opens a raffle for participation |
| POST | `/api/raffles/{id}/close` | Yes (`raffles`) | Closes a raffle |
| POST | `/api/raffles/{id}/draw` | Yes (`raffles`) | Draws winners |
| GET | `/api/raffles/{id}/participants` | Yes (`raffles`) | Lists participants |
| GET | `/api/raffles/{id}/winners` | Yes (`raffles`) | Lists winners |
| POST | `/api/raffles/winners/{winnerId}/reroll` | Yes (`raffles`) | Re-rolls a winner |
| POST | `/api/raffles/{id}/participants` | Yes (`raffles`) | Adds a participant manually |
| DELETE | `/api/raffles/{id}/participants/{participantId}` | Yes (`raffles`) | Removes a participant |
| POST | `/api/raffles/{id}/import-session` | Yes (`raffles`) | Imports participants from a timer session |
| GET | `/api/raffles/statistics` | Yes (`raffles`) | Raffle statistics |

---

## Goals

### GoalsController (`/api/goals`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/goals/config` | Yes (JWT + `overlays`) | Gets complete goals configuration |
| POST | `/api/goals/config` | Yes (JWT + `overlays`) | Saves complete goals configuration |
| GET | `/api/goals/config/overlay/{channelName}` | No | Gets overlay data for a channel (used by OBS) |
| POST | `/api/goals/{goalId}/progress` | Yes (JWT + `overlays`) | Increments progress of a goal by an amount |
| POST | `/api/goals/{goalId}/set` | Yes (JWT + `overlays`) | Sets absolute progress value for a goal |
| POST | `/api/goals/{goalId}/reset` | Yes (JWT + `overlays`) | Resets a goal to 0 |
| GET | `/api/goals/history` | Yes (JWT + `overlays`) | Gets event history (with `limit` parameter) |

---

## Shoutout

### ShoutoutController (`/api/shoutout`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/shoutout/config` | Yes (JWT) | Gets shoutout configuration for the active channel |
| GET | `/api/shoutout/config/overlay/{channel}` | No | Gets overlay configuration (public, for OBS) |
| POST | `/api/shoutout/config` | Yes (JWT) | Saves shoutout configuration |
| POST | `/api/shoutout/test` | Yes (JWT) | Sends a test shoutout to the overlay via SignalR |
| GET | `/api/shoutout/history` | Yes (JWT) | Gets shoutout history (query param: `limit`, default 50) |

---

## Now Playing / Spotify

### NowPlayingController (`/api/nowplaying`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/nowplaying/config` | Yes (JWT + `overlays`) | Gets Now Playing configuration |
| POST | `/api/nowplaying/config` | Yes (JWT + `overlays`) | Saves configuration |
| POST | `/api/nowplaying/connect/lastfm` | Yes (JWT + `overlays`) | Connects Last.fm with username |
| POST | `/api/nowplaying/validate/lastfm` | Yes (JWT + `overlays`) | Validates that a Last.fm username exists |
| POST | `/api/nowplaying/disconnect` | Yes (JWT + `overlays`) | Disconnects the current provider |
| GET | `/api/nowplaying/config/overlay/{channelName}` | No | Gets overlay config for OBS |
| GET | `/api/nowplaying/now/{channelName}` | No | Gets the current song for a channel |
| GET | `/api/nowplaying/spotify-cupos` | No | Info about available Spotify slots |
| POST | `/api/nowplaying/request-spotify-cupo` | Yes (JWT + `overlays`) | Requests a Spotify slot |
| GET | `/api/nowplaying/admin/spotify-cupos` | Yes (JWT + Admin) | Lists Spotify slot requests |
| POST | `/api/nowplaying/admin/assign-cupo/{userId}` | Yes (JWT + Admin) | Assigns a Spotify slot to a user |
| POST | `/api/nowplaying/admin/revoke-cupo/{userId}` | Yes (JWT + Admin) | Revokes a Spotify slot from a user |
| POST | `/api/nowplaying/test` | Yes (JWT + `overlays`) | Sends a test track to the overlay |

### SpotifyController (`/api/spotify`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/spotify/authorize-url` | Yes (JWT + `overlays`) | Gets Spotify OAuth authorization URL |
| GET | `/api/spotify/callback` | No | Spotify OAuth callback |
| POST | `/api/spotify/disconnect` | Yes (JWT + `overlays`) | Disconnects Spotify |
| GET | `/api/spotify/status` | Yes (JWT + `overlays`) | Checks if Spotify is connected |

---

## Moderation

### ModerationController (`/api/moderation`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/moderation/banned-words` | Yes (JWT + `moderation`) | Lists all banned words for the channel |
| POST | `/api/moderation/banned-words` | Yes (JWT + `moderation`) | Adds a new banned word |
| DELETE | `/api/moderation/banned-words/{id}` | Yes (JWT + `moderation`) | Deletes a banned word by ID |
| POST | `/api/moderation/banned-words/import` | Yes (JWT + `moderation`) | Imports words from JSON |
| GET | `/api/moderation/config` | Yes (JWT + `moderation`) | Gets moderation configuration |
| POST | `/api/moderation/config` | Yes (JWT + `moderation`) | Updates moderation configuration |
| POST | `/api/moderation/test-message` | Yes (JWT + `moderation`) | Tests a message against banned words |
| GET | `/api/moderation/stats` | Yes (JWT + `moderation`) | Gets today's moderation statistics |

---

## Followers

### FollowersController (`/api/followers`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/followers` | Yes (`commands`) | Lists followers with filters, sorting, and pagination |
| GET | `/api/followers/{userId}/history` | Yes (`commands`) | History of a specific follower |
| POST | `/api/followers/{userId}/block` | Yes (`moderation`) | Blocks a follower |
| POST | `/api/followers/{userId}/unblock` | Yes (`moderation`) | Unblocks a follower |
| GET | `/api/followers/stats` | Yes (`commands`) | Aggregated follower statistics |
| POST | `/api/followers/sync` | Yes (`commands`) | Synchronizes followers from Twitch API |

---

## Analytics

### AnalyticsController (`/api/analytics`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/analytics` | Yes (`analytics`/`moderation`) | Gets all analytics data for a date range |
| GET | `/api/analytics/export` | Yes (`analytics_export`/`control_total`) | Exports analytics as CSV |

---

## Scripting

### ScriptsController (`/api/scripts`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/scripts` | Yes (JWT) | Lists scripts for the active channel |
| GET | `/api/scripts/{id}` | Yes (JWT) | Gets a script by ID |
| POST | `/api/scripts/validate` | Yes (JWT) | Validates script syntax |
| POST | `/api/scripts/preview` | Yes (JWT) | Executes preview with simulated data |
| POST | `/api/scripts` | Yes (JWT + `commands`) | Creates a new script |
| PUT | `/api/scripts/{id}` | Yes (JWT + `commands`) | Updates an existing script |
| DELETE | `/api/scripts/{id}` | Yes (JWT + `moderation`) | Deletes a script |

---

## Micro Commands

### MicroCommandsController (`/api/commands/microcommands`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/commands/microcommands` | Yes (`commands`) | Lists micro commands |
| POST | `/api/commands/microcommands` | Yes (`commands`) | Creates/updates a micro command |
| PUT | `/api/commands/microcommands/{id}` | Yes (`commands`) | Updates a micro command |
| DELETE | `/api/commands/microcommands/{id}` | Yes (`moderation`) | Deletes a micro command |
| GET | `/api/commands/microcommands/search/{command}` | Yes (`commands`) | Searches for a micro command |
| GET | `/api/commands/microcommands/check-availability/{command}` | Yes (`commands`) | Checks command name availability |
| GET | `/api/commands/microcommands/status` | Yes (`commands`) | Status and permissions |
| GET | `/api/commands/microcommands/search-games` | Yes (`commands`) | Searches games for autocomplete. Query params: `q`, `limit` |

---

## Game Commands

### GameCommandController (`/api/commands/game`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/commands/game/current` | Yes (`game`) | Gets current stream category |
| POST | `/api/commands/game/update` | Yes (`game`) | Changes the stream category |
| GET | `/api/commands/game/history` | Yes (`game`) | Gets category change history |
| POST | `/api/commands/game/toggle` | Yes (`control_total`) | Enables/disables the `!game` command |
| GET | `/api/commands/game/status` | Yes (`game`) | Gets the game command status |

---

## DecatronAI (Twitch Chat AI)

### DecatronAIController (`/api/decatron-ai`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/decatron-ai/check-access` | Yes (JWT + `control_total`) | Checks if user can configure AI for the channel |
| GET | `/api/decatron-ai/config` | Yes (JWT + `control_total` + CanConfigure) | Gets channel AI config + global defaults |
| POST | `/api/decatron-ai/config` | Yes (JWT + `control_total` + CanConfigure) | Updates channel AI configuration |
| GET | `/api/decatron-ai/stats` | Yes (JWT + `control_total` + CanConfigure) | Channel AI usage statistics |

---

## DecatronAI Admin

### DecatronAIAdminController (`/api/admin/decatron-ai`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/admin/decatron-ai/global-config` | Yes (Owner) | Gets global AI configuration |
| POST | `/api/admin/decatron-ai/global-config` | Yes (Owner) | Updates global AI configuration |
| GET | `/api/admin/decatron-ai/channels` | Yes (Owner) | Lists channels with AI permissions |
| POST | `/api/admin/decatron-ai/channels` | Yes (Owner) | Adds a channel to AI |
| PUT | `/api/admin/decatron-ai/channels/{channelName}` | Yes (Owner) | Updates channel AI permission |
| DELETE | `/api/admin/decatron-ai/channels/{channelName}` | Yes (Owner) | Removes a channel from AI |
| GET | `/api/admin/decatron-ai/channels/{channelName}/config` | Yes (Owner) | Gets config for a specific channel |
| POST | `/api/admin/decatron-ai/channels/{channelName}/config` | Yes (Owner) | Updates config for a specific channel |
| GET | `/api/admin/decatron-ai/stats` | Yes (Owner) | Global AI usage statistics |
| GET | `/api/admin/decatron-ai/check-owner` | Yes (JWT) | Checks if current user is system owner |

---

## Settings

### SettingsController (`/api/settings`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/settings/update` | Yes (JWT + `settings:control_total`) | Updates bot settings (enable/disable) |
| POST | `/api/settings/add-access` | Yes (JWT + `user_management:control_total`) | Adds an authorized user to the channel |
| DELETE | `/api/settings/remove-access/{accessId}` | Yes (JWT + `user_management:control_total`) | Removes an authorized user (soft delete) |
| GET | `/api/settings/bot/status` | Yes (JWT) | Bot status, connected channels, user permissions |
| GET | `/api/settings/channel-users` | Yes (JWT + `user_management:control_total`) | Lists users with access to the channel |
| GET | `/api/settings/frontend-info` | Yes (JWT) | Frontend URL and channel info |

---

## Language

### LanguageController (`/api/language`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/language` | Yes (JWT) | Gets the user's preferred language |
| PUT | `/api/language` | Yes (JWT) | Updates the user's preferred language |
| GET | `/api/language/supported` | No | Lists supported languages (`es`, `en`) |

---

## TTS (Text-to-Speech)

### TtsController (`/api/tts`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/tts/generate` | Yes (JWT) | Generates TTS audio via Amazon Polly. Returns a URL to the cached `.mp3` file |

**Request body:**

```json
{
  "text": "Text to speak",
  "voiceId": "Lupe",
  "engine": "neural",
  "languageCode": "es-MX"
}
```

---

## User Permissions

### UserPermissionsController (`/api/user`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/user/permissions` | Yes (JWT) | Gets user permissions for the active channel |
| GET | `/api/user/available-accounts` | Yes (JWT) | Gets accounts available for channel switching |
| GET | `/api/user/channel-users` | Yes (JWT + `user_management:control_total`) | Lists users with access to the channel |

---

## WebSocket / SignalR Hubs

Decatron uses SignalR for real-time communication with overlays (OBS Browser Sources) and the dashboard.

### Connection

```
Hub URL: /hubs/overlay
```

Connect using the `@microsoft/signalr` client library. No authentication is currently required for overlay connections.

### Client-to-Server Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `JoinChannel` | `channel: string` | Joins the overlay group `overlay_{channel}` to receive events |
| `LeaveChannel` | `channel: string` | Leaves the overlay group |
| `UpdateTimer` | `channel: string, state: object` | Sends timer state to the group |
| `TimerCommand` | `channel: string, command: string, parameters?: object` | Sends a timer command to the group |
| `ConfigurationChanged` | `channel: string` | Notifies configuration change |

### Server-to-Client Events

| Event | Description |
|-------|-------------|
| `ShowShoutout` | Displays a shoutout in the overlay |
| `ShowSoundAlert` | Displays a sound alert in the overlay |
| `ShowEventAlert` | Displays an event alert (follow, sub, bits, etc.) |
| `ConfigurationChanged` | Configuration has been updated |
| `RefreshOverlay` | Overlay should refresh its state |
| `StartTimer` | Timer started |
| `PauseTimer` | Timer paused |
| `ResumeTimer` | Timer resumed |
| `ResetTimer` | Timer reset |
| `StopTimer` | Timer stopped |
| `AddTime` | Time added to timer |
| `TimerEventAlert` | Timer event alert (bits, sub, raid triggered time addition) |
| `TimerTick` | Timer tick (every second) |
| `TimerStateUpdate` | Full timer state update |
| `TimerCommandExecuted` | Timer command was executed |
| `TimerConfigChanged` | Timer configuration changed |
| `GiveawayParticipantJoined` | A participant joined a giveaway |
| `GoalsConfigChanged` | Goals configuration changed |
| `GoalProgress` | Goal progress updated |
| `GoalCompleted` | A goal was completed |
| `GoalMilestone` | A goal milestone was reached |
| `EventAlertsConfigChanged` | Event alerts configuration changed |
| `NowPlayingUpdate` | Now Playing track changed |

---

## Static File Endpoints

These routes serve static files directly from the filesystem:

| Route | Description |
|-------|-------------|
| `/downloads/*` | Downloaded Twitch clips |
| `/uploads/soundalerts/*` | Uploaded sound alert files |
| `/timerextensible/*` | Timer extension media files |
| `/tts-audio/*` | Cached TTS audio files generated by AWS Polly |
| `/system-files/*` | System files (pre-loaded sounds, images) |
| `/swagger` | Swagger UI API documentation (Development only) |

---

## Overlay URLs (Public Pages)

These are the public overlay URLs designed to be added as OBS Browser Sources. They do not require authentication and receive the channel name via the `?channel=` query parameter.

| URL | Recommended Size | Description |
|-----|-----------------|-------------|
| `/overlay/shoutout?channel={name}` | 1000x300 | Shoutout overlay with clip playback |
| `/overlay/soundalerts?channel={name}` | 400x450 | Sound alerts triggered by Channel Points |
| `/overlay/timer?channel={name}` | Variable | Extensible timer (subathon-style) |
| `/overlay/event-alerts?channel={name}` | 1920x1080 | Event alerts (follows, subs, bits, raids, etc.) |
| `/overlay/tips?channel={name}` | Variable | Donation/tip alerts |
| `/overlay/goals?channel={name}` | Variable | Goal progress bars |
| `/overlay/giveaway?channel={name}` | Variable | Giveaway overlay |
| `/overlay/now-playing?channel={name}` | Variable | Now Playing music widget |

### Public Pages (No Auth)

| URL | Description |
|-----|-------------|
| `/tip/{channelName}` | Public donation page |
| `/donate/{channelName}` | Alias for `/tip/{channelName}` |
| `/supporters` | Public supporters page |
| `/oauth/authorize` | OAuth2 authorization page |
| `/docs/*` | Public documentation |

---

## Error Format

API errors are returned as JSON objects. The standard format is:

```json
{
  "success": false,
  "message": "Description of the error"
}
```

For validation errors:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["Field X is required", "Field Y must be positive"]
}
```

HTTP status codes used:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (validation error, missing parameters) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Rate Limiting

Rate limiting is **not yet implemented**. All endpoints are currently unprotected against excessive requests. This is planned for a future release.

Public endpoints that are particularly sensitive to abuse:

- `POST /api/tips/paypal/create-order` -- PayPal order creation
- `POST /api/tips/paypal/capture-order` -- PayPal order capture
- `POST /api/supporters/create-paypal-order` -- Supporter PayPal orders
- `POST /api/gacha-auth/validate` -- Credential validation (brute-force risk)
- `POST /api/tts/generate` -- TTS generation (AWS cost risk)
- `GET /api/eventalerts/config/overlay/{channel}` -- Overlay config enumeration
- `GET /api/timer/state/{channel}` -- Timer state enumeration
- All `[AllowAnonymous]` overlay config endpoints
