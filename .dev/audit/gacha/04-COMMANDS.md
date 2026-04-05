# GachaVerse Commands Audit

## Overview

This document covers the complete command system: architecture, permission model, cooldown mechanics, and every command's behavior. This is essential for reproducing the chat interaction layer in Decatron.

---

## Command System Architecture

### Loading Mechanism

`commandHandler.js` dynamically loads command modules from the `/commands/` directory at startup:

1. Scan `/commands/` for `.js` files.
2. Require each module.
3. Register command name, aliases, and handler function.
4. Sync with `command_configs` database table for per-streamer enable/disable and cooldown settings.

### Runtime Flow

1. Incoming chat message arrives via tmi.js.
2. `commandHandler` checks if message starts with command prefix.
3. Look up command in registry.
4. Validate permission level.
5. Check global and user cooldowns.
6. Execute handler function.
7. Set cooldowns.

---

## Permission Hierarchy

| Level | Role | Description |
|-------|------|-------------|
| 0 | Viewer | Default, anyone in chat |
| 1 | Follower | Following the channel |
| 2 | Subscriber | Active subscription |
| 3 | VIP | Channel VIP badge |
| 4 | Moderator | Channel moderator |
| 5 | Broadcaster | Channel owner |

Permission checks use `>=` comparison: a command requiring level 2 can be executed by subscribers, VIPs, moderators, and the broadcaster.

---

## Cooldown System

Two independent cooldown layers, both tracked in **in-memory Maps** (not persisted):

### Global Cooldown

- Per command, shared across all users.
- Key: `${commandName}_${channelName}`
- If the global cooldown hasn't expired, the command is rejected for everyone.

### User Cooldown

- Per user, per command.
- Key: `${commandName}_${channelName}_${username}`
- If the user's personal cooldown hasn't expired, only that user is rejected.

Both cooldown values are configurable per streamer via the `command_configs` table.

---

## Commands

### 1. !tirar [user] [qty]

**Purpose**: Core gacha pull command.

| Attribute | Value |
|-----------|-------|
| Default permission | Viewer (0) |
| Arguments | Optional: target username, optional: quantity (1-10) |

**Behavior**:

- No arguments: Pull 1 time for the sender.
- `!tirar 3`: Pull 3 times for the sender.
- `!tirar @username`: Pull 1 time for the specified user (mod/broadcaster only).
- `!tirar @username 5`: Pull 5 times for the specified user (mod/broadcaster only).

**Constraints**:

- Maximum 10 pulls per command invocation.
- Anti-duplicate: 3-second cooldown per `userId_channelName` key in the `executingPulls` Map.
- Requires `effective_donation >= quantity` for the participant.

**Multi-Pull Behavior**:

- For qty > 1, pulls execute sequentially with a **12-second delay** between each.
- State tracked in an in-memory Map per channel.
- Only one multi-pull sequence can be active per channel.
- Each pull emits a separate Socket.IO event for the overlay animation.
- After all pulls complete, a summary message is sent to chat.

---

### 2. !tiros [user]

**Purpose**: Check available pulls for a participant.

| Attribute | Value |
|-----------|-------|
| Default permission | Viewer (0) |
| Arguments | Optional: target username |

**Behavior**:

- No arguments: Show sender's pull info.
- `!tiros @username`: Show specified user's pull info.

**Response format**: Displays available pulls (effective_donation), total donated (donation_amount), and total pulls used.

---

### 3. !coleccion [user]

**Purpose**: Provide a link to the viewer's web collection page.

| Attribute | Value |
|-----------|-------|
| Default permission | Viewer (0) |
| Arguments | Optional: target username |

**Behavior**:

- Generates a URL to the collection page for the specified participant.
- Includes item count, rarity breakdown, and completion percentage in the chat message.

---

### 4. !renombrar [newname] or [old] [new]

**Purpose**: Rename a participant's display name.

| Attribute | Value |
|-----------|-------|
| Default permission | Viewer (0) for self, Moderator (4) for others |
| Arguments | 1 arg: new name for self. 2 args: old name, new name (admin). |

**Behavior**:

- Single argument: Rename the sender's own participant record.
- Two arguments: Rename another participant (requires moderator+).

**Constraints**:

- **24-hour cooldown** between renames (tracked in `rename_cooldowns` table).
- Admins (broadcaster) bypass the cooldown.
- Records the rename in `rename_cooldowns` for audit trail.

---

### 5. !pausa

**Purpose**: Pause an active multi-pull sequence.

| Attribute | Value |
|-----------|-------|
| Default permission | Broadcaster (5) |
| Arguments | None |

**Behavior**:

- Sets the multi-pull state to paused for the current channel.
- Remaining pulls are held in memory.
- Chat receives confirmation message.
- No effect if no multi-pull is active.

---

### 6. !reanudar

**Purpose**: Resume a paused multi-pull sequence.

| Attribute | Value |
|-----------|-------|
| Default permission | Broadcaster (5) |
| Arguments | None |

**Behavior**:

- Resumes the paused multi-pull, continuing from where it left off.
- Remaining pulls execute with the standard 12-second delay.
- No effect if no multi-pull is paused.

---

### 7. !test

**Purpose**: Debug command that emits a test card to the overlay.

| Attribute | Value |
|-----------|-------|
| Default permission | Broadcaster (5) |
| Arguments | None |

**Behavior**:

- Emits a Socket.IO event with a sample item card to the overlay room.
- Used for testing overlay positioning, animation, and connectivity.
- Does not affect any database state.

---

## Migration Plan

### Command Prefix Change

All GachaVerse commands will be migrated with a `!g` prefix to avoid conflicts with existing Decatron commands:

| Current | Migrated |
|---------|----------|
| !tirar | !gtirar |
| !tiros | !gtiros |
| !coleccion | !gcoleccion |
| !renombrar | !grenombrar |
| !pausa | !gpausa |
| !reanudar | !greanudar |

The `!test` command will likely become a dashboard-only action rather than a chat command.

### Alias System

Each streamer can configure custom aliases for any command:

- Stored in `command_configs` table.
- Multiple aliases per command supported.
- Aliases follow the same permission and cooldown rules.
- Migration should preserve existing alias configurations.

### Internationalization (i18n)

Chat responses need multi-language support:

| Language | Code | Priority |
|----------|------|----------|
| Spanish | ES | Primary (current default) |
| English | EN | Required |
| Portuguese | PT | Required |

Response templates should be extracted into a localization system. Language selection can be per-streamer or per-viewer preference.

---

## Integration with Decatron Bot

### Current (GachaVerse)

- Standalone tmi.js client.
- Separate connection per streamer.
- Independent from any other bot functionality.

### Target (Decatron)

- Commands register into existing Decatron command handler.
- Share the existing bot connection (no separate tmi.js instance).
- Follow Decatron's command registration patterns.
- Cooldowns managed by Decatron's cooldown system.
- Permissions mapped to Decatron's permission model.
