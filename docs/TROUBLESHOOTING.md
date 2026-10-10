# Troubleshooting Guide

> Español: [es/TROUBLESHOOTING.md](es/TROUBLESHOOTING.md)

Practical guide to diagnose and solve the most common problems in Decatron. Paths assume the project is in `/var/www/html/decatron/Decatron/decatron`; adjust them if yours is elsewhere.

---

## Table of Contents

1. [How to Check Logs](#how-to-check-logs)
2. [How to Restart Services](#how-to-restart-services)
3. [502 Bad Gateway](#502-bad-gateway)
4. [Bot Not Connecting to Twitch Chat](#bot-not-connecting-to-twitch-chat)
5. [No Twitch Events Arriving (EventSub)](#no-twitch-events-arriving-eventsub)
6. [Overlays Not Updating (SignalR)](#overlays-not-updating-signalr)
7. [Token Expiration Issues](#token-expiration-issues)
8. [Database Connection Errors](#database-connection-errors)
9. [PayPal and Tips Issues](#paypal-and-tips-issues)
10. [Spotify and Now Playing Issues](#spotify-and-now-playing-issues)
11. [AI Issues](#ai-issues)
12. [TTS Issues](#tts-issues)
13. [Login and Authentication Issues](#login-and-authentication-issues)
14. [Quick Command Reference](#quick-command-reference)

---

## How to Check Logs

### Log location

Logs are written to `/var/www/html/decatron/Decatron/decatron/logs/`:

```bash
# List the available log files
ls -la /var/www/html/decatron/Decatron/decatron/logs/

# Files are named decatron-YYYYMMDD.txt, for example decatron-20261010.txt
```

### Watch logs in real time

```bash
# Follow the current log
tail -f /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt

# Only errors
tail -f /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | grep -i "ERR\|error\|exception"

# A specific module
tail -f /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | grep -i "twitch\|bot"
```

### Console output

If the backend runs in a screen session, the same logs appear on the console:

```bash
screen -r decatron-api
# Logs appear as: [HH:mm:ss LEV] Message
# Ctrl+A, D to leave without stopping it
```

### Log configuration

Logging is configured in `appsettings.json`:

- **Rotation:** one file per day
- **Maximum size:** 50 MB per file (a new file starts when it is reached)
- **Retention:** 14 files
- **Format:** `[2026-10-10 14:30:00 INF] Message`

To get more detail temporarily:

```json
{
    "Serilog": {
        "MinimumLevel": {
            "Default": "Debug"
        }
    }
}
```

Restart the backend after changing the logging configuration. Put the override in `appsettings.Secrets.json` (or an environment file) rather than editing the committed `appsettings.json`.

---

## How to Restart Services

### Restart the backend

```bash
# 1. Reattach to the screen session
screen -r decatron-api

# 2. Stop the current process: Ctrl+C

# 3. Start it again
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"

# 4. Detach: Ctrl+A, then D
```

### Frontend

The frontend is a static build served by nginx: there is no process to restart. After changing it, rebuild:

```bash
cd /var/www/html/decatron/Decatron/decatron/ClientApp
npm run build
```

### Restart nginx

```bash
sudo systemctl reload nginx    # reload the configuration without stopping
sudo systemctl restart nginx   # full restart
```

### Restart PostgreSQL

```bash
sudo systemctl restart postgresql
```

### If the screen session was lost

```bash
# Check for existing sessions
screen -ls

# If there are none, create a new one:
screen -S decatron-api
# Start the backend...
# Ctrl+A, D
```

---

## 502 Bad Gateway

### Symptoms

- The browser shows nginx's "502 Bad Gateway"
- The page does not load at all, or the page loads but the API does not answer

### Causes and solutions

**1. The .NET backend is not running**

```bash
# Check whether the backend is listening on port 7264
ss -tlnp | grep 7264

# If nothing is listening, check the screen session
screen -r decatron-api

# If the session does not exist, start it again:
screen -S decatron-api
cd /var/www/html/decatron/Decatron/decatron
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"
```

**2. The frontend build is missing (blank page, 404 or 403 on `/`)**

```bash
# nginx serves ClientApp/dist; check that it exists
ls /var/www/html/decatron/Decatron/decatron/ClientApp/dist/index.html

# If it does not:
cd /var/www/html/decatron/Decatron/decatron/ClientApp
npm install && npm run build
```

**3. nginx is not running or has a configuration error**

```bash
sudo systemctl status nginx

# If there is a configuration error:
sudo nginx -t

# Fix it and reload:
sudo systemctl reload nginx
```

**4. The backend crashed with an unhandled exception**

```bash
# Look at the latest logs
tail -50 /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt

# Look for fatal errors
grep -i "fatal\|unhandled\|crash" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt
```

---

## Bot Not Connecting to Twitch Chat

### Symptoms

- The bot does not answer commands in chat
- There are no bot messages in the Twitch chat
- Errors in the logs such as "IRC disconnected" or token errors

### Causes and solutions

**1. Bot token expired or invalid**

```bash
# Look for token errors in the logs
grep -i "token\|refresh\|auth" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -20
```

`BotTokenRefreshBackgroundService` refreshes the bot tokens automatically every 30 minutes. If it fails, check the database:

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT bot_username, token_expiration, is_active FROM bot_tokens;"
```

If the tokens are expired and the refresh fails, the bot account must authorize again.

**2. Wrong Twitch credentials**

Check `appsettings.Secrets.json`:
- `TwitchSettings:ClientId` matches your app in the [Twitch Developer Console](https://dev.twitch.tv/console/apps)
- `TwitchSettings:ClientSecret` is the right one
- `TwitchSettings:BotUsername` is exactly the bot account name
- `TwitchSettings:ChannelId` is the correct numeric channel ID

**3. Missing scopes**

If the bot connects but cannot send messages, the scopes requested at login (`TwitchSettings:Scopes` in `appsettings.json`) must include at least `chat:read`, `chat:edit`, `channel:bot` and `user:write:chat`. After changing the scopes, the account must log in again.

**4. TwitchLib disconnects silently**

The bot uses TwitchLib for IRC. After a disconnect it retries a limited number of times (3), and it can fail when:
- Twitch is under maintenance
- The IRC rate limit is exceeded
- The server IP is temporarily banned by Twitch

Restart the backend. If it persists, wait 15-30 minutes and try again.

**5. The bot is started with `Task.Run` (no supervisor)**

The Twitch bot is launched with `Task.Run()` in `Program.cs`, not as a `BackgroundService`. If it stops, nothing restarts it automatically: restart the whole backend.

---

## No Twitch Events Arriving (EventSub)

### Symptoms

- Follows, subs, bits, raids, channel point redemptions or chat commands do not trigger anything
- The bot is in the channel but alerts and timers do not react

### Causes and solutions

EventSub works through a conduit with WebSocket shards (see [CONFIGURATION.md](CONFIGURATION.md#step-4-eventsub-conduit)). The old webhook transport is switched off, so a webhook problem is not the cause.

```bash
# Is the conduit created and are the shards connected?
grep -i "conduit" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -20
```

**1. The conduit could not be created.** A log line says the conduit could not be obtained or created and that the WebSocket transport does not start. Check `TwitchSettings:ClientId` and `ClientSecret`, then restart the backend.

**2. A shard is disconnected.** Lines such as "Shard N ... Desconectado" or "Reconectado por Twitch" show shard reconnections. Frequent disconnects usually mean network problems on the server.

**3. The shard count does not match.** `EventSubSettings:ShardCount` is applied to the existing conduit when the backend starts; if the log says it could not scale the conduit, the previous number of shards stays in use.

**4. The channel has no subscriptions.** Subscriptions are created when the streamer logs in and for all active users when the backend starts. Ask the streamer to log in again, or restart the backend with the bot enabled for that channel.

---

## Overlays Not Updating (SignalR)

### Symptoms

- The OBS overlay shows stale data
- The timer does not update in the overlay
- Shoutouts, tip alerts or event alerts do not appear

### Causes and solutions

**1. WebSocket connection lost**

nginx must forward WebSocket connections for `/hubs/`. The location needs these lines:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400;
```

Check your file:

```bash
grep -A12 "location /hubs" /etc/nginx/sites-enabled/your-domain.conf
```

**2. `proxy_read_timeout` is too low**

SignalR keeps connections open indefinitely. If `proxy_read_timeout` is below 86400 (24 hours), nginx closes the connection.

**3. The overlay did not join the right channel**

Overlay clients call `JoinChannel(channel)` to subscribe to the group `overlay_{channel}`. If the channel is wrong they receive no updates. Check that the overlay URL has the correct `?channel=` parameter (copy the URL from the module's page in the dashboard).

**4. The backend restarted and the connections were lost**

When the backend restarts, all SignalR connections close. Overlays reconnect automatically, but sometimes they do not: refresh the overlay source in OBS (right click, Refresh).

**5. The hub needs no authentication**

`OverlayHub` accepts any client, by design (OBS browser sources have no session). Many spurious connections can cause noise but not wrong data.

---

## Token Expiration Issues

### Symptoms

- Users are logged out frequently
- "401 Unauthorized" in the browser console
- "Token expired" in the logs

### Causes and solutions

**1. The dashboard JWT expired**

The JWT lasts `JwtSettings:ExpiryMinutes` minutes (60 in the example).

```bash
grep "ExpiryMinutes" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

Increase `ExpiryMinutes` if needed (for example to 120 or 240) and restart the backend.

**2. Twitch tokens expired**

Twitch access tokens last a few hours. Two background services refresh them: `UserTokenRefreshBackgroundService` (users, and Kick tokens too) and `BotTokenRefreshBackgroundService` (the bot), both every 30 minutes.

```bash
grep -i "token refresh\|TokenRefresh" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -10
```

If the refresh fails, the user must log in again from the dashboard.

**3. Spotify tokens expired**

```bash
grep -i "spotify" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | grep -i "error\|fail\|401"
```

If the refresh fails, reconnect Spotify from the Now Playing page.

**4. Server clock out of sync**

If the server time is wrong, tokens can look expired or not expired by mistake.

```bash
date
sudo timedatectl set-ntp true
```

---

## Database Connection Errors

### Symptoms

- Error 500 on any endpoint
- "Npgsql.NpgsqlException" or "connection refused" in the logs
- The application does not work

### Causes and solutions

**1. PostgreSQL is not running**

```bash
sudo systemctl status postgresql
# If stopped:
sudo systemctl start postgresql
```

**2. Wrong connection string**

```bash
# Check that the database exists
sudo -u postgres psql -l | grep decatron

# Check that the user can connect
psql -h localhost -U decatron_user -d decatron_prod -c "SELECT 1;"
```

**3. Wrong password**

Check `ConnectionStrings:DefaultConnection` in `appsettings.Secrets.json`.

**4. Connection limit reached**

```bash
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
sudo -u postgres psql -c "SHOW max_connections;"

# If many connections are stuck, restart PostgreSQL:
sudo systemctl restart postgresql
```

**5. Tables are missing**

The backend does not create tables. If a feature fails with "relation ... does not exist", the matching SQL script was not applied.

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

Production has more than 240 tables. Load `Decatron.Data/Schema/baseline.sql` into an empty database and apply the scripts of `Decatron.Data/Migrations/` added after it (see [DEPLOYMENT.md](DEPLOYMENT.md#create-the-schema)).

**6. Tables with the wrong owner**

Some tables may have been created by the `postgres` user instead of `decatron_user`:

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public' AND tableowner != 'decatron_user';"

# Change the owner if needed
sudo -u postgres psql -d decatron_prod -c "ALTER TABLE table_name OWNER TO decatron_user;"
```

---

## PayPal and Tips Issues

### Symptoms

- Error when connecting the streamer's PayPal
- Tips are not processed
- "PayPal order creation failed" in the logs
- The money does not reach the streamer

### Causes and solutions

**1. Sandbox vs live mode**

```bash
grep -A8 "PayPalSettings" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json | grep Mode
```

If `Mode` is `sandbox`, payments are tests and not real. For production it must be `live`.

**2. Invalid PayPal credentials**

Check `ClientId` / `ClientSecret` (sandbox) or `LiveClientId` / `LiveClientSecret` (live) in `appsettings.Secrets.json`. Credentials come from [developer.paypal.com](https://developer.paypal.com).

**3. The PayPal OAuth callback fails**

`PayPalSettings:RedirectUri` must be exactly `https://your-domain.com/api/tips/paypal/callback` and match the one configured in the PayPal app.

**4. About the PayPal webhook**

`POST /api/tips/paypal/webhook` answers 401 when the PayPal signature headers are missing, but it does not cryptographically verify them; it only acknowledges the event. The payment itself is completed by `POST /api/tips/paypal/capture-order`, so a failing webhook does not stop tips.

**5. The streamer has not connected PayPal**

Payments go to the streamer's PayPal e-mail. If the account is not connected, the donation page endpoint returns an error.

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT user_id, paypal_email, paypal_connected FROM tips_configs WHERE user_id = <USER_ID>;"
```

---

## Spotify and Now Playing Issues

### Symptoms

- The Now Playing overlay does not show the song
- Error when connecting Spotify
- "Spotify token refresh failed" in the logs

### Causes and solutions

**1. Spotify slot not assigned or token expired**

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT user_id, provider, spotify_slot_assigned, spotify_token_expires_at FROM now_playing_configs WHERE provider = 'spotify';"
```

**2. Wrong Spotify credentials**

Check in `appsettings.Secrets.json`:
- `SpotifySettings:ClientId`
- `SpotifySettings:ClientSecret`
- `SpotifySettings:RedirectUri`, which must be `https://your-domain.com/api/spotify/callback` and registered exactly the same in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

**3. Spotify slots exhausted**

Spotify is limited to 5 slots for non-premium users; the rest wait in a list.

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT user_id, spotify_slot_requested, spotify_slot_assigned FROM now_playing_configs WHERE spotify_slot_requested = true;"
```

**4. Last.fm does not work (alternative provider)**

- Check that `LastFmSettings:ApiKey` is set
- Check that the Last.fm username is correct in the user's configuration
- The calls use plain HTTP (`http://ws.audioscrobbler.com`); a firewall that blocks outbound HTTP breaks them

**5. The polling service is not running**

```bash
grep -i "NowPlaying" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -10
```

`NowPlayingBackgroundService` checks every 3 seconds. If there are no recent log lines, restart the backend.

---

## AI Issues

### Symptoms

- The `!ia` command does not answer
- Missing API key errors
- Very slow answers or timeouts

### Causes and solutions

**1. AI is not enabled globally**

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT enabled, ai_provider, model, fallback_enabled FROM decatron_ai_global_config LIMIT 1;"
```

The platform administrator enables and configures it from the admin panel.

**2. The channel has no permission to use AI**

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT user_id, channel_name, enabled FROM decatron_ai_channel_permissions;"
```

**3. Invalid or expired Gemini API key**

```bash
grep -c "GeminiSettings" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
grep -i "gemini\|ai.*error" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -10
```

**4. OpenRouter (fallback) does not work either**

If the main provider fails and fallback is enabled, the system tries OpenRouter. If both fail:

```bash
grep -c "OpenRouterSettings" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
grep -i "openrouter" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -10
```

**5. Cooldown active**

`!ia` has a cooldown per channel and per user. A user who just used it must wait.

**6. Not enough credits**

Paid AI features charge credits (`AiCreditGate`). If the account has none, requests are refused.

---

## TTS Issues

### Symptoms

- Alerts do not play TTS audio
- "Polly credentials not configured"
- TTS files are not generated in the cache

### Causes and solutions

**1. AWS credentials not configured**

```bash
grep -c "AwsPolly" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

Without credentials the system uses anonymous AWS credentials, which fail on every Polly call; features that use TTS skip it.

**2. Cache directory missing or without permissions**

```bash
ls -la /var/www/html/decatron/tts-cache/

# If it does not exist:
mkdir -p /var/www/html/decatron/tts-cache
chown www-data:www-data /var/www/html/decatron/tts-cache   # the user that runs the backend
```

**3. Wrong AWS region**

The default is `us-east-1`. If your AWS account has region restrictions:

```json
{
    "AwsPolly": {
        "Region": "us-east-1"
    }
}
```

**4. Insufficient IAM permissions**

The IAM user needs at least `polly:SynthesizeSpeech` (and `polly:DescribeVoices` for the voice catalog). Check the [AWS IAM console](https://console.aws.amazon.com/iam/).

---

## Login and Authentication Issues

### Symptoms

- The "Login with Twitch" button redirects but does not complete the login
- "Invalid or expired login session" or "Callback failed"
- The user ends in a redirect loop

### Causes and solutions

**1. `RedirectUri` does not match**

`TwitchSettings:RedirectUri` must match **exactly** the one in the Twitch Developer Console:

```
https://your-domain.com/api/auth/callback
```

**2. Wrong `ClientId` or `ClientSecret`**

Check them against [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps).

**3. Wrong `FrontendUrl`**

After the login the backend redirects to `{FrontendUrl}/login?code=...`. If this URL is wrong, the browser never gets the code.

```bash
grep "FrontendUrl" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

**4. The one-time code expired**

The backend keeps the JWT in memory for 60 seconds behind a one-time code; the frontend swaps it with `POST /api/auth/exchange`. If the browser is slow, blocked by an extension or the backend restarted in between, the exchange answers 401 ("Invalid or expired code"). Just log in again.

**5. JWT key too short**

```bash
# The key must have at least 32 characters
grep "SecretKey" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

**6. Kick or Discord login**

The Kick and Discord logins follow the same flow with their own settings (`KickSettings`, `DiscordSettings`): check the redirect URIs there too.

---

## Quick Command Reference

### General diagnostics

```bash
# Status of the services
sudo systemctl status nginx postgresql
screen -ls
ss -tlnp | grep "7264\|5432\|80\|443"

# Latest errors in the logs
grep -i "ERR\|error\|exception\|fatal" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -20

# Disk usage (logs and the TTS cache can grow)
du -sh /var/www/html/decatron/Decatron/decatron/logs/
du -sh /var/www/html/decatron/tts-cache/

# Active database connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'decatron_prod';"
```

### Full restart

```bash
# 1. Stop the backend
screen -S decatron-api -X quit 2>/dev/null

# 2. Restart PostgreSQL
sudo systemctl restart postgresql

# 3. Restart nginx
sudo systemctl restart nginx

# 4. Start the backend
screen -dmS decatron-api bash -c 'cd /var/www/html/decatron/Decatron/decatron && ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"'

# 5. Verify
sleep 10
screen -ls
curl -s -o /dev/null -w "%{http_code}" http://localhost:7264/api/oauth/scopes
curl -s -o /dev/null -w "%{http_code}" https://YOUR_DOMAIN
```

### Database health check

```bash
# Check the connection
sudo -u postgres psql -d decatron_prod -c "SELECT 1;"

# Count tables
sudo -u postgres psql -d decatron_prod -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Database size
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('decatron_prod'));"

# The 5 biggest tables
sudo -u postgres psql -d decatron_prod -c "SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid)) AS size FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 5;"

# Number of users
sudo -u postgres psql -d decatron_prod -c "SELECT count(*) FROM users;"

# Bot tokens
sudo -u postgres psql -d decatron_prod -c "SELECT bot_username, token_expiration, created_at FROM bot_tokens ORDER BY created_at DESC LIMIT 5;"
```

### Emergency backup

```bash
# Quick backup
pg_dump -U decatron_user -h localhost decatron_prod > ~/emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# Check that the backup was created
ls -la ~/emergency_backup_*.sql
```
