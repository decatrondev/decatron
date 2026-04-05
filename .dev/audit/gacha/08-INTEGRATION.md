# 08 - Integration: GachaVerse with Decatron Systems

**Created:** 2026-04-04
**Project:** GachaVerse Migration
**Purpose:** Define how the gacha module integrates with existing Decatron subsystems

---

## Overview

The migrated gacha system does not exist in isolation. It integrates deeply with several existing Decatron systems to provide a seamless experience. This document defines each integration point, its behavior, and configuration options.

---

## DecaCoins Integration

### Concept

DecaCoins can be used as an alternative pull currency, allowing viewers to spend their earned coins on gacha pulls instead of (or in addition to) USD donations.

### Configuration (Per Streamer)

| Setting | Options | Description |
|---------|---------|-------------|
| `PullCurrency` | `USD`, `DecaCoins`, `Both` | Which currency is accepted for pulls |
| `CoinExchangeRate` | Integer (default: 100) | How many DecaCoins equal 1 pull |
| `AllowMixedPayment` | Boolean (default: false) | Allow combining USD + coins in `Both` mode |

### Pull Flow with DecaCoins

```
1. Viewer executes !gtirar
2. System checks PullCurrency setting for channel
3. If DecaCoins enabled:
   a. Check viewer's coin balance via DecaCoins service
   b. If balance >= CoinExchangeRate:
      - Deduct CoinExchangeRate from viewer's balance
      - Add 1 available pull to participant
      - Execute pull
   c. If insufficient balance:
      - Return localized "insufficient coins" message
4. If USD mode: standard donation-based pull flow
5. If Both mode: check available pulls first, then offer coin purchase
```

### Technical Details

- Use existing `IDecaCoinsService` for balance checks and deductions
- Transaction must be atomic: coin deduction + pull execution in same DB transaction
- If pull fails after coin deduction, coins must be refunded
- Coin transactions logged in DecaCoins history with `gacha_pull` category

---

## Tips/PayPal Integration

### Concept

Decatron already has a PayPal tips system per streamer. When a viewer sends a tip, the donation amount is automatically converted to gacha pulls.

### Flow

```
1. Viewer sends PayPal tip to streamer via Decatron
2. PayPal webhook fires → Decatron processes tip
3. Gacha integration hook activates:
   a. Look up or create GachaParticipant for viewer + channel
   b. Calculate pulls: floor(tipAmount / pullCostUSD)
   c. Add calculated pulls to participant's AvailablePulls
   d. Update participant's TotalDonated
4. Viewer receives confirmation in chat (if online)
5. Pulls are immediately available
```

### Configuration (Per Streamer)

| Setting | Description | Default |
|---------|-------------|---------|
| `PullCostUSD` | USD amount per pull | 1.00 |
| `AutoConvertTips` | Automatically convert tips to pulls | true |
| `MinTipForPulls` | Minimum tip to trigger conversion | 0.00 |
| `BonusPullThreshold` | Tip amount to get bonus pulls | null |
| `BonusPullCount` | Extra pulls when threshold met | 0 |

### Technical Details

- Hook into existing tip webhook processing pipeline
- Create or update `GachaParticipant` record on tip receipt
- Tip-to-pull conversion is real-time (no delay)
- Support fractional accumulation: if a pull costs $2 and viewer tips $3, they get 1 pull and $1 carries over to `PendingDonation` field
- All conversions logged for audit trail

---

## Multi-Channel Support

### Architecture

The gacha system is fully scoped per channel (streamer). Every data entity includes a `ChannelName` field that isolates data between streamers.

### Scoping Rules

| Entity | Scope | Description |
|--------|-------|-------------|
| Items | Per channel | Each streamer defines their own item pool |
| Probabilities | Per channel | Each streamer configures their own rarity rates |
| Restrictions | Per channel (per item) | Restrictions are tied to items, which are per channel |
| Preferences | Per channel | User and global preferences scoped to channel |
| Participants | Per channel per viewer | A viewer has separate participation in each channel |
| Inventory | Per channel per viewer | Collections are independent per channel |
| Banners | Per channel | Each streamer manages their own banners |
| Overlay Config | Per channel | Each streamer customizes their overlay |

### Viewer Experience

- A viewer participating in multiple channels has completely independent inventories
- Pull counts, donations, and stats are tracked separately per channel
- Collection pages show items for a specific channel
- Commands always operate in the context of the current channel

### Streamer Experience

- Full control over their own gacha configuration
- Cannot see or modify other streamers' configurations
- Dashboard shows only their channel's data
- Overlay URL is unique per channel: `/overlays/gacha/:channel`

---

## Alias System

### Concept

Each streamer can define custom aliases for gacha commands, allowing them to match their community's language or preferences.

### Default Commands and Aliases

