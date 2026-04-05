# GachaVerse Frontend and Overlay Audit

## Overview

This document covers all web pages, the OBS overlay system, animation sequences, styling, and the real-time communication layer. This is the most visually complex part of the migration.

---

## Pages

### Index (/)

- Landing page with call-to-action for registration/login.
- Basic feature showcase.
- No authentication required.

### Login (/login)

- Toggle between login and register forms.
- Login: email + password.
- Register: username + email + password.
- All auth is session-based with bcrypt.

### Gacha (/gacha)

Main pull interface for viewers.

- **Banner**: Streamer's custom banner image at the top.
- **Donation form**: Input to record donation amounts.
- **Top donors**: Leaderboard of highest donors.
- **Collection grid**: Display of items won, organized by rarity.
- **Redemption modal**: Popup for redeeming eligible items.

### Dashboard (/dashboard)

Streamer management panel with **8 tabs**:

| Tab | Function |
|-----|----------|
| Items | CRUD for gacha items (name, rarity, image upload) |
| Restrictions | Configure per-item restrictions (donation, quantity, unique, cooldown) |
| Preferences | Set per-viewer or global probability overrides |
| Rarity Restrictions | Configure rarity-level pull/time intervals |
| Probabilities | Customize rarity distribution percentages |
| Banners | Upload and manage gacha page banners |
| Commands | Enable/disable commands, set cooldowns, configure aliases |
| Guides | Help documentation for streamer setup |

### Profile (/profile)

User account management:

- **Avatar**: Upload and preview profile image.
- **Username/Email**: Edit display name and email.
- **Password**: Change with strength meter visualization.
- **Twitch connect**: OAuth link/unlink.
- **Data export**: Download all user data as JSON.
- **Account delete**: Permanent deletion with confirmation.

### Collection (/collection)

Viewer inventory browser:

- **Filter**: By rarity and redemption status.
- **Search**: Text search across item names.
- **History**: Chronological pull history.
- **Stats cards**: Total items, rarity breakdown, completion percentage.

### Overlay Config (/overlay/config)

Authenticated page for streamers to configure their OBS overlay:

- **Size presets**: Small, medium, large, custom dimensions.
- **Animation speed**: Adjust timing multiplier.
- **OBS URL**: Copy-ready browser source URL.
- **Chat monitor**: Live preview of chat commands.
- **Debug mode**: Show animation boundaries and timing data.

### Overlay Display (/overlay/gacha/:userId)

**PUBLIC endpoint** — no authentication required. This is the URL added as an OBS browser source.

- Transparent background (for OBS chromakey-free compositing).
- Listens for Socket.IO events to trigger card animations.
- Queue system for handling rapid sequential pulls.

---

## Overlay Animation Sequence

Total duration: **10 seconds** (default, adjustable via animation speed setting).

### Phase 1: Flash (2 seconds)

- **Trigger**: Legendary and Epic rarity items ONLY. Common, Uncommon, and Rare skip this phase.
- **Visual**: Radial gradient expanding from center.
- **Effect**: 12 light rays rotating outward from the center point.
- **Color**: Matches rarity color (gold for Legendary, purple for Epic).

### Phase 2: Particles (3 seconds)

- **Count**: 30-70 particles, scaled by rarity:
  - Common: 30 particles
  - Uncommon: 40 particles
  - Rare: 50 particles
  - Epic: 60 particles
  - Legendary: 70 particles + star particles + energy wave effect
- **Behavior**: Particles emanate from center, drift outward with gravity and fade.
- **Color**: Rarity-specific palette.

### Phase 3: Card Reveal (2 seconds)

- **Animation**: Scale from 0 to 1 (grow from nothing to full size).
- **Easing**: `cubic-bezier` for a bouncy, satisfying feel.
- **Border**: Glowing border matching rarity color.

### Phase 4: Display (3 seconds)

- **State**: Card fully visible at final size.
- **Effects**: Subtle shimmer/glow animation on the card border.
- **Content**: Item image, item name, rarity label.

