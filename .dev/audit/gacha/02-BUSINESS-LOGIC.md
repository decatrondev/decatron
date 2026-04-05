# GachaVerse Business Logic Audit

## Overview

This document captures every business rule, algorithm, and behavioral constraint in the GachaVerse system. Accurate reproduction of this logic is critical for migration.

---

## Probability System

### Default Rarity Distribution

| Rarity | Default Probability |
|--------|-------------------|
| Common | 50% |
| Uncommon | 25% |
| Rare | 15% |
| Epic | 7% |
| Legendary | 3% |

### Configuration

- Probabilities are stored in the `rarity_probabilities` table.
- Each streamer (`user_id`) can customize their own distribution.
- If no custom config exists, defaults above are used.

### Selection Algorithm

The system does **NOT** use a two-step rarity-then-item selection. Instead, it performs **direct weighted selection** across all eligible items:

1. **Load all available items** for the streamer.
2. **Assign probability** to each item based on its rarity (or overridden preference).
3. **Normalize**: Sum all probabilities, divide each item's probability by the total. This ensures the distribution always sums to 1.0 regardless of how many items exist per rarity.
4. **Cumulative distribution**: Build a running sum array.
5. **Select**: Generate `Math.random()`, find the first item whose cumulative value exceeds the random number.

This means adding more items of a rarity dilutes individual drop rates within that rarity, while the overall rarity distribution is maintained through normalization.

---

## Restriction System

### Item-Level Restrictions (4 types)

Each item can have zero or more restrictions configured via the `item_restrictions` table:

#### 1. Minimum Donation Required

- Field: `min_donation_required`
- Rule: If `participant.effective_donation < min_donation_required`, the item is excluded from the pool.
- Effect: Item becomes invisible to viewers who haven't donated enough.

#### 2. Total Quantity Limit

- Field: `total_quantity`
- Rule: Global pool counter. Each time the item is won, the counter decrements.
- When `total_quantity` reaches 0, the item is removed from the pool entirely.
- Applies across ALL viewers, not per-viewer.

#### 3. Unique Flag

- Field: `is_unique`
- Rule: A viewer can only win this item once.
- Checked against `user_items` table for existing ownership.
- Other viewers can still win it (unless total_quantity is also exhausted).

#### 4. Cooldown

- Field: `cooldown_period` (unit) + `cooldown_value` (amount)
- Units: minutes, hours, days, months
- Rule: After winning the item, the viewer cannot win it again until the cooldown expires.
- Checked against `user_items.last_won_at`.

### Rarity-Level Restrictions

Stored in `item_rarity_restrictions` table:

#### Pull Interval

- Rule: Minimum X pulls must occur between winning items of the same rarity.
- Tracked per participant per rarity.

#### Time Interval

- Rule: Minimum X time must pass between winning items of the same rarity.
- Uses same unit system as item cooldowns.

---

## Preference System

Preferences allow overriding the base probability of specific items for specific viewers or globally.

### Priority Hierarchy

```
User Preference > Global Preference > Base Rarity Probability
```

1. **User preference** (`user_item_preferences`): Per-viewer, per-item probability override.
2. **Global preference** (`item_global_preferences`): Per-item probability override for all viewers.
3. **Base rarity**: Default probability from `rarity_probabilities` table.

### Application Rules

- Preferences only apply if the item has a restriction configured AND the viewer meets the minimum donation requirement.
- Preference values **override** (replace) the base probability -- they are NOT additive.
- If `is_active = false`, the preference is ignored.

---

## Pull Flow (End to End)

### Step 1: Chat Command

Viewer types `!tirar [user] [qty]` in Twitch chat.

### Step 2: Argument Parsing and Validation

- Parse target user and quantity from message.
- If no target specified, pull is for the message sender.
- If target specified, verify the sender is a moderator or broadcaster (permission level >= 4).
- Quantity validation: minimum 1, maximum 10.

### Step 3: Donation Check

- Load participant record from `participants` table.
- Verify `effective_donation >= quantity_requested`.
- If insufficient, send error message to chat.

### Step 4: Per-Pull Execution (repeated for each unit in quantity)

1. **Load items**: Fetch all available items for the streamer.
2. **Calculate probabilities**: Assign base probability from rarity config.
3. **Apply preferences**: Override probabilities where user/global preferences exist.
4. **Apply restrictions**: Filter out items that fail any restriction check.
5. **Normalize**: Recalculate distribution after filtering.
6. **Select**: Weighted random selection from remaining pool.

### Step 5: Database Updates (per pull)

- `participants.effective_donation -= 1`
- `participants.pulls += 1`
- Insert into `user_items` (or update quantity if duplicate)
- Decrement `item_restrictions.total_quantity` if applicable
- Update `user_items.last_won_at`

### Step 6: Overlay Notification

- Emit Socket.IO event to `user_${userId}` room.
- Event contains item data, rarity, animation type.

### Step 7: Multi-Pull Orchestration

- For quantities > 1, a **12-second delay** is enforced between each pull.
- Pull state is tracked in an **in-memory Map** (not persisted to DB).
- Broadcaster can `!pausa` (pause) and `!reanudar` (resume) the sequence.
- If paused, the remaining pulls are held until resumed or timeout.

### Step 8: Summary

- After all pulls in a batch complete, a summary message is sent to chat.
- Lists all items won with their rarities.

---

## Donation System

- Unit conversion: **1 donation unit = 1 pull**.
- When a donation is recorded:
  - `participants.donation_amount` increases (lifetime total, never decreases).
  - `participants.effective_donation` increases (spendable balance).
- When a pull occurs:
  - `participants.effective_donation` decreases by 1.
  - `participants.donation_amount` is unchanged.

---

## Pity System

**There is NO pity system.** There are no guaranteed drops after X pulls, no increasing probability over time, and no bad luck protection. Every pull is fully independent.

---

## Inventory

- Stored in `user_items` table.
- Supports **duplicate items** -- quantity field tracks multiples.
- Items can have a `redeemable` flag for streamer-defined redemption mechanics.
- Inventory is per-participant (viewer) per-streamer.

---

## Anti-Abuse Mechanisms

### Duplicate Pull Prevention

- An `executingPulls` Map tracks active pull operations.
- Key: `${userId}_${channelName}`
- **3-second cooldown** per user per channel.
- If a pull is already executing for that key, subsequent requests are rejected.

### Multi-Pull State

- In-memory Map prevents overlapping multi-pull sequences.
- Only one multi-pull can be active per channel at a time.

### Permission Enforcement

- Only moderators (level 4) and broadcasters (level 5) can pull for other users.
- Only broadcasters can pause/resume multi-pulls.

---

## Migration Considerations

| Aspect | Risk | Notes |
|--------|------|-------|
| Probability algorithm | High | Must be reproduced exactly to maintain fairness expectations |
| Restriction filtering | High | Complex interaction between 4 restriction types + rarity restrictions |
| Preference priority | Medium | Three-level override system must be preserved |
| Multi-pull state | Medium | Currently in-memory; Decatron should persist or use distributed state |
| Anti-duplicate | Low | Simple cooldown, easy to replicate |
| 12s delay | Medium | Timing affects overlay animation sequence |
| No pity system | Low | Absence of a feature, but document for future consideration |
