# Referencia de la API de Decatron v2

> English: [../API.md](../API.md)

Referencia de la API HTTP de Decatron. Todos los endpoints se sirven desde la URL base de tu instancia de Decatron (por ejemplo `https://decatron.net`).

Hay dos tipos de endpoints:

- **API pública** (`/api/v1`, más el flujo OAuth2 y el portal de desarrolladores): pensada para aplicaciones de terceros. Usa tokens de acceso y scopes de OAuth2 y se documenta en detalle abajo.
- **Endpoints del panel**: sirven a la aplicación web de Decatron con el JWT del usuario que inició sesión. Se listan en [Más endpoints](#más-endpoints) por controlador, con su nivel de acceso. Su forma puede cambiar sin aviso. Los endpoints de cada módulo de overlay se describen, con su propósito, en [OVERLAYS.md](OVERLAYS.md); los de comandos, scripting, microcomandos y moderación, en [COMMANDS.md](COMMANDS.md).

---

## Contenido

- [Autenticación](#autenticación)
- [Auth / Inicio de sesión](#auth--inicio-de-sesión)
- [API OAuth2 (API pública para desarrolladores)](#api-oauth2-api-pública-para-desarrolladores)
- [API pública v1](#api-pública-v1)
- [Portal de desarrolladores](#portal-de-desarrolladores)
- [Más endpoints](#más-endpoints)
- [WebSocket / Hubs de SignalR](#websocket--hubs-de-signalr)
- [Endpoints de archivos estáticos](#endpoints-de-archivos-estáticos)
- [URL de overlays (páginas públicas)](#url-de-overlays-páginas-públicas)
- [Formato de errores](#formato-de-errores)
- [Límite de solicitudes](#límite-de-solicitudes)

---

## Autenticación

Decatron usa dos sistemas de autenticación independientes:

### 1. JWT (sesiones de usuario)

Lo usan el panel y todos los endpoints autenticados. Se obtiene mediante el flujo de inicio de sesión de Twitch, Kick o Discord.

**Cómo obtener un token:**

1. Redirige al usuario a `GET /api/auth/login` (Twitch), `GET /api/auth/kick/login` (Kick) o `GET /api/auth/discord/login` (Discord)
2. La plataforma autentica al usuario y lo redirige al callback correspondiente (`GET /api/auth/callback`, `/api/auth/kick/callback`, `/api/auth/discord/callback`)
3. El backend genera un JWT, lo conserva 60 segundos detrás de un código de un solo uso y redirige al frontend a `/login?code=<código>`
4. El frontend cambia el código por el JWT con `POST /api/auth/exchange` (cuerpo `{ "code": "..." }`, respuesta `{ "token": "..." }`); el código sirve una sola vez

**Formato de la cabecera:**

```
Authorization: Bearer <JWT_TOKEN>
```

El JWT se emite tras iniciar sesión con Twitch, Kick o Discord. Contiene los claims `NameIdentifier` (ID interno del usuario), `Name`, `GivenName`, `AuthProvider`, `TwitchId`, `KickId`, `DiscordId`, `ProfileImage` y `Email`. El canal activo no forma parte del token: se guarda en la sesión (`POST /api/channel/switch`).

### 2. OAuth2 (API pública para aplicaciones de terceros)

Lo usan las aplicaciones externas que se integran con la API de Decatron. Implementa el flujo Authorization Code con soporte de PKCE.

**Cómo obtener un token:**

1. Registra una aplicación con `POST /api/developer/apps` para obtener `client_id` y `client_secret`
2. Redirige al usuario a `GET /api/oauth/authorize` con los parámetros requeridos
3. El usuario aprueba la solicitud en `POST /api/oauth/authorize`
4. Intercambia el código de autorización por tokens con `POST /api/oauth/token` (form-urlencoded)

**Formato de la cabecera:**

```
Authorization: Bearer <OAUTH_ACCESS_TOKEN>
```

**Scopes de OAuth disponibles (25 scopes en 3 categorías):**

| Categoría | Scopes |
|-----------|--------|
| Lectura | `read:profile`, `read:timer`, `read:commands`, `read:alerts`, `read:giveaways`, `read:goals`, `read:analytics`, `read:sounds`, `read:games`, `read:stream` |
| Escritura | `write:timer`, `write:commands`, `write:alerts`, `write:giveaways`, `write:goals`, `write:sounds` |
| Acción | `action:timer`, `action:alerts`, `action:chat`, `action:giveaway`, `action:goals`, `action:sounds`, `action:category`, `action:title`, `action:marker` |

`action:chat` requiere la verificación de la aplicación.

---

## Auth / Inicio de sesión

### AuthController (`/api/auth`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/auth/login` | No | Redirige al inicio de sesión de Twitch. Acepta el parámetro opcional `?redirect=` |
| GET | `/api/auth/callback` | No | Callback de OAuth de Twitch. Intercambia el código por tokens, crea o actualiza el usuario, genera el JWT y redirige al frontend |
| GET | `/api/auth/validate-scopes/{twitchId}` | Sí (JWT) | Valida los scopes del token de Twitch guardado de un usuario |
| GET | `/api/auth/account-tier` | Sí (JWT) | Devuelve el tier de suscripción del usuario autenticado |

---

## API OAuth2 (API pública para desarrolladores)

### OAuthController (`/api/oauth`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/oauth/authorize` | No | Inicia el flujo Authorization Code de OAuth2. Valida los parámetros y devuelve la información de la aplicación y los scopes |
| POST | `/api/oauth/authorize` | Sí (JWT) | Procesa la decisión del usuario (aprobar o denegar). Genera el código de autorización |
| POST | `/api/oauth/token` | No (credenciales del cliente en el cuerpo) | Intercambia un código de autorización o un refresh token por un token de acceso. Form-urlencoded |
| POST | `/api/oauth/revoke` | No | Revoca un token (RFC 7009, siempre responde 200) |
| GET | `/api/oauth/userinfo` | Sí (OAuth + `read:profile`) | Devuelve la información del usuario autenticado mediante OAuth |
| GET | `/api/oauth/scopes` | No | Lista todos los scopes disponibles agrupados por categoría |

---

## API pública v1

Los endpoints bajo `/api/v1` son la API pública para aplicaciones de terceros. Necesitan un token de acceso OAuth2 con el scope indicado en cada uno y siempre actúan sobre el canal del usuario que autorizó el token. Los errores tienen la forma `{ "error": "codigo" }`; las acciones exitosas devuelven `{ "success": true, "message": "..." }`.

| Método | Ruta | Scope | Cuerpo / consulta | Descripción |
|--------|------|-------|-------------------|-------------|
| GET | `/api/v1/timer` | `read:timer` | | Estado del timer: `status`, `currentTime`, `totalTime`, `isRunning`, `isPaused`, `isVisible`, `startedAt`, `pausedAt` |
| POST | `/api/v1/timer/start` | `action:timer` | `duration` (segundos, opcional; 300 por defecto) | Inicia el timer |
| POST | `/api/v1/timer/pause` | `action:timer` | | Pausa el timer (`timer_not_running` si no está corriendo) |
| POST | `/api/v1/timer/resume` | `action:timer` | | Reanuda el timer (`timer_not_paused` si no está pausado) |
| POST | `/api/v1/timer/stop` | `action:timer` | | Detiene el timer |
| POST | `/api/v1/timer/add` | `action:timer` | `seconds` | Suma segundos; devuelve `newTotalTime` |
| POST | `/api/v1/chat/send` | `action:chat` | `message` | Envía un mensaje al chat del canal. El scope requiere la verificación de la aplicación |
| GET | `/api/v1/twitch/games/search` | `read:games` | `query` | Busca categorías de Twitch; devuelve `id`, `name` y `box_art_url` |
| POST | `/api/v1/twitch/category` | `action:category` | `gameId` o `gameName` | Cambia la categoría del stream |
| POST | `/api/v1/twitch/title` | `action:title` | `title` | Cambia el título del stream |
| POST | `/api/v1/twitch/marker` | `action:marker` | `description` (opcional) | Crea un marcador en el stream (`stream_not_live` si está sin transmitir) |
| GET | `/api/v1/twitch/live-info` | `read:stream` | | `isLive`, `category`, `title`, `viewers`, `lastFollower` |
| GET | `/api/v1/sounds` | `read:sounds` | | Lista las alertas de sonido configuradas del canal (`id`, `name`) |
| POST | `/api/v1/sounds/play` | `action:sounds` | `soundId` | Dispara una de esas alertas de sonido en el overlay |
| POST | `/api/v1/alerts/trigger` | `action:alerts` | `eventType`; opcionales `username`, `message`, `amount` | Dispara una alerta de evento en el overlay |

Códigos de error comunes: `channel_not_found`, `message_required`, `title_required`, `game_id_or_game_name_required`, `category_not_found_or_update_failed`, `sound_id_required`, `sound_not_found`, `event_type_required`.

---

## Portal de desarrolladores

### DeveloperController (`/api/developer`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/developer/apps` | Sí (JWT) | Lista las aplicaciones OAuth del usuario |
| GET | `/api/developer/apps/{id}` | Sí (JWT) | Detalle de una aplicación con estadísticas (usuarios, tokens) |
| POST | `/api/developer/apps` | Sí (JWT) | Crea una aplicación OAuth. Devuelve el `client_secret` (se muestra una sola vez) |
| PUT | `/api/developer/apps/{id}` | Sí (JWT) | Actualiza el nombre, la descripción, las URI y los scopes |
| POST | `/api/developer/apps/{id}/regenerate-secret` | Sí (JWT) | Regenera el `client_secret`. Revoca todos los tokens existentes |
| DELETE | `/api/developer/apps/{id}` | Sí (JWT) | Elimina la aplicación y todos sus tokens (en cascada) |
| GET | `/api/developer/scopes` | No | Lista los scopes disponibles con sus categorías para la interfaz |

---

## Más endpoints

Los endpoints de abajo son el resto de las rutas del backend, generados a partir de los controladores (la lista se regenera cuando cambian los controladores). Sirven a la aplicación web de Decatron: usan el JWT del usuario que inició sesión y la forma de sus solicitudes y respuestas puede cambiar sin aviso. No forman parte de la API pública.

**Acceso** refleja los atributos declarados en cada ruta: `Público` significa que ningún atributo la restringe, `JWT` un usuario autenticado, `JWT + sección` un usuario autenticado con el nivel de permiso que requiere esa sección (consulta [CONFIGURATION.md](CONFIGURATION.md#sistema-de-permisos)). Algunos endpoints hacen comprobaciones adicionales en el código, por ejemplo acciones solo para el dueño. Las rutas restringidas a administradores de la plataforma (`RequireSystemOwner`) no se listan.

<!-- BEGIN GENERATED ENDPOINTS -->
### Analytics

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/analytics` | JWT + `analytics` |
| `GET` | `/api/analytics/export` | JWT + `analytics_export` |

### Auth

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/auth/account-channels` | JWT |
| `POST` | `/api/auth/exchange` | Público |
| `POST` | `/api/auth/link-account-start` | JWT |
| `GET` | `/api/auth/link-twitch` | Público |
| `POST` | `/api/auth/link-twitch-start` | JWT |
| `POST` | `/api/auth/switch-channel` | JWT |
| `POST` | `/api/auth/unlink-account` | JWT |
| `POST` | `/api/auth/unlink-twitch` | JWT |

### Bot List

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/brand` | Público |

### Channel Emotes

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/channel/available` | JWT |
| `GET` | `/api/channel/context` | JWT |
| `POST` | `/api/channel/switch` | JWT |

### Channels

| Método | Ruta | Acceso |
|---|---|---|
| `PATCH` | `/api/Channels/admin/{id}/visibility` | JWT |
| `GET` | `/api/Channels/admin/{platform}` | JWT |
| `GET` | `/api/Channels/carousel` | Público |

### Chat Admin

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/chat/check-access` | JWT |
| `GET` | `/api/chat/conversations` | JWT |
| `POST` | `/api/chat/conversations` | JWT |
| `DELETE` | `/api/chat/conversations/{id}` | JWT |
| `GET` | `/api/chat/conversations/{id}` | JWT |
| `POST` | `/api/chat/conversations/{id}/messages` | JWT |
| `POST` | `/api/chat/conversations/{id}/messages/stream` | JWT |

### Chat Overlay

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/chat-overlay/config` | JWT + `moderation` |
| `PUT` | `/api/chat-overlay/config` | JWT + `moderation` |
| `GET` | `/api/chat-overlay/config/overlay/{channel}` | JWT |
| `GET` | `/api/chat-overlay/emotes` | JWT + `moderation` |
| `POST` | `/api/chat-overlay/emotes/refresh` | JWT + `moderation` |
| `GET` | `/api/chat-overlay/resolve/{channel}` | JWT |
| `GET` | `/api/chat-overlay/status` | JWT + `moderation` |
| `POST` | `/api/chat-overlay/test` | JWT + `moderation` |

### Coin

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/commands/default` | JWT |
| `GET` | `/api/commands/{commandName}/status` | JWT |
| `POST` | `/api/commands/{commandName}/toggle` | JWT |

### Credit Purchase

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/tts-credits/billing-preview` | JWT |
| `POST` | `/api/tts-credits/buy` | JWT |
| `GET` | `/api/tts-credits/packages` | JWT |
| `GET` | `/api/tts-credits/purchases` | JWT |
| `GET` | `/api/tts-credits/purchases/{purchaseId}/download/{formato}` | JWT |

### Custom Commands

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/CustomCommands` | JWT |
| `POST` | `/api/CustomCommands` | JWT |
| `DELETE` | `/api/CustomCommands/{id}` | JWT |
| `GET` | `/api/CustomCommands/{id}` | JWT |
| `PUT` | `/api/CustomCommands/{id}` | JWT |

### Decatron AI

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/decatron-ai/check-access` | JWT |
| `GET` | `/api/decatron-ai/config` | JWT |
| `POST` | `/api/decatron-ai/config` | JWT |
| `GET` | `/api/decatron-ai/stats` | JWT |

### Design

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/design/tokens` | Público |

### Desktop

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/desktop/devices` | JWT + `settings` |
| `POST` | `/api/desktop/devices/claim` | Público |
| `POST` | `/api/desktop/devices/link-code` | JWT + `settings` |
| `DELETE` | `/api/desktop/devices/{id}` | JWT + `settings` |
| `GET` | `/api/desktop/releases/latest` | Público |

### Discord Auth

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/auth/discord/exchange` | Público |
| `GET` | `/api/auth/discord/link` | Público |
| `POST` | `/api/auth/discord/link-start` | JWT |
| `GET` | `/api/auth/discord/login` | Público |
| `GET` | `/api/auth/discord/me` | JWT |
| `POST` | `/api/auth/discord/unlink` | JWT |

### Discord Levels

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/discord/alerts/search/{channelName}` | JWT + `settings` |
| `DELETE` | `/api/discord/alerts/{alertId}` | JWT + `settings` |
| `PUT` | `/api/discord/alerts/{alertId}` | JWT + `settings` |
| `GET` | `/api/discord/alerts/{guildId}` | JWT + `settings` |
| `POST` | `/api/discord/alerts/{guildId}` | JWT + `settings` |
| `GET` | `/api/discord/alerts/{guildId}/status` | JWT + `settings` |

### Discord OAuth

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/discord/auth` | JWT + `settings` |
| `GET` | `/api/discord/callback` | Público |
| `GET` | `/api/discord/channels/{guildId}` | JWT + `settings` |
| `PUT` | `/api/discord/config/{guildId}` | JWT + `settings` |
| `GET` | `/api/discord/guilds` | JWT + `settings` |
| `POST` | `/api/discord/link` | JWT + `settings` |
| `GET` | `/api/discord/linked` | JWT + `settings` |
| `GET` | `/api/discord/status` | JWT |
| `DELETE` | `/api/discord/unlink/{guildId}` | JWT + `settings` |

### Discord Welcome

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/discord/welcome/{guildId}` | JWT + `settings` |
| `PUT` | `/api/discord/welcome/{guildId}` | JWT + `settings` |
| `GET` | `/api/discord/welcome/{guildId}/roles` | JWT + `settings` |
| `POST` | `/api/discord/welcome/{guildId}/test` | JWT + `settings` |
| `POST` | `/api/discord/welcome/{guildId}/upload-image` | JWT + `settings` |

### Epic Auth

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/auth/epic/callback` | Público |
| `GET` | `/api/me/epic/login-url` | JWT |
| `GET` | `/api/me/epic/status` | JWT |

### Event Alerts

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/EventAlerts/config` | JWT |
| `POST` | `/api/EventAlerts/config` | JWT |
| `GET` | `/api/EventAlerts/config/overlay/{channelName}` | JWT |
| `POST` | `/api/EventAlerts/test` | JWT |

### Followers

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/Followers` | JWT |
| `GET` | `/api/Followers/stats` | JWT |
| `POST` | `/api/Followers/sync` | JWT |
| `POST` | `/api/Followers/{userId}/block` | JWT |
| `GET` | `/api/Followers/{userId}/history` | JWT |
| `POST` | `/api/Followers/{userId}/unblock` | JWT |

### Fortnite

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/fortnite/collection/{username}` | Público |
| `GET` | `/api/fortnite/current-season` | Público |
| `GET` | `/api/fortnite/leaderboard/global` | Público |
| `GET` | `/api/fortnite/my-collection` | JWT |
| `POST` | `/api/fortnite/my-collection/mark` | JWT |
| `DELETE` | `/api/fortnite/my-collection/{spriteKey}` | JWT |
| `GET` | `/api/fortnite/new-since-last-visit` | JWT |
| `GET` | `/api/fortnite/notification-prefs` | JWT |
| `PUT` | `/api/fortnite/notification-prefs` | JWT |
| `GET` | `/api/fortnite/sprites` | Público |

### Gacha Auth

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/gacha-auth/config` | Público |
| `POST` | `/api/gacha-auth/link` | JWT |
| `GET` | `/api/gacha-auth/status` | JWT |
| `POST` | `/api/gacha-auth/unlink` | JWT |
| `POST` | `/api/gacha-auth/validate` | Público |

### Gacha

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/gacha/public/collection` | Público |
| `GET` | `/api/gacha/public/ranking` | Público |
| `GET` | `/api/gacha/public/sound-config/{channel}` | Público |

### Gacha Viewer

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/me/game-accounts` | JWT |
| `POST` | `/api/me/game-accounts` | JWT |
| `GET` | `/api/me/game-accounts/catalog` | JWT |
| `DELETE` | `/api/me/game-accounts/{id}` | JWT |
| `PUT` | `/api/me/game-accounts/{id}` | JWT |
| `POST` | `/api/me/game-accounts/{id}/verify` | JWT |

### Game

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/commands/game/current` | JWT + `game` |
| `GET` | `/api/commands/game/history` | JWT + `game` |
| `GET` | `/api/commands/game/status` | JWT + `game` |
| `POST` | `/api/commands/game/toggle` | JWT + `game` |
| `POST` | `/api/commands/game/update` | JWT + `game` |

### Game Overlays

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
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
| `GET` | `/api/public/global-emotes` | Público |

### Goals

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/Goals/config` | JWT + `overlays` |
| `POST` | `/api/Goals/config` | JWT + `overlays` |
| `GET` | `/api/Goals/config/overlay/{channelName}` | JWT |
| `GET` | `/api/Goals/history` | JWT + `overlays` |
| `POST` | `/api/Goals/{goalId}/progress` | JWT + `overlays` |
| `POST` | `/api/Goals/{goalId}/reset` | JWT + `overlays` |
| `POST` | `/api/Goals/{goalId}/set` | JWT + `overlays` |

### Kick Auth

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/auth/kick/link-start` | JWT |
| `GET` | `/api/auth/kick/login` | Público |
| `POST` | `/api/auth/kick/subscribe-rewards` | JWT |
| `POST` | `/api/auth/kick/unlink` | JWT |

### Kick Webhook

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/webhooks/kick/events` | Público |

### Language

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/Language` | JWT |
| `PUT` | `/api/Language` | JWT |
| `GET` | `/api/Language/supported` | JWT |

### Live Overlays

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/live-overlays` | JWT + `overlays` |
| `POST` | `/api/live-overlays` | JWT + `overlays` |
| `GET` | `/api/live-overlays/overlay/{channel}` | JWT |
| `DELETE` | `/api/live-overlays/{slug}` | JWT + `overlays` |
| `PUT` | `/api/live-overlays/{slug}` | JWT + `overlays` |

### Live Translation

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/live-translation/admin/active` | JWT |
| `GET` | `/api/live-translation/admin/overview` | JWT |
| `GET` | `/api/live-translation/admin/sessions` | JWT |
| `POST` | `/api/live-translation/admin/stop/{userId}` | JWT |
| `GET` | `/api/live-translation/public/{login}` | Público |
| `GET` | `/api/live-translation/sessions` | JWT + `settings` |
| `GET` | `/api/live-translation/settings` | JWT + `settings` |
| `PUT` | `/api/live-translation/settings` | JWT + `settings` |
| `GET` | `/api/live-translation/status` | JWT + `settings` |
| `POST` | `/api/live-translation/stop` | JWT + `settings` |
| `GET` | `/api/live-translation/voices` | JWT |

### Lol Coach

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/lol-coach/settings` | JWT + `settings` |
| `PUT` | `/api/lol-coach/settings` | JWT + `settings` |
| `GET` | `/api/lol-coach/state` | JWT + `settings` |

### Micro Commands

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/pets/catalog` | JWT |
| `GET` | `/api/pets/config` | JWT + `overlays` |
| `POST` | `/api/pets/config` | JWT + `overlays` |
| `GET` | `/api/pets/models/{id}/file` | JWT |
| `GET` | `/api/pets/models/{id}/sign` | JWT |
| `GET` | `/api/pets/overlay/{channel}` | JWT |
| `POST` | `/api/pets/test` | JWT + `overlays` |

### Public Commands

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/public/commands/{channel}` | Público |
| `GET` | `/api/publiccommands/config` | JWT |
| `POST` | `/api/publiccommands/config` | JWT |

### Public Emotes

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/public/emotes/{channel}` | Público |
| `GET` | `/api/public/emotes/{channel}/me` | JWT |
| `DELETE` | `/api/public/emotes/{channel}/mine/{id}` | JWT |
| `POST` | `/api/public/emotes/{channel}/upload` | JWT |
| `POST` | `/api/public/emotes/{channel}/{id}/report` | JWT |

### Raffle

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/me/riot-accounts` | JWT |
| `POST` | `/api/me/riot-accounts` | JWT |
| `DELETE` | `/api/me/riot-accounts/{id}` | JWT |
| `POST` | `/api/me/riot-accounts/{id}/verify` | JWT |

### Ruleta

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/ruleta/config` | JWT |
| `POST` | `/api/ruleta/config` | JWT |

### Scripts

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/Scripts` | JWT |
| `POST` | `/api/Scripts` | JWT |
| `POST` | `/api/Scripts/preview` | JWT |
| `POST` | `/api/Scripts/validate` | JWT |
| `DELETE` | `/api/Scripts/{id}` | JWT |
| `GET` | `/api/Scripts/{id}` | JWT |
| `PUT` | `/api/Scripts/{id}` | JWT |

### Settings

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/Shoutout/config` | JWT |
| `POST` | `/api/Shoutout/config` | JWT |
| `GET` | `/api/Shoutout/config/overlay/{channel}` | JWT |
| `GET` | `/api/Shoutout/history` | JWT |
| `GET` | `/api/Shoutout/native-status` | JWT |
| `POST` | `/api/Shoutout/test` | JWT |

### Song Request

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/sr/{channel}` | Público |
| `GET` | `/sr/{channel}/p/{code}` | Público |

### Sound Alerts

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/speakchat/config` | JWT |
| `POST` | `/api/speakchat/config` | JWT |
| `GET` | `/api/speakchat/config/overlay/{channelName}` | JWT |
| `POST` | `/api/speakchat/overlay/reload` | JWT |
| `POST` | `/api/speakchat/test` | JWT |
| `GET` | `/api/speakchat/usage` | JWT |

### Spotify

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/spotify/authorize-url` | JWT + `overlays` |
| `GET` | `/api/spotify/callback` | Público |
| `POST` | `/api/spotify/disconnect` | JWT + `overlays` |
| `GET` | `/api/spotify/status` | JWT + `overlays` |

### Supporters

| Método | Ruta | Acceso |
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
| `POST` | `/api/Supporters/capture-donation-order` | Público |
| `POST` | `/api/Supporters/capture-paypal-order` | JWT |
| `GET` | `/api/Supporters/config` | JWT |
| `POST` | `/api/Supporters/config` | JWT |
| `POST` | `/api/Supporters/create-culqi-charge` | JWT |
| `POST` | `/api/Supporters/create-culqi-donation` | Público |
| `POST` | `/api/Supporters/create-donation-order` | Público |
| `POST` | `/api/Supporters/create-paypal-order` | JWT |
| `GET` | `/api/Supporters/culqi-public-key` | Público |
| `GET` | `/api/Supporters/discount-codes` | JWT |
| `POST` | `/api/Supporters/discount-codes` | JWT |
| `DELETE` | `/api/Supporters/discount-codes/{id}` | JWT |
| `PATCH` | `/api/Supporters/discount-codes/{id}` | JWT |
| `GET` | `/api/Supporters/list` | JWT |
| `GET` | `/api/Supporters/list-public` | Público |
| `GET` | `/api/Supporters/my-invoices` | JWT |
| `GET` | `/api/Supporters/my-invoices/{paymentId}/download/{formato}` | JWT |
| `POST` | `/api/Supporters/paypal/webhook` | Público |
| `GET` | `/api/Supporters/public-config` | Público |
| `GET` | `/api/Supporters/tier-limits` | Público |
| `GET` | `/api/Supporters/validate-code` | Público |

### Tcg

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/timer/backup` | JWT |
| `GET` | `/api/timer/backup/by-session/{sessionId}` | JWT |
| `GET` | `/api/timer/backup/list` | JWT |
| `POST` | `/api/timer/backup/restore-session` | JWT |
| `POST` | `/api/timer/backup/restore/{id}` | JWT |

### Timer Extension

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/timer/media` | JWT |
| `GET` | `/api/timer/media/categories` | JWT |
| `GET` | `/api/timer/media/download-zip` | JWT |
| `POST` | `/api/timer/media/upload` | JWT |
| `DELETE` | `/api/timer/media/{id}` | JWT |
| `PUT` | `/api/timer/media/{id}/move` | JWT |
| `PUT` | `/api/timer/media/{id}/rename` | JWT |

### Timers

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/Timers` | JWT + `timers` |
| `POST` | `/api/Timers` | JWT + `timers` |
| `DELETE` | `/api/Timers/{id}` | JWT + `timers` |
| `GET` | `/api/Timers/{id}` | JWT + `timers` |
| `PUT` | `/api/Timers/{id}` | JWT + `timers` |
| `POST` | `/api/Timers/{id}/test` | JWT + `timers` |

### Tips

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/Tips/config` | JWT |
| `POST` | `/api/Tips/config` | JWT |
| `GET` | `/api/Tips/history` | JWT |
| `GET` | `/api/Tips/page/{channelName}` | Público |
| `GET` | `/api/Tips/paypal/callback` | Público |
| `POST` | `/api/Tips/paypal/capture-order` | Público |
| `GET` | `/api/Tips/paypal/connect` | JWT |
| `POST` | `/api/Tips/paypal/create-order` | Público |
| `POST` | `/api/Tips/paypal/disconnect` | JWT |
| `GET` | `/api/Tips/paypal/resolve-token` | JWT |
| `POST` | `/api/Tips/paypal/webhook` | Público |
| `GET` | `/api/Tips/statistics` | JWT |
| `POST` | `/api/Tips/test` | JWT |
| `GET` | `/api/Tips/top-donors` | JWT |

### Title Command

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/commands/title/current` | JWT + `commands` |
| `GET` | `/api/commands/title/history` | JWT + `commands` |
| `GET` | `/api/commands/title/status` | JWT + `commands` |
| `POST` | `/api/commands/title/toggle` | JWT + `commands` |
| `POST` | `/api/commands/title/update` | JWT + `commands` |

### Tournament Admin

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/appearance` | JWT |
| `PUT` | `/api/admin/tournament/editions/{editionId}/appearance` | JWT |
| `DELETE` | `/api/admin/tournament/editions/{editionId}/appearance/{kind}` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/appearance/{kind}` | JWT |
| `GET` | `/api/public/tournament/assets/{editionId}/{file}` | Público |

### Tournament Blue Shell Admin

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/dashboard` | JWT |

### Tournament Embed

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/embed/torneo/{channelName}/{editionSlug}/ranking` | Público |
| `GET` | `/api/overlay/torneo/{token}` | Público |

### Tournament Fortnite Admin

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
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

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/participants/{participantId}/overlay` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/participants/{participantId}/overlay` | JWT |

### Tournament Prize Admin

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/prizes` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/prizes` | JWT |
| `DELETE` | `/api/admin/tournament/prizes/{prizeId}` | JWT |
| `PUT` | `/api/admin/tournament/prizes/{prizeId}` | JWT |

### Tournament Public

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}` | Público |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/bracket` | Público |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/fortnite/files/{fileId}` | Público |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/fortnite/standings` | Público |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/fortnite/teams/{teamId}` | Público |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/participants` | Público |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/participants/{participantId}` | Público |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/prizes` | Público |
| `GET` | `/api/public/tournament/{channelName}/{editionSlug}/rules` | Público |

### Tournament Registration Admin

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/registrations` | JWT |
| `POST` | `/api/admin/tournament/participants/{participantId}/approve` | JWT |
| `POST` | `/api/admin/tournament/participants/{participantId}/reject` | JWT |

### Tournament Rules Admin

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/rules` | JWT |
| `PUT` | `/api/admin/tournament/editions/{editionId}/rules` | JWT |

### Tournament Sponsor Admin

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/sponsors` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/sponsors` | JWT |
| `DELETE` | `/api/admin/tournament/sponsors/{sponsorId}` | JWT |
| `PUT` | `/api/admin/tournament/sponsors/{sponsorId}` | JWT |
| `PUT` | `/api/admin/tournament/sponsors/{sponsorId}/status` | JWT |

### Tournament Team Admin

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/admin/tournament/bracket/matches/{matchId}/result` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/bracket` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/bracket/generate` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/bracket/next-round` | JWT |
| `GET` | `/api/admin/tournament/editions/{editionId}/teams` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/teams` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/teams/{teamId}/members` | JWT |

### Tournament Win Condition Admin

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/admin/tournament/editions/{editionId}/win-conditions` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/win-conditions` | JWT |
| `POST` | `/api/admin/tournament/editions/{editionId}/win-conditions/resync` | JWT |
| `DELETE` | `/api/admin/tournament/win-conditions/{conditionId}` | JWT |
| `PUT` | `/api/admin/tournament/win-conditions/{conditionId}` | JWT |

### Tts

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/Tts/generate` | JWT |

### Tts Credits

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/tts-credits/balance` | JWT |
| `GET` | `/api/tts-credits/history` | JWT |
| `GET` | `/api/tts-credits/summary` | JWT |

### Tts Voices

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/tts/premium-voices` | JWT |
| `GET` | `/api/tts/standard-voices` | JWT |
| `GET` | `/api/tts/voices` | JWT |

### Twitch OAuth Proxy

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/oauth/twitch/token` | Público |

### Twitch Webhook

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/twitch/eventsub/subscribe/channel-points` | JWT + `settings` |
| `POST` | `/api/twitch/eventsub/subscribe/chat` | JWT + `settings` |
| `POST` | `/api/twitch/eventsub/subscribe/follow` | JWT + `settings` |
| `GET` | `/api/twitch/eventsub/subscriptions` | JWT + `settings` |
| `DELETE` | `/api/twitch/eventsub/subscriptions/{subscriptionId}` | JWT + `settings` |
| `POST` | `/api/twitch/webhook` | Público |

### User Permissions

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/user/available-accounts` | JWT |
| `GET` | `/api/user/channel-users` | JWT + `user_management` |
| `GET` | `/api/user/permissions` | JWT |

### Watchtime

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/api/watchtime/config` | JWT |
| `POST` | `/api/watchtime/config` | JWT |

### Wheel

| Método | Ruta | Acceso |
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

## WebSocket / Hubs de SignalR

Decatron tiene tres hubs de SignalR y un WebSocket directo. Sus métodos, grupos y eventos están documentados en [OVERLAYS.md](OVERLAYS.md#referencia-de-eventos-de-signalr) y en [ARCHITECTURE.md](ARCHITECTURE.md#4-comunicación-en-tiempo-real).

| Endpoint | Propósito |
|----------|-----------|
| `/hubs/overlay` | Overlays de OBS y vistas previas del panel (grupo `overlay_{canal}`) |
| `/hubs/songrequest` | Reproductor, overlays, panel y cola pública de Song Request |
| `/hubs/translation` | Traducción en vivo para espectadores (extensión de navegador) |
| `/api/desktop/ws` | App de escritorio Decatron Desktop (un único WebSocket multiplexado) |

Las conexiones de los overlays no necesitan autenticación.

---

## Endpoints de archivos estáticos

Estas rutas sirven archivos estáticos desde disco (las carpetas son configurables, consulta [ENV_VARIABLES.md](ENV_VARIABLES.md#rutas-físicas)):

| Ruta | Descripción |
|------|-------------|
| `/downloads/*` | Clips de Twitch descargados |
| `/uploads/soundalerts/*` | Archivos de alertas de sonido subidos |
| `/uploads/brand/*` | Logos de la marca |
| `/uploads/emotes/*` | Imágenes de emotes de canal y globales |
| `/timerextensible/*` | Archivos de medios de la extensión del timer |
| `/tts-audio/*` | Audio de TTS en caché |
| `/system-files/*` | Sonidos e imágenes precargados |
| `/tcg-packs/*` | Imágenes de los sobres de cartas |
| `/swagger` | Swagger UI (solo en Development) |

---

## URL de overlays (páginas públicas)

Las URL de los overlays y de las páginas públicas están en [OVERLAYS.md](OVERLAYS.md#referencia-rápida). Las páginas públicas que no necesitan inicio de sesión incluyen `/tip/{canal}` (también `/donate/{canal}`), `/commands/{canal}`, `/sr/{canal}`, `/torneos/{canal}/{edicion}`, `/emotes/{canal}`, `/supporters`, `/oauth/authorize` y `/docs/*`.

---

## Formato de errores

La mayoría de los endpoints del panel devuelven objetos JSON como:

```json
{
  "success": false,
  "message": "Descripción del error"
}
```

Las excepciones no controladas las captura `GlobalExceptionMiddleware` y devuelven HTTP 500 con un mensaje genérico y sin detalles internos. La API pública v1 usa `{ "error": "codigo" }` en su lugar.

| Código | Significado |
|--------|-------------|
| 200 | Éxito |
| 400 | Solicitud incorrecta (error de validación, parámetros faltantes) |
| 401 | No autorizado (token ausente o inválido) |
| 403 | Prohibido (permisos insuficientes) |
| 404 | No encontrado |
| 429 | Demasiadas solicitudes (rutas con límite) |
| 500 | Error interno del servidor |

---

## Límite de solicitudes

No hay un límite global. Unas políticas nombradas de ventana fija protegen algunas rutas públicas:

| Política | Límite | Se usa en |
|----------|--------|-----------|
| `tournament-register` | 5 solicitudes cada 10 minutos | Endpoints de inscripción a torneos |
| `tournament-embed` | 60 solicitudes por minuto | Overlay de torneos y widget de ranking |
| `tcg-images` | 600 solicitudes por minuto | Imágenes de cartas coleccionables |
| `live-translation-public` | 60 solicitudes por minuto | Endpoint público de traducción en vivo |
| `live-translation-claim` | 10 solicitudes cada 10 minutos | Vincular Decatron Desktop con un código |

Los endpoints públicos sensibles al abuso que aún no tienen límite incluyen `POST /api/tips/paypal/create-order`, `POST /api/tips/paypal/capture-order`, `POST /api/gacha-auth/validate` y `POST /api/tts/generate`.