### Phase 5: Fade Out (0.5 seconds)

- **Animation**: Scale from 1 to 0 (shrink to nothing).
- **Timing**: Quick exit to prepare for next card in queue.

---

## Color System

| Rarity | Hex Code | Usage |
|--------|----------|-------|
| Legendary | #ffd700 | Borders, particles, flash, text glow |
| Epic | #9370db | Borders, particles, flash, text glow |
| Rare | #4169e1 | Borders, particles, text |
| Uncommon | #32cd32 | Borders, particles, text |
| Common | #c0c0c0 | Borders, particles, text |

Colors are used consistently across the overlay, collection page, dashboard, and gacha page.

---

## Real-Time Communication

### Primary: Socket.IO

- Server emits events to room `user_${userId}`.
- Client joins room on connection.
- Events: `gacha-result` (pull data), `collection-update` (stats refresh).

### Fallback: Polling

- 3-second interval HTTP polling.
- Auto-detection: if Socket.IO connection fails, client falls back to polling.
- Polling endpoint returns pending events since last check.

### Queue System

- Client-side queue for handling multiple rapid events.
- Each card animation must complete before the next begins.
- Queue processes FIFO with the full 10s animation per card.
- Matches the server-side 12s delay between pulls (2s buffer for network latency).

---

## Card Dimensions

| Context | Width x Height | Usage |
|---------|---------------|-------|
| Gacha page | 200 x 280 px | Collection grid display |
| Overlay | 350 x 500 px | OBS animation cards |
| Dashboard | 150 x 200 px | Item management thumbnails |

---

## CSS and Theming

### Base Theme

- **Background**: Dark theme (near-black base).
- **Primary accent**: Cyan (#00bcd4 or similar).
- **Highlight accent**: Gold (#ffd700) for premium elements.
- **Text**: White primary, gray secondary.

### Responsive Breakpoints

Standard responsive design with breakpoints for:
- Mobile (< 768px)
- Tablet (768px - 1024px)
- Desktop (> 1024px)

The overlay page is NOT responsive -- it uses fixed dimensions appropriate for OBS browser sources.

---

## File Upload Constraints

| Type | Max Size | Accepted Formats |
|------|----------|-----------------|
| Item images | 3 MB | WebP, WebM, JPG, PNG, GIF |
| Banners | 5 MB | WebP, WebM, JPG, PNG, GIF |
| Avatars | 2 MB | WebP, WebM, JPG, PNG, GIF |

All uploads handled by Multer middleware. Files stored in `/public/uploads/` subdirectories.

---

## Migration: EJS to React

### Current (GachaVerse)

- Server-rendered EJS templates.
- jQuery for DOM manipulation.
- Inline `<script>` blocks for Socket.IO and interactivity.
- CSS files per page.

### Target (Decatron React)

| GachaVerse Page | Decatron Component Location |
|----------------|---------------------------|
| Gacha page | `ClientApp/src/pages/gacha/` |
| Dashboard | `ClientApp/src/pages/gacha/dashboard/` |
| Collection | `ClientApp/src/pages/gacha/collection/` |
| Profile | Existing Decatron profile system |
| Overlay Config | `ClientApp/src/pages/gacha/overlay-config/` |
| Overlay Display | Standalone route, minimal React wrapper |

### Socket.IO to SignalR

| Socket.IO Concept | SignalR Equivalent |
|-------------------|-------------------|
| `io.to(room).emit(event, data)` | `Clients.Group(group).SendAsync(method, data)` |
| `socket.join(room)` | `Groups.AddToGroupAsync(connectionId, group)` |
| Client `socket.on(event, cb)` | `connection.on(method, cb)` |
| Polling fallback | Built-in (Long Polling, SSE, WebSocket) |

### Key Considerations

- Overlay must remain a **public, unauthenticated** endpoint.
- Animation CSS/JS should be preserved exactly (timing, easing, colors).
- The overlay is iframe-friendly (OBS browser source).
- Card queue logic moves from vanilla JS to React state management.
- File upload constraints should be enforced both client-side and server-side.
