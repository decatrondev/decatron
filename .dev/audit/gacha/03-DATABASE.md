# GachaVerse Database Audit

## Overview

This document captures the complete database schema, relationships, and migration strategy for moving GachaVerse data into the Decatron platform.

---

## Current Schema (PostgreSQL Version)

The database contains 12+ tables. All tables use `user_id` as the streamer identifier (not the viewer).

---

### users

Primary user table for streamers.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | SERIAL | PK | Auto-increment |
| username | VARCHAR | NOT NULL | Display name |
| email | VARCHAR | UNIQUE | Login identifier |
| password | VARCHAR | NOT NULL | bcrypt hashed |
| twitch_id | VARCHAR | UNIQUE, NULLABLE | Twitch user ID |
| twitch_username | VARCHAR | NULLABLE | Twitch display name |
| is_twitch_connected | BOOLEAN | DEFAULT false | OAuth status |
| tokens | INTEGER | DEFAULT 0 | App tokens balance |
| avatar_url | VARCHAR | NULLABLE | Profile image path |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

---

### chat_connections

Tracks which Twitch channels the bot is connected to.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| user_id | INTEGER | FK → users.id | Streamer |
| twitch_username | VARCHAR | NOT NULL | Channel name |
| is_connected | BOOLEAN | DEFAULT false | Current status |
| auto_reconnect | BOOLEAN | DEFAULT true | Reconnect on restart |

---

### bot_tokens

OAuth tokens for bot accounts.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| bot_username | VARCHAR | NOT NULL | Bot account name |
| bot_twitch_id | VARCHAR | NOT NULL | Bot Twitch ID |
| access_token | VARCHAR | NOT NULL | OAuth access token |
| refresh_token | VARCHAR | NOT NULL | OAuth refresh token |
| chat_token | VARCHAR | NULLABLE | Separate chat auth token |

---

### rarity_probabilities

Per-streamer rarity probability configuration.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| user_id | INTEGER | FK → users.id | Streamer |
| rarity | VARCHAR | NOT NULL | common/uncommon/rare/epic/legendary |
| probability | DECIMAL | NOT NULL | Percentage (e.g., 50.0) |

---

### items

Gacha items owned by streamers.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | SERIAL | PK | |
| user_id | INTEGER | FK → users.id | Streamer who created the item |
| name | VARCHAR | NOT NULL | Item display name |
| rarity | VARCHAR | NOT NULL | common/uncommon/rare/epic/legendary |
| image | VARCHAR | NULLABLE | Path to image file |
| available | BOOLEAN | DEFAULT true | Whether item is in the pool |

---

### item_restrictions

Per-item restriction rules.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | SERIAL | PK | |
| user_id | INTEGER | FK → users.id | Streamer |
| item_id | INTEGER | FK → items.id | Target item |
| min_donation_required | INTEGER | DEFAULT 0 | Minimum donation to be eligible |
| total_quantity | INTEGER | NULLABLE | Global pool limit (NULL = unlimited) |
| is_unique | BOOLEAN | DEFAULT false | One-per-viewer flag |
| cooldown_period | VARCHAR | NULLABLE | Unit: minutes/hours/days/months |
| cooldown_value | INTEGER | NULLABLE | Amount of cooldown_period |

---

### participants

Viewers who participate in a streamer's gacha. This is the core viewer-per-streamer record.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | SERIAL | PK | |
| user_id | INTEGER | FK → users.id | Streamer |
| name | VARCHAR | NOT NULL | Viewer's Twitch username |
| effective_donation | INTEGER | DEFAULT 0 | Spendable pulls remaining |
| pulls | INTEGER | DEFAULT 0 | Total pulls used |

**UNIQUE constraint**: `(user_id, name)` — one participant record per viewer per streamer.

---

### user_items

Inventory of items won by participants.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | SERIAL | PK | |
| user_id | INTEGER | FK → users.id | Streamer |
| item_id | INTEGER | FK → items.id | Won item |
| participant_id | INTEGER | FK → participants.id | Viewer who won it |
| quantity | INTEGER | DEFAULT 1 | Number of copies owned |
| last_won_at | TIMESTAMP | DEFAULT NOW() | Used for cooldown checks |

---

### user_item_preferences

Per-viewer probability overrides for specific items.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | SERIAL | PK | |
| user_id | INTEGER | FK → users.id | Streamer |
| participant_id | INTEGER | FK → participants.id | Target viewer |
| item_id | INTEGER | FK → items.id | Target item |
| probability_percentage | DECIMAL | NOT NULL | Override probability |
| is_active | BOOLEAN | DEFAULT true | Enable/disable |

---

### item_global_preferences

Global (all viewers) probability overrides for specific items.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | SERIAL | PK | |
| user_id | INTEGER | FK → users.id | Streamer |
| item_id | INTEGER | FK → items.id | Target item |
| probability_percentage | DECIMAL | NOT NULL | Override probability |
| is_active | BOOLEAN | DEFAULT true | Enable/disable |

---

### item_rarity_restrictions

