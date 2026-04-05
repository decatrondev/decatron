# 07 - Migration Plan: GachaVerse to Decatron

**Created:** 2026-04-04
**Project:** GachaVerse Migration
**Target Platform:** Decatron (ASP.NET Core + React + SignalR)

---

## Overview

This document outlines the phased migration plan for integrating GachaVerse functionality into the Decatron platform. The migration is organized into 8 phases, from database modeling through documentation and internationalization.

**Current state:** GachaVerse is a standalone Node.js application with 4 active users.
**Target state:** Fully integrated gacha module within Decatron with multi-channel support, improved security, and i18n.

---

## Phase 1: Database & Models

**Goal:** Create the data layer for the gacha system in Decatron.

### EF Core Models to Create

| Model | Description | Key Fields |
|-------|-------------|------------|
| `GachaItem` | Collectible items | Id, ChannelName, Name, ImageUrl, RarityId, Description, IsActive |
| `GachaParticipant` | Viewer participation per channel | Id, ChannelName, TwitchId, TwitchUsername, AvailablePulls, TotalDonated, TotalPulls |
| `GachaInventory` | Items owned by participants | Id, ParticipantId, ItemId, Quantity, FirstObtainedAt, CustomName |
| `GachaRarityConfig` | Rarity tiers and probabilities | Id, ChannelName, RarityName, BaseProbability, Color, SortOrder |
| `GachaItemRestriction` | Pull restrictions per item | Id, ItemId, RestrictionType, Value (min donation, quantity limit, unique, cooldown) |
| `GachaPreference` | User/global preferences | Id, ChannelName, TwitchId, ItemId, PreferenceType (favorite/hidden/priority), Value |
| `GachaBanner` | Limited-time banners | Id, ChannelName, Name, ImageUrl, StartDate, EndDate, IsActive, BannerItems |
| `GachaOverlayConfig` | Per-channel overlay settings | Id, ChannelName, Theme, AnimationStyle, Duration, ShowRarity, CustomCss |

### Multi-Channel Scoping

All models include a `ChannelName` field to scope data per streamer. This enables:
- Each streamer to manage their own item pool independently
- Viewers to participate across multiple channels with separate inventories
- Isolated configuration (probabilities, restrictions, preferences) per channel

### Migration Scripts

```
Tasks:
- [ ] Create all EF Core model classes in Decatron.Data/Models/Gacha/
- [ ] Add DbSet<T> entries to DecatronDbContext
- [ ] Generate EF Core migration
- [ ] Write SQL migration script for existing data (4 users)
- [ ] Map existing users by twitch_id to Decatron user records
- [ ] Validate data integrity post-migration
```

### Data Migration Details

- **Source:** PostgreSQL (GachaVerse standalone)
- **Target:** Decatron database (via EF Core)
- **Users to migrate:** 4 participants
- **Mapping strategy:** Match by `twitch_id` to existing Decatron user records
- **Items/inventory:** Full migration with ID remapping

---

## Phase 2: Core Service (GachaService)

**Goal:** Port the gacha business logic into a clean C# service.

### Probability Calculation

- Port the weighted selection algorithm with normalization
- Ensure probabilities always sum to 100% after applying preferences and restrictions
- Replace `Math.random()` with `System.Security.Cryptography.RandomNumberGenerator` for cryptographically secure randomness

### Restriction Checking

Port all restriction types:
- **Minimum donation:** Item only available if participant has donated >= threshold
- **Quantity limit:** Maximum number of times an item can be pulled (globally or per user)
- **Unique:** Item can only be pulled once per user
- **Cooldown:** Time-based restriction between pulls of the same item

### Preference System

Priority order for probability modifiers:
1. **User preferences** (per-viewer overrides) — highest priority
2. **Global preferences** (streamer-set channel-wide modifiers)
3. **Base rarity** (default probability from GachaRarityConfig)

### Pull Execution Flow