| Default Command | Description | Example Aliases |
|----------------|-------------|-----------------|
| `!gtirar` | Pull a card | `!pull`, `!gacha`, `!tirar` |
| `!gtiros` | Check pulls/stats | `!pulls`, `!mypulls`, `!tiros` |
| `!gcoleccion` | Collection link | `!inv`, `!collection`, `!col` |
| `!grenombrar` | Rename item | `!rename`, `!rn` |
| `!gpausa` | Pause gacha | `!gpause`, `!pause` |
| `!greanudar` | Resume gacha | `!gresume`, `!resume` |

### Configuration

- Aliases are stored in the command configuration per channel
- Each streamer can add, remove, or modify aliases via the admin panel
- Default commands always work (cannot be removed)
- Aliases follow the same permission and cooldown rules as the base command
- No alias conflicts: system prevents creating an alias that conflicts with existing commands

### Storage

```
CommandAlias {
    Id: int
    ChannelName: string
    BaseCommand: string       // e.g., "!gtirar"
    Alias: string             // e.g., "!pull"
    IsActive: bool
}
```

### Resolution Flow

```
1. Bot receives message starting with "!"
2. Check if command matches a base gacha command → execute
3. Check if command matches an alias for the current channel → resolve to base command → execute
4. If no match → pass to other command handlers
```

---

## Existing Decatron Systems

### Authentication (Twitch OAuth)

The gacha module uses Decatron's existing Twitch OAuth authentication. No separate login system is needed.

- **Viewers** are identified by their Twitch ID (from chat messages or OAuth login)
- **Streamers** authenticate via Twitch OAuth to access the admin panel
- **API requests** require valid authentication tokens
- **Bot commands** identify users by Twitch username/ID from IRC messages

### Permission System (RequirePermission)

All API endpoints and admin actions use Decatron's `RequirePermission` attribute.

| Permission Level | Access |
|-----------------|--------|
| Viewer | Pull, view own collection, set preferences |
| Moderator | View all collections, manage participants |
| Streamer/Admin | Full CRUD on items, restrictions, probabilities, banners, overlay config |

### Overlay Infrastructure (SignalR)

The gacha overlay integrates with Decatron's existing overlay system.

- **Hub:** New `GachaHub` registered alongside existing overlay hubs
- **Route:** `/overlays/gacha/:channel` follows existing overlay URL pattern
- **Transport:** SignalR WebSocket (same as other Decatron overlays)
- **Events:** Pull result events pushed to connected overlay clients in real-time
- **OBS Integration:** Same Browser Source setup as other Decatron overlays

### Command System

Gacha commands register through Decatron's existing bot command infrastructure.

- Commands registered at startup via command module system
- Cooldown management handled by existing cooldown middleware
- Permission checks use existing command permission system
- Response formatting uses existing message templating

### i18n System (MessagesService)

All user-facing text uses Decatron's `MessagesService` for translations.

- Language detection follows per-channel setting (same as rest of Decatron)
- Translation keys namespaced under `gacha_cmd` for bot responses
- React i18n uses existing translation infrastructure for UI text
- See `10-I18N.md` for complete i18n structure

---

## Integration Diagram

```
                    +------------------+
                    |   Twitch Chat    |
                    +--------+---------+
                             |
                    +--------v---------+
                    | Decatron Command  |
                    |    System         |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v----------+       +----------v---------+
    |  GachaCommandModule |       |   Other Commands   |
    +---------+----------+       +--------------------+
              |
    +---------v----------+
    |    GachaService     |<-------- DecaCoins Service
    |  (Core Logic)       |<-------- Tips/PayPal Hook
    +---------+----------+
              |
    +---------v----------+       +--------------------+
    |  Database (EF Core) |       |    SignalR Hub     |
    |  (Per-channel data) |       |   (GachaHub)       |
    +--------------------+       +---------+----------+
                                           |
                                 +---------v----------+
                                 |   Overlay Client    |
                                 |  (/overlays/gacha/) |
                                 +--------------------+

    +--------------------+       +--------------------+
    |  React Admin Panel  |       |  Collection Viewer  |
    |  (GachaConfig page) |       |  (Public page)      |
    +---------+----------+       +---------+----------+
              |                             |
              +-------------+---------------+
                            |
                  +---------v----------+
                  |   GachaController   |
                  |   (REST API)        |
                  +--------------------+
```

---

## Summary

The gacha module is designed as a first-class citizen within Decatron, leveraging every existing system rather than reimplementing functionality. This approach ensures:

- **Consistent security** across all features
- **Unified user experience** (single login, single dashboard)
- **Reduced maintenance** (shared infrastructure)
- **Faster development** (reuse existing components)
- **Multi-channel by default** (same architecture as other Decatron features)
