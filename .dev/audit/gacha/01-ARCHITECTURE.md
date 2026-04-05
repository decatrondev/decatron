# GachaVerse Architecture Audit

## Overview

GachaVerse is a standalone Node.js web application that provides a gacha (loot box) system for Twitch streamers. This document captures the full architecture prior to migration into the Decatron platform.

| Metric | Value |
|--------|-------|
| Core files | 23 |
| Total LOC | ~4,328 |
| Stack | Node.js + Express + EJS + MySQL/PostgreSQL + Socket.IO + tmi.js |

---

## Stack Breakdown

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Web framework | Express |
| Template engine | EJS |
| Database | MySQL / PostgreSQL (dual support) |
| Real-time | Socket.IO |
| Twitch chat | tmi.js |
| Auth | Session-based (bcrypt) + Twitch OAuth via C# bot callback |
| File uploads | Multer |

---

## Entry Point

### app.js (397 lines)

The main entry point configures and boots the entire application:

- Express server initialization
- Socket.IO attachment and room management
- Session management (memory store)
- Route mounting for all feature modules
- Static file serving
- Environment variable loading via dotenv

---

## Configuration

### database.js

MySQL connection pool configuration. Manages the primary data connection for GachaVerse tables.

### dbConfig.js

Database type selector that determines whether MySQL or PostgreSQL is used at runtime. Allows the application to operate against either backend transparently.

---

## Authentication

- **Session-based**: Express sessions stored in memory, passwords hashed with bcrypt.
- **Twitch OAuth**: Handled through a callback mechanism from the C# bot. The bot performs the OAuth flow and passes credentials back to the Node.js app.
- No JWT, no token-based auth for the web layer.

---

## Route Structure

All routes are mounted from `app.js` and follow Express Router conventions:

| Route Module | Path Prefix | Purpose |
|-------------|-------------|---------|
| auth | /auth | Login, register, logout, Twitch connect |
| gacha | /gacha | Main pull page, pull API |
| dashboard | /dashboard | Streamer management panel |
| overlay | /overlay | OBS overlay config and display |
| profile | /profile | User account management |
| collection | /collection | Viewer inventory and history |
| decabanner | /decabanner | Banner image management |
| restrictions | /restrictions | Item restriction rules |
| guides | /guides | Help and documentation pages |

---

## Controllers (2,188 LOC)

Controllers contain the bulk of business logic and are responsible for handling requests, querying the database, and rendering views.

| Controller | LOC | Responsibility |
|-----------|-----|----------------|
| authController | 56 | Login, register, logout, session handling |
| gachaController | 604 | Pull logic, probability calculation, multi-pull orchestration |
| dashboardController | 544 | Item CRUD, restriction config, preference management, banner uploads |
| overlayController | 208 | Overlay config, OBS URL generation, Socket.IO event emission |
| profileController | 269 | Avatar upload, password change, Twitch connection, data export, account deletion |
| collectionController | 465 | Inventory display, filtering, history, stats aggregation |
| decabannerController | 121 | Banner image upload and management |
| restrictionsController | 117 | Item restriction CRUD |

---

## Services (1,289 LOC)

Services encapsulate Twitch chat integration and command processing.

| Service | LOC | Responsibility |
|---------|-----|----------------|
| commandHandler | 303 | Dynamic command loading from /commands/, permission checks, cooldown enforcement, command_configs DB sync |
| twitchChatService | 517 | tmi.js client for MySQL backend, message parsing, event routing |
| twitchChatServicePG | 469 | tmi.js client for PostgreSQL backend, same logic adapted for PG queries |

---

## Models

Minimal model layer (ORM-less):

| Model | LOC | Purpose |
|-------|-----|---------|
| Item.js | 9 | Item data structure |
| User.js | 9 | User data structure |

Models are essentially value objects. All query logic lives in controllers and services.

---

## Command System

Commands are loaded dynamically from the `/commands/` directory:

| Command | Function |
|---------|----------|
| tirar | Core pull command |
| tiros | Check available pulls |
| coleccion | Link to collection page |
| renombrar | Rename participant |
| pausa | Pause multi-pull |
| reanudar | Resume multi-pull |
| test | Debug overlay card |

---

## Socket.IO Architecture

Real-time communication uses Socket.IO with room-based isolation:

| Room Pattern | Purpose |
|-------------|---------|
| `user_${userId}` | Overlay events (pull results, animations) |
| `collection_${userId}` | Collection stats updates |

Clients join rooms on connection. The server emits events to specific rooms when pulls occur or stats change.

---

## Database Connections

The application maintains up to 3 simultaneous database connections:

| Connection | Backend | Purpose |
|-----------|---------|---------|
| GachaVerse data | MySQL | Items, participants, pulls, restrictions, preferences |
| Tokens | MySQL or PostgreSQL | Bot tokens, auth tokens |
| Sessions | Memory (in-process) | Express session store |

---

## Middleware Pipeline

Request processing follows this order:

1. **dotenv** — Load environment variables
2. **express.static** — Serve /public directory
3. **express.json()** — Parse JSON request bodies
4. **express-session** — Session initialization
5. **res.locals** — Inject user data into templates
6. **Twitch connection check** — Verify bot connectivity
7. **Route handlers** — Dispatch to appropriate controller
8. **Controller logic** — Business logic execution

---

## Environment Variables

| Variable Group | Keys | Purpose |
|---------------|------|---------|
| Server | PORT | HTTP listen port |
| Database | DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT | MySQL connection |
| PostgreSQL | POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASS, POSTGRES_DB, POSTGRES_PORT | PostgreSQL connection |
| Twitch | TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_REDIRECT_URI | OAuth config |
| Bot API | BOT_API_URL, BOT_API_KEY | C# bot communication |

---

## File Upload Configuration

Multer handles all file uploads with the following structure:

| Upload Type | Max Size | Destination |
|------------|----------|-------------|
| Item images | 3 MB | /public/uploads/items/ |
| Banners | 5 MB | /public/uploads/banners/ |
| Avatars | 2 MB | /public/uploads/avatars/ |

Accepted formats: WebP, WebM, JPG, PNG, GIF.

---

## Migration Implications

| Current | Decatron Target |
|---------|----------------|
| Express routes | ASP.NET Core controllers |
| EJS templates | React (ClientApp) |
| Socket.IO | SignalR |
| tmi.js | Existing Decatron bot infrastructure |
| MySQL/PostgreSQL raw queries | Entity Framework Core |
| Multer file uploads | ASP.NET Core file handling |
| bcrypt sessions | Existing Decatron auth system |
| Memory session store | Decatron session/token management |