```
1. Validate participant has available pulls
2. Load active items for channel (filter by restrictions)
3. Calculate effective probabilities (apply preferences)
4. Normalize probabilities to sum to 100%
5. Generate cryptographically secure random number
6. Select item based on weighted probability
7. Update inventory (add item or increment quantity)
8. Decrement available pulls
9. Record pull in history
10. Return result (item, rarity, isNew, inventory count)
```

### Service Interface

```
Tasks:
- [ ] Create IGachaService interface
- [ ] Implement GachaService with dependency injection
- [ ] Port probability calculation with normalization
- [ ] Port restriction checking logic
- [ ] Port preference resolution (user > global > base)
- [ ] Implement pull execution with DB transaction
- [ ] Use RandomNumberGenerator for secure random selection
- [ ] Add donation tracking and pull allocation
- [ ] Unit tests for probability calculation
- [ ] Unit tests for restriction checking
```

---

## Phase 3: API Endpoints (GachaController)

**Goal:** Create REST API endpoints matching current functionality with proper auth.

### Endpoint Map

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/gacha/items` | List items for channel | RequirePermission |
| POST | `/api/gacha/items` | Create item | RequirePermission (Admin) |
| PUT | `/api/gacha/items/{id}` | Update item | RequirePermission (Admin) |
| DELETE | `/api/gacha/items/{id}` | Delete item | RequirePermission (Admin) |
| GET | `/api/gacha/restrictions` | List restrictions | RequirePermission |
| POST | `/api/gacha/restrictions` | Create restriction | RequirePermission (Admin) |
| PUT | `/api/gacha/restrictions/{id}` | Update restriction | RequirePermission (Admin) |
| DELETE | `/api/gacha/restrictions/{id}` | Delete restriction | RequirePermission (Admin) |
| GET | `/api/gacha/preferences` | List preferences | RequirePermission |
| POST | `/api/gacha/preferences` | Set preference | RequirePermission |
| DELETE | `/api/gacha/preferences/{id}` | Remove preference | RequirePermission |
| GET | `/api/gacha/probabilities` | Get probability config | RequirePermission |
| PUT | `/api/gacha/probabilities` | Update probabilities | RequirePermission (Admin) |
| POST | `/api/gacha/pull` | Execute pull(s) | RequirePermission |
| POST | `/api/gacha/donate` | Record donation | RequirePermission (Admin) |
| GET | `/api/gacha/collection/{userId}` | Get user collection | RequirePermission |
| GET | `/api/gacha/banners` | List active banners | RequirePermission |
| POST | `/api/gacha/banners` | Create banner | RequirePermission (Admin) |
| PUT | `/api/gacha/banners/{id}` | Update banner | RequirePermission (Admin) |
| DELETE | `/api/gacha/banners/{id}` | Delete banner | RequirePermission (Admin) |

### Security

All endpoints protected with:
- Decatron authentication (Twitch OAuth)
- `RequirePermission` attribute for authorization
- Built-in CSRF protection
- Rate limiting middleware
- Input validation via model binding + FluentValidation

```
Tasks:
- [ ] Create GachaController with route prefix
- [ ] Implement Items CRUD endpoints
- [ ] Implement Restrictions CRUD endpoints
- [ ] Implement Preferences CRUD endpoints
- [ ] Implement Probabilities endpoints
- [ ] Implement Pull endpoint
- [ ] Implement Donation endpoint
- [ ] Implement Collection endpoint
- [ ] Implement Banner management endpoints
- [ ] Add RequirePermission attributes
- [ ] Add request/response DTOs
- [ ] Add FluentValidation validators
```

---

## Phase 4: Chat Commands

**Goal:** Integrate gacha commands into the Decatron bot command system.

### Command Definitions

| Command | Description | Aliases (configurable) |
|---------|-------------|----------------------|
| `!gtirar` | Pull a card (uses 1 pull) | `!pull`, `!gacha` |
| `!gtiros` | Check available pulls and stats | `!pulls`, `!mypulls` |
| `!gcoleccion` | Get link to collection page | `!inv`, `!collection` |
| `!grenombrar <item> <name>` | Rename an item in collection | `!rename` |
| `!gpausa` | Pause gacha (streamer only) | `!gpause` |
| `!greanudar` | Resume gacha (streamer only) | `!gresume` |

### Integration Points

- Register commands in Decatron's existing command system
- Support per-streamer alias configuration
- Aliases stored in command config per channel
- Aliases follow same permission and cooldown rules as base commands
- All responses use i18n system (see Phase 8)

```
Tasks:
- [ ] Create GachaCommandModule
- [ ] Implement !gtirar command with pull logic
- [ ] Implement !gtiros command with stats display
- [ ] Implement !gcoleccion command with collection link
- [ ] Implement !grenombrar command with rename logic
- [ ] Implement !gpausa / !greanudar commands (streamer permission)
- [ ] Add alias support per channel
- [ ] Integrate with existing command registration
- [ ] Add cooldown configuration per command
- [ ] Add i18n for all response messages
```

---

## Phase 5: Frontend (React)

**Goal:** Build React pages in the Decatron admin panel and public-facing collection viewer.

### Pages to Create

**Admin Panel:**
- **GachaConfig** — Main configuration page with tabs for:
  - Items management (CRUD with image upload)
  - Restrictions management (per-item restriction rules)
  - Preferences management (global probability modifiers)
  - Probabilities configuration (rarity tiers and base rates)
  - Banner management (create/edit limited-time banners)

**Public Pages:**
- **Collection Viewer** — Public page showing a user's collection for a channel
  - Grid/list view toggle
  - Filter by rarity
  - Sort by date obtained, name, rarity
  - Show item count and completion percentage

**Overlay Config:**
- **Overlay Settings** — Admin page for configuring overlay appearance
  - Theme selection
  - Animation style
  - Duration settings
  - Preview mode

```
Tasks:
- [ ] Create GachaConfig page component
- [ ] Build Items tab (list, create, edit, delete with image upload)
- [ ] Build Restrictions tab (per-item restriction management)
- [ ] Build Preferences tab (global preference configuration)
- [ ] Build Probabilities tab (rarity tier configuration)
- [ ] Build Banners tab (banner CRUD with date pickers)
- [ ] Create Collection Viewer page
- [ ] Create Overlay Settings page
- [ ] Add routes to React router
- [ ] Add navigation entries in admin sidebar
- [ ] Wire up all API calls to GachaController
```

---

## Phase 6: Overlay

**Goal:** Port the gacha overlay to Decatron's overlay system with SignalR.

### Migration Details

| Aspect | GachaVerse (Current) | Decatron (Target) |
|--------|---------------------|-------------------|
| URL | Custom route | `/overlays/gacha/:channel` |
| Real-time | Socket.IO | SignalR |
| Transport | WebSocket | WebSocket (SignalR) |
| Frontend | Vanilla JS + CSS | React component |

### Animations to Port

- **Particle effects** — Celebration particles on pull
- **Flash effect** — Screen flash on rare+ pulls
- **Card reveal** — Animated card flip/reveal sequence
- **Rarity-based** — Different effects per rarity tier

### Requirements

- Maintain same visual quality as current overlay
- Improve performance (reduce DOM manipulation, use CSS animations where possible)
- Support OBS Browser Source
- Responsive to overlay dimensions
- Configurable per streamer (theme, duration, effects)

```
Tasks:
- [ ] Create GachaOverlay SignalR hub
- [ ] Create overlay React component
- [ ] Port particle animation system
- [ ] Port flash effect
- [ ] Port card reveal animation
- [ ] Implement rarity-based effect variations
- [ ] Add overlay route to Decatron overlay system
- [ ] Add configuration support (theme, duration)
- [ ] Test in OBS Browser Source
- [ ] Performance optimization
```

---

## Phase 7: Data Migration & Testing

**Goal:** Migrate existing data and validate the complete system.

### SQL Migration Scripts

```
Migration steps:
1. Export GachaVerse PostgreSQL data
2. Transform and map IDs to Decatron schema
3. Map 4 users by twitch_id to Decatron accounts
4. Import items with new IDs
5. Import inventory with remapped item/participant IDs
6. Import pull history
7. Import restrictions and preferences
8. Validate row counts and data integrity
```

### Testing Plan

| Test Type | Scope | Description |
|-----------|-------|-------------|
| Unit Tests | GachaService | Probability calculation, restriction checking, preference resolution |
| Unit Tests | Commands | Command parsing, permission checks, response formatting |
| Integration Tests | API | Full endpoint testing with auth, validation, CRUD operations |
| Integration Tests | Pull Flow | End-to-end pull execution from command to inventory update |
| Overlay Tests | Visual | Manual testing with OBS Browser Source |
| Migration Tests | Data | Verify migrated data matches source |
| Load Tests | API | Concurrent pull requests, collection queries |

```
Tasks:
- [ ] Write data export script from GachaVerse PostgreSQL
- [ ] Write data transformation/mapping script
- [ ] Write data import script for Decatron
- [ ] Validate migrated data (counts, integrity, relationships)
- [ ] Write unit tests for GachaService
- [ ] Write unit tests for command handlers
- [ ] Write integration tests for API endpoints
- [ ] Manual overlay testing in OBS
- [ ] Regression testing of existing Decatron features
```

---

## Phase 8: Documentation & i18n

**Goal:** Complete documentation and internationalization for the gacha system.

### Documentation

- **Streamer Guide** — How to set up and configure gacha for your channel
  - Item creation and management
  - Restriction and preference configuration
  - Probability tuning
  - Banner creation
  - Overlay setup in OBS
- **Viewer Guide** — How to participate in gacha
  - Available commands
  - How to earn pulls
  - Collection viewing
  - Item renaming

### Internationalization

All user-facing text in three languages:
- **Spanish (ES)** — Primary language
- **English (EN)** — Secondary language
- **Portuguese (PT)** — Tertiary language

Coverage:
- Bot command responses
- UI text (dashboard, collection, profile)
- Overlay labels
- Error messages and notifications

See `10-I18N.md` for detailed i18n structure.

```
Tasks:
- [ ] Write streamer guide documentation
- [ ] Write viewer guide documentation
- [ ] Create i18n keys for all bot responses (ES/EN/PT)
- [ ] Create i18n keys for all UI text (ES/EN/PT)
- [ ] Create i18n keys for overlay labels (ES/EN/PT)
- [ ] Integrate with Decatron MessagesService
- [ ] Integrate with React i18n infrastructure
- [ ] Review and test all translations
```

---

## Timeline Estimate

| Phase | Description | Estimated Effort |
|-------|-------------|-----------------|
| Phase 1 | Database & Models | 2-3 days |
| Phase 2 | Core Service | 3-4 days |
| Phase 3 | API Endpoints | 2-3 days |
| Phase 4 | Chat Commands | 2 days |
| Phase 5 | Frontend (React) | 4-5 days |
| Phase 6 | Overlay | 3-4 days |
| Phase 7 | Data Migration & Testing | 2-3 days |
| Phase 8 | Documentation & i18n | 2-3 days |
| **Total** | | **~20-25 days** |

---

## Dependencies

- Decatron authentication system (exists)
- Decatron permission system (exists)
- Decatron command system (exists)
- Decatron overlay system with SignalR (exists)
- Decatron i18n system (exists)
- DecaCoins system (exists, see `08-INTEGRATION.md` for integration details)
- PayPal tips system (exists, see `08-INTEGRATION.md` for integration details)