Rarity-level pull/time restrictions.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | SERIAL | PK | |
| user_id | INTEGER | FK → users.id | Streamer |
| item_id | INTEGER | NULLABLE | Specific item or NULL for all |
| participant_id | INTEGER | FK → participants.id, NULLABLE | Specific viewer or NULL for all |
| rarity | VARCHAR | NOT NULL | Target rarity |
| max_per_session | INTEGER | NULLABLE | Pull interval between same rarity |
| is_active | BOOLEAN | DEFAULT true | Enable/disable |

---

### user_banners

Custom banner images for the gacha page.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | SERIAL | PK | |
| user_id | INTEGER | FK → users.id | Streamer |
| banner_url | VARCHAR | NOT NULL | Path to banner image |
| is_active | BOOLEAN | DEFAULT false | Currently displayed |

---

### rename_cooldowns

Tracks participant name changes for cooldown enforcement.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | SERIAL | PK | |
| user_id | INTEGER | FK → users.id | Streamer context |
| old_name | VARCHAR | NOT NULL | Previous name |
| new_name | VARCHAR | NOT NULL | New name |
| changed_by_twitch_id | VARCHAR | NOT NULL | Who initiated the rename |
| created_at | TIMESTAMP | DEFAULT NOW() | For 24h cooldown check |

---

### admin_whitelist

Global admin access control.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| twitch_id | VARCHAR | PK | Whitelisted Twitch user ID |

---

## Key Relationships

```
users (streamer)
  |-- chat_connections (1:1)
  |-- rarity_probabilities (1:many, one per rarity)
  |-- items (1:many)
  |     |-- item_restrictions (1:1 per item)
  |     |-- user_item_preferences (many, per viewer per item)
  |     |-- item_global_preferences (1:1 per item)
  |-- participants (1:many, one per viewer)
  |     |-- user_items (1:many)
  |     |-- user_item_preferences (1:many)
  |     |-- item_rarity_restrictions (optional)
  |-- user_banners (1:many)
  |-- rename_cooldowns (1:many)
```

The `user_id` foreign key on nearly every table always refers to the **streamer**, not the viewer. Viewers are identified through the `participants` table.

---

## Migration Mapping to Decatron EF Core

### Entity Mapping

| GachaVerse Table | Decatron Model | Strategy |
|-----------------|----------------|----------|
| users | Users (existing) | Map by `twitch_id`. GachaVerse-only users need account merge or creation. |
| participants | GachaParticipant (new) | Link to Decatron user + channel. Viewer identity via Twitch username. |
| items | GachaItem (new) | New entity under streamer's channel. |
| item_restrictions | GachaItemRestriction (new) | Child of GachaItem. |
| user_items | GachaInventory (new) | Links GachaParticipant to GachaItem with quantity. |
| rarity_probabilities | GachaRarityConfig (new) | Per-channel configuration. |
| user_item_preferences | GachaItemPreference (new) | Per-participant preference override. |
| item_global_preferences | GachaGlobalPreference (new) | Per-item global override. |
| item_rarity_restrictions | GachaRarityRestriction (new) | Rarity-level restrictions. |
| user_banners | GachaBanner (new) | Banner images per channel. |
| rename_cooldowns | GachaRenameCooldown (new) | Rename history and cooldown tracking. |
| chat_connections | Existing Decatron channel system | Merge into existing bot connection management. |
| bot_tokens | Existing Decatron token system | Already handled by Decatron. |
| admin_whitelist | Existing Decatron admin system | Already handled by Decatron roles. |

---

## Data Migration Strategy

### Phase 1: Schema Creation

Create EF Core migrations for all new Gacha entities in the Decatron DbContext.

### Phase 2: Data Extraction

SQL scripts to export from GachaVerse PostgreSQL:

```sql
-- Example: Extract participants with streamer mapping
SELECT p.*, u.twitch_id as streamer_twitch_id
FROM participants p
JOIN users u ON p.user_id = u.id
WHERE u.twitch_id IS NOT NULL;
```

### Phase 3: Transform and Insert

- Map GachaVerse `user_id` to Decatron `UserId` via `twitch_id` lookup.
- Convert participant names to Decatron viewer identifiers.
- Preserve all inventory records and timestamps.
- Migrate file paths (images, banners, avatars) to Decatron storage structure.

### Phase 4: Validation

- Row count comparison per table.
- Spot-check inventory totals for sample participants.
- Verify restriction configs transferred correctly.
- Test probability calculations produce same results.

---

## Recommended Indexes

| Table | Columns | Reason |
|-------|---------|--------|
| participants | (user_id, name) | UNIQUE, primary lookup pattern |
| user_items | (user_id, participant_id, item_id) | Inventory lookups and duplicate checks |
| user_items | (participant_id, last_won_at) | Cooldown checks |
| items | (user_id, available) | Pool loading |
| item_restrictions | (item_id) | Restriction lookup per pull |
| user_item_preferences | (user_id, participant_id, is_active) | Preference loading |
| item_global_preferences | (user_id, is_active) | Global preference loading |
| rarity_probabilities | (user_id) | Probability config lookup |
