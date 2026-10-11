# Decatron v2 API Reference

> Español: [es/API.md](es/API.md)

Reference of the Decatron HTTP API. All endpoints are served from the base URL of your Decatron instance (for example `https://decatron.net`).

There are two kinds of endpoints:

- **Public API** (`/api/v1`, plus the OAuth2 flow and the developer portal): meant for third-party apps. It uses OAuth2 access tokens and scopes, and is documented in detail below.
- **Dashboard endpoints**: they serve the Decatron web app with the signed-in user's JWT. They are listed under [More Endpoints](#more-endpoints) by controller, with their access level. Their shapes can change without notice. The endpoints of each overlay module are described, with their purpose, in [OVERLAYS.md](OVERLAYS.md); the commands, scripting, micro command and moderation endpoints in [COMMANDS.md](COMMANDS.md).

---

## Table of Contents

- [Authentication](#authentication)
- [Auth / Login](#auth--login)
- [OAuth2 API (Public Developer API)](#oauth2-api-public-developer-api)
- [Public API v1](#public-api-v1)
- [Developer Portal](#developer-portal)
- [More Endpoints](#more-endpoints)
- [WebSocket / SignalR Hubs](#websocket--signalr-hubs)
- [Static File Endpoints](#static-file-endpoints)
- [Overlay URLs (Public Pages)](#overlay-urls-public-pages)
- [Error Format](#error-format)
- [Rate Limiting](#rate-limiting)

---

## Authentication

Decatron uses two independent authentication systems:

### 1. JWT (User Sessions)

Used by the dashboard and all authenticated endpoints. Obtained through the Twitch, Kick or Discord login flow.

**How to get a token:**

1. Redirect the user to `GET /api/auth/login` (Twitch), `GET /api/auth/kick/login` (Kick) or `GET /api/auth/discord/login` (Discord)
2. The platform authenticates the user and redirects to the matching callback (`GET /api/auth/callback`, `/api/auth/kick/callback`, `/api/auth/discord/callback`)
3. The backend generates a JWT, keeps it for 60 seconds behind a one-time code and redirects to the frontend at `/login?code=<code>`
4. The frontend exchanges the code for the JWT with `POST /api/auth/exchange` (body `{ "code": "..." }`, response `{ "token": "..." }`); the code works once

**Header format:**

```
Authorization: Bearer <JWT_TOKEN>
```

The JWT is issued after a Twitch, Kick or Discord login. It contains the claims `NameIdentifier` (internal user ID), `Name`, `GivenName`, `AuthProvider`, `TwitchId`, `KickId`, `DiscordId`, `ProfileImage` and `Email`. The active channel is not part of the token: it is kept in the session (`POST /api/channel/switch`).

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

**Available OAuth Scopes (25 scopes in 3 categories):**

| Category | Scopes |
|----------|--------|
| Read | `read:profile`, `read:timer`, `read:commands`, `read:alerts`, `read:giveaways`, `read:analytics`, `read:sounds`, `read:games`, `read:stream` |
| Write | `write:timer`, `write:commands`, `write:alerts`, `write:giveaways`, `write:sounds` |
| Action | `action:timer`, `action:alerts`, `action:chat`, `action:giveaway`, `action:sounds`, `action:category`, `action:title`, `action:marker` |

`action:chat` requires app verification.

---

## Auth / Login

### AuthController (`/api/auth`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/auth/login` | No | Redirects to Twitch OAuth login. Accepts optional `?redirect=` parameter |
| GET | `/api/auth/callback` | No | Twitch OAuth callback. Exchanges code for tokens, creates/updates user, generates JWT, redirects to frontend |
| GET | `/api/auth/validate-scopes/{twitchId}` | Yes (JWT) | Validates stored Twitch token scopes for a user |
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

## Public API v1

The endpoints under `/api/v1` are the public API for third-party apps. They need an OAuth2 access token (see [Authentication](#2-oauth2-public-api-for-third-party-apps)) with the scope shown for each one, and they always act on the channel of the user who authorized the token. Errors use the form `{ "error": "code" }`; successful actions return `{ "success": true, "message": "..." }`.

| Method | Route | Scope | Body / query | Description |
|--------|-------|-------|--------------|-------------|
| GET | `/api/v1/timer` | `read:timer` | | Timer state: `status`, `currentTime`, `totalTime`, `isRunning`, `isPaused`, `isVisible`, `startedAt`, `pausedAt` |
| POST | `/api/v1/timer/start` | `action:timer` | `duration` (seconds, optional; default 300) | Starts the timer |
| POST | `/api/v1/timer/pause` | `action:timer` | | Pauses the timer (`timer_not_running` if it is not running) |
| POST | `/api/v1/timer/resume` | `action:timer` | | Resumes the timer (`timer_not_paused` if it is not paused) |
| POST | `/api/v1/timer/stop` | `action:timer` | | Stops the timer |
| POST | `/api/v1/timer/add` | `action:timer` | `seconds` | Adds seconds; returns `newTotalTime` |
| POST | `/api/v1/chat/send` | `action:chat` | `message` | Sends a message to the channel chat. The scope requires app verification |
| GET | `/api/v1/twitch/games/search` | `read:games` | `query` | Searches Twitch categories; returns `id`, `name` and `box_art_url` |
| POST | `/api/v1/twitch/category` | `action:category` | `gameId` or `gameName` | Changes the stream category |
| POST | `/api/v1/twitch/title` | `action:title` | `title` | Changes the stream title |
| POST | `/api/v1/twitch/marker` | `action:marker` | `description` (optional) | Creates a stream marker (`stream_not_live` if offline) |
| GET | `/api/v1/twitch/live-info` | `read:stream` | | `isLive`, `category`, `title`, `viewers`, `lastFollower` |
| GET | `/api/v1/sounds` | `read:sounds` | | Lists the channel's configured sound alerts (`id`, `name`) |
| POST | `/api/v1/sounds/play` | `action:sounds` | `soundId` | Triggers one of those sound alerts in the overlay |
| POST | `/api/v1/alerts/trigger` | `action:alerts` | `eventType`; optional `username`, `message`, `amount` | Triggers an event alert in the overlay |

Common error codes: `channel_not_found`, `message_required`, `title_required`, `game_id_or_game_name_required`, `category_not_found_or_update_failed`, `sound_id_required`, `sound_not_found`, `event_type_required`.

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

## More Endpoints

The endpoints below are the rest of the routes of the backend, generated from the controllers (the list is regenerated when controllers change). They serve the Decatron web app: they use the signed-in user's JWT, and their request and response shapes can change without notice. They are not part of the public API.

**Access** reflects the attributes declared on each route: `Public` means no attribute restricts it, `JWT` an authenticated user, `JWT + section` an authenticated user with the permission level that section requires (see [CONFIGURATION.md](CONFIGURATION.md#permission-system)). Some endpoints make extra checks in code, for example owner-only actions. Routes restricted to platform administrators (`RequireSystemOwner`) are not listed.

<!-- BEGIN GENERATED ENDPOINTS -->

### Analytics

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/analytics` | JWT + `analytics` |
| `GET` | `/api/analytics/export` | JWT + `analytics_export` |

### Auth

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/auth/account-channels` | JWT |
| `POST` | `/api/auth/exchange` | Public |
| `POST` | `/api/auth/link-account-start` | JWT |
| `GET` | `/api/auth/link-twitch` | Public |
| `POST` | `/api/auth/link-twitch-start` | JWT |
| `POST` | `/api/auth/switch-channel` | JWT |
| `POST` | `/api/auth/unlink-account` | JWT |
| `POST` | `/api/auth/unlink-twitch` | JWT |

### Bot List

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/botlist` | JWT + `moderation` |
| `POST` | `/api/botlist/catalog` | JWT |
| `DELETE` | `/api/botlist/catalog/{id}` | JWT |
| `PUT` | `/api/botlist/catalog/{id}` | JWT |
| `PUT` | `/api/botlist/category/{category}` | JWT + `moderation` |
| `POST` | `/api/botlist/custom` | JWT + `moderation` |
| `DELETE` | `/api/botlist/custom/{id}` | JWT + `moderation` |
| `PUT` | `/api/botlist/entry` | JWT + `moderation` |

### Brand

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/brand` | Public |

### Channel Emotes

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/channel-emotes` | JWT + `moderation` |
| `POST` | `/api/channel-emotes` | JWT + `moderation` |
| `POST` | `/api/channel-emotes/history/purge` | JWT + `moderation` |
| `GET` | `/api/channel-emotes/reports` | JWT + `moderation` |
| `POST` | `/api/channel-emotes/review-batch` | JWT + `moderation` |
| `PUT` | `/api/channel-emotes/settings` | JWT + `moderation` |
| `GET` | `/api/channel-emotes/uploaders` | JWT + `moderation` |
| `POST` | `/api/channel-emotes/uploaders` | JWT + `moderation` |
| `DELETE` | `/api/channel-emotes/uploaders/{id}` | JWT + `moderation` |
| `DELETE` | `/api/channel-emotes/{id}` | JWT + `moderation` |
| `PUT` | `/api/channel-emotes/{id}` | JWT + `moderation` |
| `POST` | `/api/channel-emotes/{id}/reports/dismiss` | JWT + `moderation` |
| `POST` | `/api/channel-emotes/{id}/review` | JWT + `moderation` |

### Channel Switch

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/channel/available` | JWT |
| `GET` | `/api/channel/context` | JWT |
| `POST` | `/api/channel/switch` | JWT |

### Channels

| Method | Route | Access |
|---|---|---|
| `PATCH` | `/api/Channels/admin/{id}/visibility` | JWT |
| `GET` | `/api/Channels/admin/{platform}` | JWT |
| `GET` | `/api/Channels/carousel` | Public |

### Chat Admin

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/admin/chat/audit` | JWT |
| `GET` | `/api/admin/chat/audit/conversations` | JWT |
| `GET` | `/api/admin/chat/available-users` | JWT |
| `GET` | `/api/admin/chat/config` | JWT |
| `POST` | `/api/admin/chat/config` | JWT |
| `GET` | `/api/admin/chat/permissions` | JWT |
| `POST` | `/api/admin/chat/permissions` | JWT |
| `DELETE` | `/api/admin/chat/permissions/{id}` | JWT |
| `PUT` | `/api/admin/chat/permissions/{id}` | JWT |
| `GET` | `/api/admin/chat/stats` | JWT |

### Chat

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/chat/check-access` | JWT |
| `GET` | `/api/chat/conversations` | JWT |
| `POST` | `/api/chat/conversations` | JWT |
| `DELETE` | `/api/chat/conversations/{id}` | JWT |
| `GET` | `/api/chat/conversations/{id}` | JWT |
| `POST` | `/api/chat/conversations/{id}/messages` | JWT |
| `POST` | `/api/chat/conversations/{id}/messages/stream` | JWT |

### Chat Overlay

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/chat-overlay/config` | JWT + `moderation` |
| `PUT` | `/api/chat-overlay/config` | JWT + `moderation` |
| `GET` | `/api/chat-overlay/config/overlay/{channel}` | JWT |
| `GET` | `/api/chat-overlay/emotes` | JWT + `moderation` |
| `POST` | `/api/chat-overlay/emotes/refresh` | JWT + `moderation` |
| `GET` | `/api/chat-overlay/resolve/{channel}` | JWT |
| `GET` | `/api/chat-overlay/status` | JWT + `moderation` |
| `POST` | `/api/chat-overlay/test` | JWT + `moderation` |

### Clip Command

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/clipcommand/blocks` | JWT + `settings` |
| `POST` | `/api/clipcommand/blocks` | JWT + `settings` |
| `DELETE` | `/api/clipcommand/blocks/{id}` | JWT + `settings` |
| `GET` | `/api/clipcommand/config` | JWT + `settings` |
| `PUT` | `/api/clipcommand/config` | JWT + `settings` |
| `GET` | `/api/clipcommand/history` | JWT + `settings` |
| `DELETE` | `/api/clipcommand/history/{id}` | JWT + `settings` |
| `PUT` | `/api/clipcommand/messages` | JWT + `settings` |

### Coin

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/coins/balance` | JWT |
| `POST` | `/api/coins/billing-preview` | JWT |
| `POST` | `/api/coins/buy` | JWT |
| `GET` | `/api/coins/culqi-public-key` | JWT |
| `GET` | `/api/coins/history` | JWT |
| `GET` | `/api/coins/my-invoices` | JWT |
| `GET` | `/api/coins/my-invoices/{purchaseId}/download/{formato}` | JWT |
| `GET` | `/api/coins/packages` | JWT |
| `GET` | `/api/coins/referral` | JWT |
| `POST` | `/api/coins/referral/apply` | JWT |
| `GET` | `/api/coins/search-users` | JWT |
| `POST` | `/api/coins/transfer` | JWT |
| `POST` | `/api/coins/validate-code` | JWT |

### Commands

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/commands/default` | JWT |
| `GET` | `/api/commands/{commandName}/status` | JWT |
| `POST` | `/api/commands/{commandName}/toggle` | JWT |

### Credit Purchase

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/tts-credits/billing-preview` | JWT |
| `POST` | `/api/tts-credits/buy` | JWT |
| `GET` | `/api/tts-credits/packages` | JWT |
| `GET` | `/api/tts-credits/purchases` | JWT |
| `GET` | `/api/tts-credits/purchases/{purchaseId}/download/{formato}` | JWT |

### Custom Commands

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/CustomCommands` | JWT |
| `POST` | `/api/CustomCommands` | JWT |
| `DELETE` | `/api/CustomCommands/{id}` | JWT |
| `GET` | `/api/CustomCommands/{id}` | JWT |
| `PUT` | `/api/CustomCommands/{id}` | JWT |

### Decatron AI

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/decatron-ai/check-access` | JWT |
| `GET` | `/api/decatron-ai/config` | JWT |
| `POST` | `/api/decatron-ai/config` | JWT |
| `GET` | `/api/decatron-ai/stats` | JWT |

### Design

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/design/tokens` | Public |

### Desktop

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/desktop/devices` | JWT + `settings` |
| `POST` | `/api/desktop/devices/claim` | Public |
| `POST` | `/api/desktop/devices/link-code` | JWT + `settings` |
| `DELETE` | `/api/desktop/devices/{id}` | JWT + `settings` |
| `GET` | `/api/desktop/releases/latest` | Public |

### Discord Auth

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/auth/discord/exchange` | Public |
| `GET` | `/api/auth/discord/link` | Public |
| `POST` | `/api/auth/discord/link-start` | JWT |
| `GET` | `/api/auth/discord/login` | Public |
| `GET` | `/api/auth/discord/me` | JWT |
| `POST` | `/api/auth/discord/unlink` | JWT |

### Discord Levels

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/discord/levels/rankcard/templates` | JWT + `settings` |
| `GET` | `/api/discord/levels/{guildId}` | JWT + `settings` |
| `PUT` | `/api/discord/levels/{guildId}` | JWT + `settings` |
| `GET` | `/api/discord/levels/{guildId}/achievements` | JWT + `settings` |
| `POST` | `/api/discord/levels/{guildId}/achievements` | JWT + `settings` |
| `DELETE` | `/api/discord/levels/{guildId}/achievements/all-users` | JWT + `settings` |
| `DELETE` | `/api/discord/levels/{guildId}/achievements/user/{userId}` | JWT + `settings` |
| `DELETE` | `/api/discord/levels/{guildId}/achievements/{achievementId}` | JWT + `settings` |
| `PUT` | `/api/discord/levels/{guildId}/achievements/{achievementId}` | JWT + `settings` |
| `GET` | `/api/discord/levels/{guildId}/boosts` | JWT + `settings` |
| `POST` | `/api/discord/levels/{guildId}/boosts` | JWT + `settings` |
| `GET` | `/api/discord/levels/{guildId}/rankcard` | JWT + `settings` |
| `PUT` | `/api/discord/levels/{guildId}/rankcard` | JWT + `settings` |
| `DELETE` | `/api/discord/levels/{guildId}/rankcard/level/{levelMin}` | JWT + `settings` |
| `GET` | `/api/discord/levels/{guildId}/rankcard/level/{levelMin}` | JWT + `settings` |
| `PUT` | `/api/discord/levels/{guildId}/rankcard/level/{levelMin}` | JWT + `settings` |
| `GET` | `/api/discord/levels/{guildId}/rankcard/levels` | JWT + `settings` |
| `DELETE` | `/api/discord/levels/{guildId}/roles` | JWT + `settings` |
| `GET` | `/api/discord/levels/{guildId}/roles` | JWT + `settings` |
| `POST` | `/api/discord/levels/{guildId}/roles` | JWT + `settings` |
| `POST` | `/api/discord/levels/{guildId}/roles/cleanup-discord` | JWT + `settings` |
| `POST` | `/api/discord/levels/{guildId}/roles/create-defaults` | JWT + `settings` |
| `POST` | `/api/discord/levels/{guildId}/roles/sync-discord` | JWT + `settings` |
| `POST` | `/api/discord/levels/{guildId}/roles/sync-users` | JWT + `settings` |
| `DELETE` | `/api/discord/levels/{guildId}/roles/{roleId}` | JWT + `settings` |
| `PUT` | `/api/discord/levels/{guildId}/roles/{roleId}` | JWT + `settings` |
| `DELETE` | `/api/discord/levels/{guildId}/seasonal` | JWT + `settings` |
| `GET` | `/api/discord/levels/{guildId}/seasonal` | JWT + `settings` |
| `GET` | `/api/discord/levels/{guildId}/store` | JWT + `settings` |
| `POST` | `/api/discord/levels/{guildId}/store` | JWT + `settings` |
| `GET` | `/api/discord/levels/{guildId}/store/pending` | JWT + `settings` |
| `DELETE` | `/api/discord/levels/{guildId}/store/purchases` | JWT + `settings` |
| `GET` | `/api/discord/levels/{guildId}/store/purchases` | JWT + `settings` |
| `PUT` | `/api/discord/levels/{guildId}/store/purchases/{purchaseId}/deliver` | JWT + `settings` |
| `DELETE` | `/api/discord/levels/{guildId}/store/purchases/{userId}` | JWT + `settings` |
| `DELETE` | `/api/discord/levels/{guildId}/store/{itemId}` | JWT + `settings` |
| `PUT` | `/api/discord/levels/{guildId}/store/{itemId}` | JWT + `settings` |
| `POST` | `/api/discord/levels/{guildId}/store/{itemId}/buy` | JWT + `settings` |
| `POST` | `/api/discord/levels/{guildId}/test/levelup` | JWT + `settings` |
| `GET` | `/api/discord/levels/{guildId}/users` | JWT + `settings` |
| `PUT` | `/api/discord/levels/{guildId}/users/{userId}` | JWT + `settings` |
| `DELETE` | `/api/discord/levels/{guildId}/users/{userId}/full-reset` | JWT + `settings` |

### Discord Live Alerts

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/discord/alerts/search/{channelName}` | JWT + `settings` |
| `DELETE` | `/api/discord/alerts/{alertId}` | JWT + `settings` |
| `PUT` | `/api/discord/alerts/{alertId}` | JWT + `settings` |
| `GET` | `/api/discord/alerts/{guildId}` | JWT + `settings` |
| `POST` | `/api/discord/alerts/{guildId}` | JWT + `settings` |
| `GET` | `/api/discord/alerts/{guildId}/status` | JWT + `settings` |

### Discord OAuth

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/discord/auth` | JWT + `settings` |
| `GET` | `/api/discord/callback` | Public |
| `GET` | `/api/discord/channels/{guildId}` | JWT + `settings` |
| `PUT` | `/api/discord/config/{guildId}` | JWT + `settings` |
| `GET` | `/api/discord/guilds` | JWT + `settings` |
| `POST` | `/api/discord/link` | JWT + `settings` |
| `GET` | `/api/discord/linked` | JWT + `settings` |
| `GET` | `/api/discord/status` | JWT |
| `DELETE` | `/api/discord/unlink/{guildId}` | JWT + `settings` |

### Discord Welcome

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/discord/welcome/{guildId}` | JWT + `settings` |
| `PUT` | `/api/discord/welcome/{guildId}` | JWT + `settings` |
| `GET` | `/api/discord/welcome/{guildId}/roles` | JWT + `settings` |
| `POST` | `/api/discord/welcome/{guildId}/test` | JWT + `settings` |
| `POST` | `/api/discord/welcome/{guildId}/upload-image` | JWT + `settings` |

### Epic Auth

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/auth/epic/callback` | Public |
| `GET` | `/api/me/epic/login-url` | JWT |
| `GET` | `/api/me/epic/status` | JWT |

### Event Alerts

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/EventAlerts/config` | JWT |
| `POST` | `/api/EventAlerts/config` | JWT |
| `GET` | `/api/EventAlerts/config/overlay/{channelName}` | JWT |
| `POST` | `/api/EventAlerts/test` | JWT |

### Followers

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/Followers` | JWT |
| `GET` | `/api/Followers/stats` | JWT |
| `POST` | `/api/Followers/sync` | JWT |
| `POST` | `/api/Followers/{userId}/block` | JWT |
| `GET` | `/api/Followers/{userId}/history` | JWT |
| `POST` | `/api/Followers/{userId}/unblock` | JWT |

### Fortnite

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/fortnite/collection/{username}` | Public |
| `GET` | `/api/fortnite/current-season` | Public |
| `GET` | `/api/fortnite/leaderboard/global` | Public |
| `GET` | `/api/fortnite/my-collection` | JWT |
| `POST` | `/api/fortnite/my-collection/mark` | JWT |
| `DELETE` | `/api/fortnite/my-collection/{spriteKey}` | JWT |
| `GET` | `/api/fortnite/new-since-last-visit` | JWT |
| `GET` | `/api/fortnite/notification-prefs` | JWT |
| `PUT` | `/api/fortnite/notification-prefs` | JWT |
| `GET` | `/api/fortnite/sprites` | Public |

### Gacha Auth

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/gacha-auth/config` | Public |
| `POST` | `/api/gacha-auth/link` | JWT |
| `GET` | `/api/gacha-auth/status` | JWT |
| `POST` | `/api/gacha-auth/unlink` | JWT |
| `POST` | `/api/gacha-auth/validate` | Public |

### Gacha

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/gacha/banners` | JWT + `raffles` |
| `POST` | `/api/gacha/banners` | JWT + `raffles` |
| `DELETE` | `/api/gacha/banners/{id}` | JWT + `raffles` |
| `POST` | `/api/gacha/banners/{id}/activate` | JWT + `raffles` |
| `POST` | `/api/gacha/bonus-pulls` | JWT + `raffles` |
| `GET` | `/api/gacha/command-aliases` | JWT + `raffles` |
| `POST` | `/api/gacha/command-aliases` | JWT + `raffles` |
| `DELETE` | `/api/gacha/command-aliases/{alias}` | JWT + `raffles` |
| `GET` | `/api/gacha/command-configs` | JWT + `raffles` |
| `PUT` | `/api/gacha/command-configs/{command}` | JWT + `raffles` |
| `POST` | `/api/gacha/donations` | JWT + `raffles` |
| `GET` | `/api/gacha/integration-config` | JWT + `raffles` |
| `POST` | `/api/gacha/integration-config` | JWT + `raffles` |
| `GET` | `/api/gacha/inventory/{participantId}` | JWT + `raffles` |
| `GET` | `/api/gacha/items` | JWT + `raffles` |
| `POST` | `/api/gacha/items` | JWT + `raffles` |
| `DELETE` | `/api/gacha/items/{id}` | JWT + `raffles` |
| `PUT` | `/api/gacha/items/{id}` | JWT + `raffles` |
| `GET` | `/api/gacha/logs/{participantId}` | JWT + `raffles` |
| `GET` | `/api/gacha/most-wished` | JWT + `raffles` |
| `GET` | `/api/gacha/overlay-config` | JWT + `raffles` |
| `POST` | `/api/gacha/overlay-config` | JWT + `raffles` |
| `GET` | `/api/gacha/participants` | JWT + `raffles` |
| `DELETE` | `/api/gacha/participants/{participantId}/display-name` | JWT + `raffles` |
| `PUT` | `/api/gacha/participants/{participantId}/display-name` | JWT + `raffles` |
| `PUT` | `/api/gacha/participants/{participantId}/forced-item` | JWT + `raffles` |
| `GET` | `/api/gacha/preferences` | JWT + `raffles` |
| `POST` | `/api/gacha/preferences` | JWT + `raffles` |
| `DELETE` | `/api/gacha/preferences/{id}` | JWT + `raffles` |
| `PUT` | `/api/gacha/preferences/{id}` | JWT + `raffles` |
| `POST` | `/api/gacha/pull` | JWT + `raffles` |
| `GET` | `/api/gacha/rarity-config` | JWT + `raffles` |
| `POST` | `/api/gacha/rarity-config` | JWT + `raffles` |
| `GET` | `/api/gacha/rarity-restrictions` | JWT + `raffles` |
| `POST` | `/api/gacha/rarity-restrictions` | JWT + `raffles` |
| `DELETE` | `/api/gacha/rarity-restrictions/{id}` | JWT + `raffles` |
| `POST` | `/api/gacha/redeem/{inventoryId}` | JWT + `raffles` |
| `GET` | `/api/gacha/restrictions` | JWT + `raffles` |
| `POST` | `/api/gacha/restrictions` | JWT + `raffles` |
| `PUT` | `/api/gacha/restrictions/reorder-milestones` | JWT + `raffles` |
| `DELETE` | `/api/gacha/restrictions/{id}` | JWT + `raffles` |
| `PUT` | `/api/gacha/restrictions/{id}` | JWT + `raffles` |
| `GET` | `/api/gacha/sound-config` | JWT + `raffles` |
| `POST` | `/api/gacha/sound-config` | JWT + `raffles` |
| `GET` | `/api/gacha/stats/{participantId}` | JWT + `raffles` |

### Gacha Public

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/gacha/public/collection` | Public |
| `GET` | `/api/gacha/public/ranking` | Public |
| `GET` | `/api/gacha/public/sound-config/{channel}` | Public |

### Gacha Viewer

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/gacha/viewer/accept-terms` | JWT |
| `GET` | `/api/gacha/viewer/achievements/{participantId}` | JWT |
| `GET` | `/api/gacha/viewer/advanced-stats/{participantId}` | JWT |
| `POST` | `/api/gacha/viewer/buy-pulls` | JWT |
| `GET` | `/api/gacha/viewer/coin-price/{channelName}` | JWT |
| `GET` | `/api/gacha/viewer/collection/{channelName}` | JWT |
| `GET` | `/api/gacha/viewer/collections` | JWT |
| `GET` | `/api/gacha/viewer/inventory/{participantId}` | JWT |
| `POST` | `/api/gacha/viewer/privacy` | JWT |
| `POST` | `/api/gacha/viewer/redeem/{inventoryId}` | JWT |
| `GET` | `/api/gacha/viewer/settings` | JWT |
| `POST` | `/api/gacha/viewer/showcase` | JWT |
| `GET` | `/api/gacha/viewer/showcase/{participantId}` | JWT |
| `POST` | `/api/gacha/viewer/wishlist` | JWT |
| `GET` | `/api/gacha/viewer/wishlist/{participantId}` | JWT |
| `GET` | `/api/gacha/viewer/wishlist/{participantId}/available` | JWT |
| `DELETE` | `/api/gacha/viewer/wishlist/{participantId}/{itemId}` | JWT |

### Game Accounts

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/me/game-accounts` | JWT |
| `POST` | `/api/me/game-accounts` | JWT |
| `GET` | `/api/me/game-accounts/catalog` | JWT |
| `DELETE` | `/api/me/game-accounts/{id}` | JWT |
| `PUT` | `/api/me/game-accounts/{id}` | JWT |
| `POST` | `/api/me/game-accounts/{id}/verify` | JWT |

### Game

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/commands/game/current` | JWT + `game` |
| `GET` | `/api/commands/game/history` | JWT + `game` |
| `GET` | `/api/commands/game/status` | JWT + `game` |
| `POST` | `/api/commands/game/toggle` | JWT + `game` |
| `POST` | `/api/commands/game/update` | JWT + `game` |

### Game Overlays

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/game-overlays` | JWT + `overlays` |
| `POST` | `/api/game-overlays` | JWT + `overlays` |
| `POST` | `/api/game-overlays/force-game` | JWT + `overlays` |
| `GET` | `/api/game-overlays/overlay/{channel}` | JWT |
| `GET` | `/api/game-overlays/preview-public` | JWT |
| `GET` | `/api/game-overlays/promos` | JWT |
| `DELETE` | `/api/game-overlays/{slug}` | JWT + `overlays` |
| `GET` | `/api/game-overlays/{slug}` | JWT + `overlays` |
| `PUT` | `/api/game-overlays/{slug}` | JWT + `overlays` |
| `GET` | `/api/game-overlays/{slug}/preview` | JWT + `overlays` |

### Giveaway

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/Giveaway/active` | JWT + `giveaways` |
| `POST` | `/api/Giveaway/cancel` | JWT + `giveaways` |
| `GET` | `/api/Giveaway/config` | JWT + `giveaways` |
| `POST` | `/api/Giveaway/config` | JWT + `giveaways` |
| `POST` | `/api/Giveaway/disqualify` | JWT + `giveaways` |
| `POST` | `/api/Giveaway/end` | JWT + `giveaways` |
| `GET` | `/api/Giveaway/export` | JWT + `giveaways` |
| `GET` | `/api/Giveaway/history` | JWT + `giveaways` |
| `DELETE` | `/api/Giveaway/history/{id}` | JWT + `giveaways` |
| `GET` | `/api/Giveaway/participants` | JWT + `giveaways` |
| `POST` | `/api/Giveaway/reroll` | JWT + `giveaways` |
| `POST` | `/api/Giveaway/start` | JWT + `giveaways` |
| `GET` | `/api/Giveaway/statistics` | JWT + `giveaways` |

### Global Emotes

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/admin/global-emotes` | JWT |
| `POST` | `/api/admin/global-emotes` | JWT |
| `GET` | `/api/admin/global-emotes/check` | JWT |
| `GET` | `/api/admin/global-emotes/log` | JWT |
| `POST` | `/api/admin/global-emotes/managers` | JWT |
| `DELETE` | `/api/admin/global-emotes/managers/{id}` | JWT |
| `POST` | `/api/admin/global-emotes/requests/{id}/resolve` | JWT |
| `DELETE` | `/api/admin/global-emotes/{id}` | JWT |
| `PATCH` | `/api/admin/global-emotes/{id}` | JWT |
| `DELETE` | `/api/admin/global-emotes/{id}/purge` | JWT |
| `POST` | `/api/admin/global-emotes/{id}/restore` | JWT |
| `GET` | `/api/global-emotes/me` | JWT |
| `POST` | `/api/global-emotes/request` | JWT |
| `GET` | `/api/public/global-emotes` | Public |

### Kick Auth

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/auth/kick/link-start` | JWT |
| `GET` | `/api/auth/kick/login` | Public |
| `POST` | `/api/auth/kick/subscribe-rewards` | JWT |
| `POST` | `/api/auth/kick/unlink` | JWT |

### Kick Webhook

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/webhooks/kick/events` | Public |

### Language

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/Language` | JWT |
| `PUT` | `/api/Language` | JWT |
| `GET` | `/api/Language/supported` | JWT |

### Live Overlays

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/live-overlays` | JWT + `overlays` |
| `POST` | `/api/live-overlays` | JWT + `overlays` |
| `GET` | `/api/live-overlays/overlay/{channel}` | JWT |
| `DELETE` | `/api/live-overlays/{slug}` | JWT + `overlays` |
| `PUT` | `/api/live-overlays/{slug}` | JWT + `overlays` |

### Live Translation

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/live-translation/admin/active` | JWT |
| `GET` | `/api/live-translation/admin/overview` | JWT |
| `GET` | `/api/live-translation/admin/sessions` | JWT |
| `POST` | `/api/live-translation/admin/stop/{userId}` | JWT |
| `GET` | `/api/live-translation/public/{login}` | Public |
| `GET` | `/api/live-translation/sessions` | JWT + `settings` |
| `GET` | `/api/live-translation/settings` | JWT + `settings` |
| `PUT` | `/api/live-translation/settings` | JWT + `settings` |
| `GET` | `/api/live-translation/status` | JWT + `settings` |
| `POST` | `/api/live-translation/stop` | JWT + `settings` |
| `GET` | `/api/live-translation/voices` | JWT |

### Lol Coach

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/lol-coach/settings` | JWT + `settings` |
| `PUT` | `/api/lol-coach/settings` | JWT + `settings` |
| `GET` | `/api/lol-coach/state` | JWT + `settings` |

### Micro Commands

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/commands/microcommands` | JWT + `commands` |
| `POST` | `/api/commands/microcommands` | JWT + `commands` |
| `GET` | `/api/commands/microcommands/check-availability/{command}` | JWT + `commands` |
| `GET` | `/api/commands/microcommands/search-games` | JWT + `commands` |
| `GET` | `/api/commands/microcommands/search/{command}` | JWT + `commands` |
| `GET` | `/api/commands/microcommands/status` | JWT + `commands` |
| `DELETE` | `/api/commands/microcommands/{id}` | JWT + `commands` |
| `PUT` | `/api/commands/microcommands/{id}` | JWT + `commands` |

### Moderation

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/Moderation/banned-words` | JWT + `moderation` |
| `POST` | `/api/Moderation/banned-words` | JWT + `moderation` |
| `POST` | `/api/Moderation/banned-words/import` | JWT + `moderation` |
| `DELETE` | `/api/Moderation/banned-words/{id}` | JWT + `moderation` |
| `GET` | `/api/Moderation/commands` | JWT + `moderation` |
| `PUT` | `/api/Moderation/commands` | JWT + `moderation` |
| `GET` | `/api/Moderation/config` | JWT + `moderation` |
| `POST` | `/api/Moderation/config` | JWT + `moderation` |
| `GET` | `/api/Moderation/filters` | JWT + `moderation` |
| `PUT` | `/api/Moderation/filters/{key}` | JWT + `moderation` |
| `GET` | `/api/Moderation/history` | JWT + `moderation` |
| `POST` | `/api/Moderation/history/{id}/undo` | JWT + `moderation` |
| `GET` | `/api/Moderation/panic` | JWT + `moderation` |
| `PUT` | `/api/Moderation/panic` | JWT + `moderation` |
| `POST` | `/api/Moderation/panic/{mode}` | JWT + `moderation` |
| `GET` | `/api/Moderation/stats` | JWT + `moderation` |
| `POST` | `/api/Moderation/test-message` | JWT + `moderation` |

### Now Playing

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/nowplaying/admin/assign-cupo/{userId}` | JWT |
| `POST` | `/api/nowplaying/admin/revoke-cupo/{userId}` | JWT |
| `GET` | `/api/nowplaying/admin/spotify-cupos` | JWT |
| `GET` | `/api/nowplaying/config` | JWT + `overlays` |
| `POST` | `/api/nowplaying/config` | JWT + `overlays` |
| `GET` | `/api/nowplaying/config/overlay/{channelName}` | JWT |
| `POST` | `/api/nowplaying/connect/lastfm` | JWT + `overlays` |
| `POST` | `/api/nowplaying/disconnect` | JWT + `overlays` |
| `GET` | `/api/nowplaying/now/{channelName}` | JWT |
| `POST` | `/api/nowplaying/request-spotify-cupo` | JWT + `overlays` |
| `GET` | `/api/nowplaying/spotify-cupos` | JWT |
| `POST` | `/api/nowplaying/test` | JWT + `overlays` |
| `POST` | `/api/nowplaying/validate/lastfm` | JWT + `overlays` |

### Pets

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/pets/catalog` | JWT |
| `GET` | `/api/pets/config` | JWT + `overlays` |
| `POST` | `/api/pets/config` | JWT + `overlays` |
| `GET` | `/api/pets/models/{id}/file` | JWT |
| `GET` | `/api/pets/models/{id}/sign` | JWT |
| `GET` | `/api/pets/overlay/{channel}` | JWT |
| `POST` | `/api/pets/test` | JWT + `overlays` |

### Public Commands

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/public/commands/{channel}` | Public |
| `GET` | `/api/publiccommands/config` | JWT |
| `POST` | `/api/publiccommands/config` | JWT |

### Public Emotes

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/public/emotes/{channel}` | Public |
| `GET` | `/api/public/emotes/{channel}/me` | JWT |
| `DELETE` | `/api/public/emotes/{channel}/mine/{id}` | JWT |
| `POST` | `/api/public/emotes/{channel}/upload` | JWT |
| `POST` | `/api/public/emotes/{channel}/{id}/report` | JWT |

### Raffle

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/raffles` | JWT + `raffles` |
| `POST` | `/api/raffles` | JWT + `raffles` |
| `GET` | `/api/raffles/statistics` | JWT + `raffles` |
| `POST` | `/api/raffles/winners/{winnerId}/reroll` | JWT + `raffles` |
| `DELETE` | `/api/raffles/{id}` | JWT + `raffles` |
| `GET` | `/api/raffles/{id}` | JWT + `raffles` |
| `PUT` | `/api/raffles/{id}` | JWT + `raffles` |
| `POST` | `/api/raffles/{id}/close` | JWT + `raffles` |
| `POST` | `/api/raffles/{id}/draw` | JWT + `raffles` |
| `POST` | `/api/raffles/{id}/import-session` | JWT + `raffles` |
| `POST` | `/api/raffles/{id}/open` | JWT + `raffles` |
| `GET` | `/api/raffles/{id}/participants` | JWT + `raffles` |
| `POST` | `/api/raffles/{id}/participants` | JWT + `raffles` |
| `DELETE` | `/api/raffles/{id}/participants/{participantId}` | JWT + `raffles` |
| `GET` | `/api/raffles/{id}/winners` | JWT + `raffles` |

### Riot Account

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/me/riot-accounts` | JWT |
| `POST` | `/api/me/riot-accounts` | JWT |
| `DELETE` | `/api/me/riot-accounts/{id}` | JWT |
| `POST` | `/api/me/riot-accounts/{id}/verify` | JWT |

### Ruleta

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/ruleta/config` | JWT |
| `POST` | `/api/ruleta/config` | JWT |

### Scripts

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/Scripts` | JWT |
| `POST` | `/api/Scripts` | JWT |
| `POST` | `/api/Scripts/preview` | JWT |
| `POST` | `/api/Scripts/validate` | JWT |
| `DELETE` | `/api/Scripts/{id}` | JWT |
| `GET` | `/api/Scripts/{id}` | JWT |
| `PUT` | `/api/Scripts/{id}` | JWT |

### Settings

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/settings/add-access` | JWT + `user_management` |
| `GET` | `/api/settings/bot/status` | JWT |
| `GET` | `/api/settings/channel-identity` | JWT |
| `GET` | `/api/settings/channel-users` | JWT + `user_management` |
| `GET` | `/api/settings/frontend-info` | JWT |
| `DELETE` | `/api/settings/remove-access/{accessId}` | JWT + `user_management` |
| `POST` | `/api/settings/update` | JWT + `settings` |
| `PUT` | `/api/settings/update-access/{accessId}` | JWT + `user_management` |

### Shoutout

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/Shoutout/config` | JWT |
| `POST` | `/api/Shoutout/config` | JWT |
| `GET` | `/api/Shoutout/config/overlay/{channel}` | JWT |
| `GET` | `/api/Shoutout/history` | JWT |
| `GET` | `/api/Shoutout/native-status` | JWT |
| `POST` | `/api/Shoutout/test` | JWT |

### Song Request

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/public/song-request/{channel}` | JWT |
| `GET` | `/api/public/song-request/{channel}/guide` | JWT |
| `GET` | `/api/public/song-request/{channel}/history` | JWT |
| `GET` | `/api/public/song-request/{channel}/overlay` | JWT |
| `GET` | `/api/public/song-request/{channel}/playlists` | JWT |
| `GET` | `/api/public/song-request/{channel}/playlists/{code}` | JWT |
| `POST` | `/api/public/song-request/{channel}/playlists/{code}/listen` | JWT |
| `PUT` | `/api/song-request/active-playlist` | JWT + `overlays` |
| `GET` | `/api/song-request/bans` | JWT + `overlays` |
| `POST` | `/api/song-request/bans` | JWT + `overlays` |
| `DELETE` | `/api/song-request/bans/{id}` | JWT + `overlays` |
| `GET` | `/api/song-request/config` | JWT + `overlays` |
| `PUT` | `/api/song-request/config` | JWT + `overlays` |
| `POST` | `/api/song-request/control` | JWT + `overlays` |
| `GET` | `/api/song-request/downloads` | JWT + `overlays` |
| `POST` | `/api/song-request/downloads` | JWT + `overlays` |
| `POST` | `/api/song-request/downloads/clear` | JWT + `overlays` |
| `POST` | `/api/song-request/downloads/open-folder` | JWT + `overlays` |
| `POST` | `/api/song-request/downloads/probe` | JWT + `overlays` |
| `POST` | `/api/song-request/downloads/{jobId}/cancel` | JWT + `overlays` |
| `DELETE` | `/api/song-request/history` | JWT + `overlays` |
| `GET` | `/api/song-request/history` | JWT + `overlays` |
| `POST` | `/api/song-request/history/{id}/favorite` | JWT + `overlays` |
| `POST` | `/api/song-request/history/{id}/playlist/{playlistId}` | JWT + `overlays` |
| `POST` | `/api/song-request/history/{id}/requeue` | JWT + `overlays` |
| `GET` | `/api/song-request/imports/current` | JWT + `overlays` |
| `POST` | `/api/song-request/imports/current/{action}` | JWT + `overlays` |
| `GET` | `/api/song-request/pending` | JWT + `overlays` |
| `POST` | `/api/song-request/pending/{id}` | JWT + `overlays` |
| `POST` | `/api/song-request/player-key/regenerate` | JWT + `overlays` |
| `GET` | `/api/song-request/playlists` | JWT + `overlays` |
| `POST` | `/api/song-request/playlists` | JWT + `overlays` |
| `DELETE` | `/api/song-request/playlists/{playlistId}` | JWT + `overlays` |
| `PUT` | `/api/song-request/playlists/{playlistId}` | JWT + `overlays` |
| `POST` | `/api/song-request/playlists/{playlistId}/import-external` | JWT + `overlays` |
| `DELETE` | `/api/song-request/playlists/{playlistId}/items` | JWT + `overlays` |
| `GET` | `/api/song-request/playlists/{playlistId}/items` | JWT + `overlays` |
| `POST` | `/api/song-request/playlists/{playlistId}/items` | JWT + `overlays` |
| `DELETE` | `/api/song-request/playlists/{playlistId}/items/{itemId}` | JWT + `overlays` |
| `PUT` | `/api/song-request/playlists/{playlistId}/order` | JWT + `overlays` |
| `POST` | `/api/song-request/playlists/{playlistId}/share-code` | JWT + `overlays` |
| `GET` | `/api/song-request/public/{channel}/me` | JWT |
| `POST` | `/api/song-request/public/{channel}/playlists/{code}/items` | JWT |
| `POST` | `/api/song-request/public/{channel}/playlists/{code}/items/{itemId}/request` | JWT |
| `POST` | `/api/song-request/public/{channel}/playlists/{code}/items/{itemId}/vote` | JWT |
| `GET` | `/api/song-request/public/{channel}/playlists/{code}/my-votes` | JWT |
| `POST` | `/api/song-request/queue` | JWT + `overlays` |
| `PUT` | `/api/song-request/queue/order` | JWT + `overlays` |
| `DELETE` | `/api/song-request/queue/{id}` | JWT + `overlays` |
| `POST` | `/api/song-request/queue/{id}/ban` | JWT + `overlays` |
| `POST` | `/api/song-request/queue/{id}/promote` | JWT + `overlays` |
| `PUT` | `/api/song-request/request-mode` | JWT + `overlays` |
| `GET` | `/api/song-request/resolve` | JWT + `overlays` |
| `GET` | `/api/song-request/stats` | JWT + `overlays` |
| `POST` | `/api/song-request/trusted` | JWT + `overlays` |
| `DELETE` | `/api/song-request/trusted/{id}` | JWT + `overlays` |

### Song Request Share Page

| Method | Route | Access |
|---|---|---|
| `GET` | `/sr/{channel}` | Public |
| `GET` | `/sr/{channel}/p/{code}` | Public |

### Sound Alerts

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/SoundAlerts/assign-media-file` | JWT |
| `POST` | `/api/SoundAlerts/assign-system-file` | JWT |
| `GET` | `/api/SoundAlerts/channel-points-rewards` | JWT |
| `GET` | `/api/SoundAlerts/config` | JWT |
| `POST` | `/api/SoundAlerts/config` | JWT |
| `GET` | `/api/SoundAlerts/config/overlay/{channel}` | JWT |
| `DELETE` | `/api/SoundAlerts/file/{rewardId}` | JWT |
| `PATCH` | `/api/SoundAlerts/file/{rewardId}/edit` | JWT |
| `PATCH` | `/api/SoundAlerts/file/{rewardId}/toggle` | JWT |
| `PATCH` | `/api/SoundAlerts/file/{rewardId}/volume` | JWT |
| `GET` | `/api/SoundAlerts/files` | JWT |
| `GET` | `/api/SoundAlerts/resolve/{channel}` | JWT |
| `GET` | `/api/SoundAlerts/status` | JWT |
| `GET` | `/api/SoundAlerts/system-files` | JWT |
| `POST` | `/api/SoundAlerts/test` | JWT |
| `POST` | `/api/SoundAlerts/upload` | JWT |

### Speak Chat

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/speakchat/config` | JWT + `overlays` |
| `POST` | `/api/speakchat/config` | JWT + `overlays` |
| `GET` | `/api/speakchat/config/overlay/{channelName}` | JWT |
| `POST` | `/api/speakchat/overlay/reload` | JWT + `overlays` |
| `POST` | `/api/speakchat/test` | JWT + `overlays` |
| `GET` | `/api/speakchat/usage` | JWT + `overlays` |

### Spotify

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/spotify/authorize-url` | JWT + `overlays` |
| `GET` | `/api/spotify/callback` | Public |
| `POST` | `/api/spotify/disconnect` | JWT + `overlays` |
| `GET` | `/api/spotify/status` | JWT + `overlays` |

### Supporters

| Method | Route | Access |
|---|---|---|
| `PUT` | `/api/Supporters/admin/culqi-mode` | JWT |
| `GET` | `/api/Supporters/admin/invoices` | JWT |
| `GET` | `/api/Supporters/admin/invoices/{paymentId}/download/{formato}` | JWT |
| `POST` | `/api/Supporters/admin/invoices/{paymentId}/retry` | JWT |
| `PUT` | `/api/Supporters/admin/invoicing-company` | JWT |
| `GET` | `/api/Supporters/admin/invoicing-status` | JWT |
| `POST` | `/api/Supporters/assign-tier` | JWT |
| `POST` | `/api/Supporters/billing-preview` | JWT |
| `GET` | `/api/Supporters/billing-profile` | JWT |
| `PUT` | `/api/Supporters/billing-profile` | JWT |
| `GET` | `/api/Supporters/billing-profile/ruc/{ruc}` | JWT |
| `POST` | `/api/Supporters/capture-donation-order` | Public |
| `POST` | `/api/Supporters/capture-paypal-order` | JWT |
| `GET` | `/api/Supporters/config` | JWT |
| `POST` | `/api/Supporters/config` | JWT |
| `POST` | `/api/Supporters/create-culqi-charge` | JWT |
| `POST` | `/api/Supporters/create-culqi-donation` | Public |
| `POST` | `/api/Supporters/create-donation-order` | Public |
| `POST` | `/api/Supporters/create-paypal-order` | JWT |
| `GET` | `/api/Supporters/culqi-public-key` | Public |
| `GET` | `/api/Supporters/discount-codes` | JWT |
| `POST` | `/api/Supporters/discount-codes` | JWT |
| `DELETE` | `/api/Supporters/discount-codes/{id}` | JWT |
| `PATCH` | `/api/Supporters/discount-codes/{id}` | JWT |
| `GET` | `/api/Supporters/list` | JWT |
| `GET` | `/api/Supporters/list-public` | Public |
| `GET` | `/api/Supporters/my-invoices` | JWT |
| `GET` | `/api/Supporters/my-invoices/{paymentId}/download/{formato}` | JWT |
| `POST` | `/api/Supporters/paypal/webhook` | Public |
| `GET` | `/api/Supporters/public-config` | Public |
| `GET` | `/api/Supporters/tier-limits` | Public |
| `GET` | `/api/Supporters/validate-code` | Public |

### Tcg

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/tcg/balance` | JWT |
| `POST` | `/api/tcg/cards/{instanceId}/upgrade/attempt` | JWT |
| `POST` | `/api/tcg/cards/{instanceId}/upgrade/pay` | JWT |
| `GET` | `/api/tcg/claim` | JWT |
| `POST` | `/api/tcg/claim` | JWT |
| `GET` | `/api/tcg/collection` | JWT |
| `GET` | `/api/tcg/collection/{instanceId}` | JWT |
| `GET` | `/api/tcg/context` | JWT |
| `GET` | `/api/tcg/dex` | JWT |
| `GET` | `/api/tcg/filters` | JWT |
| `GET` | `/api/tcg/free-packs` | JWT |
| `GET` | `/api/tcg/images/{cardId}/{level}` | JWT |
| `GET` | `/api/tcg/packs` | JWT |
| `GET` | `/api/tcg/sobres` | JWT |
| `POST` | `/api/tcg/sobres/{id}/buy` | JWT |
| `POST` | `/api/tcg/sobres/{id}/claim-free` | JWT |
| `POST` | `/api/tcg/sobres/{id}/open` | JWT |
| `GET` | `/api/tcg/stats` | JWT |

### Timer Backup

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/timer/backup` | JWT |
| `GET` | `/api/timer/backup/by-session/{sessionId}` | JWT |
| `GET` | `/api/timer/backup/list` | JWT |
| `POST` | `/api/timer/backup/restore-session` | JWT |
| `POST` | `/api/timer/backup/restore/{id}` | JWT |

### Timer Extension

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/timer/config` | JWT |
| `POST` | `/api/timer/config` | JWT |
| `GET` | `/api/timer/config/overlay/{channel}` | JWT |
| `POST` | `/api/timer/config/reset` | JWT |
| `POST` | `/api/timer/control` | JWT |
| `POST` | `/api/timer/happy-hour/manual-activate` | JWT |
| `POST` | `/api/timer/happy-hour/manual-deactivate` | JWT |
| `GET` | `/api/timer/happy-hour/manual-status` | JWT |
| `GET` | `/api/timer/happyhour` | JWT |
| `POST` | `/api/timer/happyhour` | JWT |
| `DELETE` | `/api/timer/happyhour/{id}` | JWT |
| `PUT` | `/api/timer/happyhour/{id}` | JWT |
| `POST` | `/api/timer/overlay/{channel}/complete` | JWT |
| `GET` | `/api/timer/overlay/{channel}/stats` | JWT |
| `GET` | `/api/timer/schedules` | JWT |
| `POST` | `/api/timer/schedules` | JWT |
| `DELETE` | `/api/timer/schedules/{id}` | JWT |
| `PUT` | `/api/timer/schedules/{id}` | JWT |
| `GET` | `/api/timer/sessions` | JWT |
| `GET` | `/api/timer/sessions/{id}/logs` | JWT |
| `GET` | `/api/timer/state/current` | JWT |
| `GET` | `/api/timer/state/{channel}` | JWT |
| `GET` | `/api/timer/templates` | JWT |
| `POST` | `/api/timer/templates` | JWT |
| `DELETE` | `/api/timer/templates/{id}` | JWT |
| `PUT` | `/api/timer/templates/{id}` | JWT |
| `POST` | `/api/timer/templates/{id}/apply` | JWT |
| `POST` | `/api/timer/test/event` | JWT |

### Timer Media

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/timer/media` | JWT |
| `GET` | `/api/timer/media/categories` | JWT |
| `GET` | `/api/timer/media/download-zip` | JWT |
| `POST` | `/api/timer/media/upload` | JWT |
| `DELETE` | `/api/timer/media/{id}` | JWT |
| `PUT` | `/api/timer/media/{id}/move` | JWT |
| `PUT` | `/api/timer/media/{id}/rename` | JWT |

### Timers

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/Timers` | JWT + `timers` |
| `POST` | `/api/Timers` | JWT + `timers` |
| `DELETE` | `/api/Timers/{id}` | JWT + `timers` |
| `GET` | `/api/Timers/{id}` | JWT + `timers` |
| `PUT` | `/api/Timers/{id}` | JWT + `timers` |
| `POST` | `/api/Timers/{id}/test` | JWT + `timers` |

### Tips

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/Tips/config` | JWT |
| `POST` | `/api/Tips/config` | JWT |
| `GET` | `/api/Tips/history` | JWT |
| `GET` | `/api/Tips/page/{channelName}` | Public |
| `GET` | `/api/Tips/paypal/callback` | Public |
| `POST` | `/api/Tips/paypal/capture-order` | Public |
| `GET` | `/api/Tips/paypal/connect` | JWT |
| `POST` | `/api/Tips/paypal/create-order` | Public |
| `POST` | `/api/Tips/paypal/disconnect` | JWT |
| `GET` | `/api/Tips/paypal/resolve-token` | JWT |
| `POST` | `/api/Tips/paypal/webhook` | Public |
| `GET` | `/api/Tips/statistics` | JWT |
| `POST` | `/api/Tips/test` | JWT |
| `GET` | `/api/Tips/top-donors` | JWT |

### Title Command

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/commands/title/current` | JWT + `commands` |
| `GET` | `/api/commands/title/history` | JWT + `commands` |
| `GET` | `/api/commands/title/status` | JWT + `commands` |
| `POST` | `/api/commands/title/toggle` | JWT + `commands` |
| `POST` | `/api/commands/title/update` | JWT + `commands` |

### Tournament Admin

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/admin/tournament/editions` | JWT |
| `POST` | `/api/admin/tournament/editions` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/participants` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/participants` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/participants/seed-test` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/ranking` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/riot-resync` | JWT |
| `DELETE` | `/api/admin/tournament/editions/{id}` | JWT |
| `GET` | `/api/admin/tournament/editions/{id}` | JWT |
| `PUT` | `/api/admin/tournament/editions/{id}/mechanic-names` | JWT |
| `PUT` | `/api/admin/tournament/editions/{id}/status` | JWT |
| `GET` | `/api/admin/tournament/riot-config` | JWT |
| `POST` | `/api/admin/tournament/riot-config` | JWT |

### Tournament Appearance

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/appearance` | JWT |
| `PUT` | `/api/admin/tournament/editions/{editionId}/appearance` | JWT |
| `DELETE` | `/api/admin/tournament/editions/{editionId}/appearance/{kind}` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/appearance/{kind}` | JWT |
| `GET` | `/api/public/tournament/assets/{editionId}/{file}` | Public |

### Tournament Blue Shell Admin

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/admin/tournament/blueshell/events/{eventId}/fulfill` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/blueshell/catalogs` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/blueshell/events` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/blueshell/inventory` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/blueshell/punishments` | JWT |
| `DELETE` | `/api/admin/tournament/editions/{editionId}/blueshell/punishments/{id}` | JWT |
| `PUT` | `/api/admin/tournament/editions/{editionId}/blueshell/punishments/{id}` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/blueshell/rules` | JWT |
| `PUT` | `/api/admin/tournament/editions/{editionId}/blueshell/rules` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/blueshell/seed-defaults` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/blueshell/throw` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/blueshell/triggers` | JWT |
| `DELETE` | `/api/admin/tournament/editions/{editionId}/blueshell/triggers/{id}` | JWT |
| `PUT` | `/api/admin/tournament/editions/{editionId}/blueshell/triggers/{id}` | JWT |

### Tournament Dashboard Admin

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/dashboard` | JWT |

### Tournament Embed

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/embed/torneo/{channelName}/{editionSlug}/ranking` | Public |
| `GET` | `/api/overlay/torneo/{token}` | Public |

### Tournament Fortnite Admin

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/fortnite` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/fortnite/audit` | JWT |
| `PUT` | `/api/admin/tournament/editions/{editionId}/fortnite/config` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/fortnite/files/{fileId}` | JWT |
| `PUT` | `/api/admin/tournament/editions/{editionId}/fortnite/games/{gameId}/code` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/games/{gameId}/results/approve-clean` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/games/{gameId}/results/staff` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/games/{gameId}/results/{teamId}/approve` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/games/{gameId}/reveal` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/fortnite/games/{gameId}/review` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/games/{gameId}/status` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/groups/final` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/groups/final/fill` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/groups/generate` | JWT |
| `DELETE` | `/api/admin/tournament/editions/{editionId}/fortnite/groups/{groupId}` | JWT |
| `PUT` | `/api/admin/tournament/editions/{editionId}/fortnite/groups/{groupId}` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/groups/{groupId}/teams` | JWT |
| `DELETE` | `/api/admin/tournament/editions/{editionId}/fortnite/groups/{groupId}/teams/{teamId}` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/sessions` | JWT |
| `DELETE` | `/api/admin/tournament/editions/{editionId}/fortnite/sessions/{sessionId}` | JWT |
| `PUT` | `/api/admin/tournament/editions/{editionId}/fortnite/sessions/{sessionId}` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/sessions/{sessionId}/checkins/{participantId}` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/fortnite/sessions/{sessionId}/matchday` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/sessions/{sessionId}/status` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/fortnite/standings` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/fortnite/teams/build` | JWT |

### Tournament Me

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/me/tournament/{channelName}/{editionSlug}` | JWT |
| `GET` | `/api/me/tournament/{channelName}/{editionSlug}/audit` | JWT |
| `POST` | `/api/me/tournament/{channelName}/{editionSlug}/epic-account` | JWT |
| `GET` | `/api/me/tournament/{channelName}/{editionSlug}/files/{fileId}` | JWT |
| `POST` | `/api/me/tournament/{channelName}/{editionSlug}/games/{gameId}/report` | JWT |
| `POST` | `/api/me/tournament/{channelName}/{editionSlug}/games/{gameId}/screenshot` | JWT |
| `POST` | `/api/me/tournament/{channelName}/{editionSlug}/group` | JWT |
| `POST` | `/api/me/tournament/{channelName}/{editionSlug}/group/join` | JWT |
| `GET` | `/api/me/tournament/{channelName}/{editionSlug}/matchday` | JWT |
| `POST` | `/api/me/tournament/{channelName}/{editionSlug}/overlay` | JWT |
| `POST` | `/api/me/tournament/{channelName}/{editionSlug}/register` | JWT |
| `POST` | `/api/me/tournament/{channelName}/{editionSlug}/riot-account` | JWT |
| `POST` | `/api/me/tournament/{channelName}/{editionSlug}/sessions/{sessionId}/checkin` | JWT |

### Tournament Overlay Admin

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/participants/{participantId}/overlay` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/participants/{participantId}/overlay` | JWT |

### Tournament Prize Admin

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/prizes` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/prizes` | JWT |
| `DELETE` | `/api/admin/tournament/prizes/{prizeId}` | JWT |
| `PUT` | `/api/admin/tournament/prizes/{prizeId}` | JWT |

### Tournament Public

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}` | Public |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/bracket` | Public |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/fortnite/files/{fileId}` | Public |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/fortnite/standings` | Public |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/fortnite/teams/{teamId}` | Public |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/participants` | Public |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/participants/{participantId}` | Public |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/prizes` | Public |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/rules` | Public |

### Tournament Registration Admin

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/registrations` | JWT |
| `POST` | `/api/admin/tournament/participants/{participantId}/approve` | JWT |
| `POST` | `/api/admin/tournament/participants/{participantId}/reject` | JWT |

### Tournament Rules Admin

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/rules` | JWT |
| `PUT` | `/api/admin/tournament/editions/{editionId}/rules` | JWT |

### Tournament Sponsor Admin

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/sponsors` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/sponsors` | JWT |
| `DELETE` | `/api/admin/tournament/sponsors/{sponsorId}` | JWT |
| `PUT` | `/api/admin/tournament/sponsors/{sponsorId}` | JWT |
| `PUT` | `/api/admin/tournament/sponsors/{sponsorId}/status` | JWT |

### Tournament Team Admin

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/admin/tournament/bracket/matches/{matchId}/result` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/bracket` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/bracket/generate` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/bracket/next-round` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/teams` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/teams` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/teams/{teamId}/members` | JWT |

### Tournament Win Condition Admin

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/win-conditions` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/win-conditions` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/win-conditions/resync` | JWT |
| `DELETE` | `/api/admin/tournament/win-conditions/{conditionId}` | JWT |
| `PUT` | `/api/admin/tournament/win-conditions/{conditionId}` | JWT |

### Tts

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/Tts/generate` | JWT |

### Tts Credits

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/tts-credits/balance` | JWT |
| `GET` | `/api/tts-credits/history` | JWT |
| `GET` | `/api/tts-credits/summary` | JWT |

### Tts Voices

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/tts/premium-voices` | JWT |
| `GET` | `/api/tts/standard-voices` | JWT |
| `GET` | `/api/tts/voices` | JWT |

### Twitch OAuth Proxy

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/oauth/twitch/token` | Public |

### Twitch Webhook

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/twitch/eventsub/subscribe/channel-points` | JWT + `settings` |
| `POST` | `/api/twitch/eventsub/subscribe/chat` | JWT + `settings` |
| `POST` | `/api/twitch/eventsub/subscribe/follow` | JWT + `settings` |
| `GET` | `/api/twitch/eventsub/subscriptions` | JWT + `settings` |
| `DELETE` | `/api/twitch/eventsub/subscriptions/{subscriptionId}` | JWT + `settings` |
| `POST` | `/api/twitch/webhook` | Public |

### User Permissions

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/user/available-accounts` | JWT |
| `GET` | `/api/user/channel-users` | JWT + `user_management` |
| `GET` | `/api/user/permissions` | JWT |

### Watchtime

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/watchtime/config` | JWT |
| `POST` | `/api/watchtime/config` | JWT |

### Wheel

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/wheel/deliveries` | JWT + `overlays` |
| `PUT` | `/api/wheel/deliveries/{deliveryId}` | JWT + `overlays` |
| `GET` | `/api/wheel/limits` | JWT + `overlays` |
| `GET` | `/api/wheel/overlay` | JWT |
| `GET` | `/api/wheel/plans` | JWT + `overlays` |
| `GET` | `/api/wheel/sound-alerts` | JWT + `overlays` |
| `GET` | `/api/wheel/wallets` | JWT + `overlays` |
| `PUT` | `/api/wheel/wallets/{viewer}` | JWT + `overlays` |
| `GET` | `/api/wheel/wheels` | JWT + `overlays` |
| `POST` | `/api/wheel/wheels` | JWT + `overlays` |
| `DELETE` | `/api/wheel/wheels/{id}` | JWT + `overlays` |
| `GET` | `/api/wheel/wheels/{id}` | JWT + `overlays` |
| `PUT` | `/api/wheel/wheels/{id}` | JWT + `overlays` |
| `POST` | `/api/wheel/wheels/{id}/duplicate` | JWT + `overlays` |
| `GET` | `/api/wheel/wheels/{id}/messages` | JWT + `overlays` |
| `PUT` | `/api/wheel/wheels/{id}/messages` | JWT + `overlays` |
| `GET` | `/api/wheel/wheels/{id}/metrics` | JWT + `overlays` |
| `GET` | `/api/wheel/wheels/{id}/raffle` | JWT + `overlays` |
| `PUT` | `/api/wheel/wheels/{id}/raffle` | JWT + `overlays` |
| `POST` | `/api/wheel/wheels/{id}/raffle/draw` | JWT + `overlays` |
| `POST` | `/api/wheel/wheels/{id}/raffle/entries` | JWT + `overlays` |
| `DELETE` | `/api/wheel/wheels/{id}/raffle/entries/{viewer}` | JWT + `overlays` |
| `PUT` | `/api/wheel/wheels/{id}/raffle/entries/{viewer}/multiplier` | JWT + `overlays` |
| `POST` | `/api/wheel/wheels/{id}/raffle/reset` | JWT + `overlays` |
| `POST` | `/api/wheel/wheels/{id}/raffle/window` | JWT + `overlays` |
| `PUT` | `/api/wheel/wheels/{id}/segments` | JWT + `overlays` |
| `POST` | `/api/wheel/wheels/{id}/simulate` | JWT + `overlays` |
| `PUT` | `/api/wheel/wheels/{id}/slug` | JWT + `overlays` |
| `GET` | `/api/wheel/wheels/{id}/sources` | JWT + `overlays` |
| `PUT` | `/api/wheel/wheels/{id}/sources` | JWT + `overlays` |
| `POST` | `/api/wheel/wheels/{id}/spin` | JWT + `overlays` |
| `GET` | `/api/wheel/wheels/{id}/spins` | JWT + `overlays` |
| `GET` | `/api/wheel/wheels/{id}/spins/export` | JWT + `overlays` |
| `POST` | `/api/wheel/wheels/{id}/test-spin` | JWT + `overlays` |

<!-- END GENERATED ENDPOINTS -->

---

## WebSocket / SignalR Hubs

Decatron has three SignalR hubs and one raw WebSocket. Their methods, groups and events are documented in [OVERLAYS.md](OVERLAYS.md#signalr-events-reference) and in [ARCHITECTURE.md](ARCHITECTURE.md#4-real-time-communication).

| Endpoint | Purpose |
|----------|---------|
| `/hubs/overlay` | OBS overlays and dashboard previews (group `overlay_{channel}`) |
| `/hubs/songrequest` | Song Request player, overlays, dashboard and public queue |
| `/hubs/translation` | Live translation for viewers (browser extension) |
| `/api/desktop/ws` | Decatron Desktop companion app (single multiplexed WebSocket) |

Overlay connections need no authentication.

---

## Static File Endpoints

These routes serve static files from disk (the folders are configurable, see [ENV_VARIABLES.md](ENV_VARIABLES.md#physical-paths)):

| Route | Description |
|-------|-------------|
| `/downloads/*` | Downloaded Twitch clips |
| `/uploads/soundalerts/*` | Uploaded sound alert files |
| `/uploads/brand/*` | Brand logos |
| `/uploads/emotes/*` | Channel and global emote images |
| `/timerextensible/*` | Timer extension media files |
| `/tts-audio/*` | Cached TTS audio |
| `/system-files/*` | Pre-loaded sounds and images |
| `/tcg-packs/*` | Trading card pack images |
| `/swagger` | Swagger UI (Development only) |

---

## Overlay URLs (Public Pages)

Overlay and public page URLs are listed in [OVERLAYS.md](OVERLAYS.md#quick-reference). Public pages that need no login include `/tip/{channelName}` (also `/donate/{channelName}`), `/commands/{channelName}`, `/sr/{channelName}`, `/torneos/{channelName}/{editionSlug}`, `/emotes/{channelName}`, `/supporters`, `/oauth/authorize` and `/docs/*`.

---

## Error Format

Most dashboard endpoints return JSON objects such as:

```json
{
  "success": false,
  "message": "Description of the error"
}
```

Unhandled exceptions are caught by `GlobalExceptionMiddleware` and return HTTP 500 with a generic message and no internal details. The public API v1 uses `{ "error": "code" }` instead.

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (validation error, missing parameters) |
| 401 | Unauthorized (missing or invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 429 | Too Many Requests (rate-limited routes) |
| 500 | Internal Server Error |

---

## Rate Limiting

There is no global rate limit. Named fixed-window policies protect a few public routes:

| Policy | Limit | Used by |
|--------|-------|---------|
| `tournament-register` | 5 requests per 10 minutes | Tournament registration endpoints |
| `tournament-embed` | 60 requests per minute | Tournament overlay and ranking widget |
| `tcg-images` | 600 requests per minute | Trading card images |
| `live-translation-public` | 60 requests per minute | Public live translation endpoint |
| `live-translation-claim` | 10 requests per 10 minutes | Linking Decatron Desktop with a code |

Public endpoints that are sensitive to abuse and have no limit yet include `POST /api/tips/paypal/create-order`, `POST /api/tips/paypal/capture-order`, `POST /api/gacha-auth/validate` and `POST /api/tts/generate`.
