# Deployment Guide

> Español: [es/DEPLOYMENT.md](es/DEPLOYMENT.md)

Step-by-step guide to deploy Decatron on an Ubuntu server with nginx, PostgreSQL and SSL. The backend runs as a .NET process and the frontend is built once and served by nginx as static files.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Clone the Repository](#clone-the-repository)
3. [Install Dependencies and Build](#install-dependencies-and-build)
4. [Configure the Application](#configure-the-application)
5. [Database Setup](#database-setup)
6. [Nginx Configuration](#nginx-configuration)
7. [SSL with Certbot](#ssl-with-certbot)
8. [Running the Backend](#running-the-backend)
9. [Updating and Redeploying](#updating-and-redeploying)
10. [Rollback Procedure](#rollback-procedure)
11. [Additional Notes](#additional-notes)

---

## Prerequisites

The server needs:

| Component | Minimum version | Check command |
|-----------|----------------|---------------|
| Ubuntu | 22.04 LTS | `lsb_release -a` |
| .NET SDK | 8.0 | `dotnet --version` |
| Node.js | 20.19+ or 22.12+ (required by Vite 7) | `node --version` |
| npm | 10+ | `npm --version` |
| PostgreSQL | 14+ | `psql --version` |
| nginx | 1.18+ | `nginx -v` |
| certbot | 1.x+ | `certbot --version` |
| screen (or any process manager) | any | `screen --version` |
| git | 2.x+ | `git --version` |
| yt-dlp | latest | `yt-dlp --version` |

### Install the prerequisites on Ubuntu

```bash
# Update the system
sudo apt update && sudo apt upgrade -y

# .NET 8 SDK
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt update
sudo apt install -y dotnet-sdk-8.0

# Node.js 22 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# nginx
sudo apt install -y nginx

# certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# screen
sudo apt install -y screen

# yt-dlp (needed for Twitch clips and Song Request)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

---

## Clone the Repository

```bash
# Create the base directory
sudo mkdir -p /var/www/html/decatron
cd /var/www/html/decatron

# Clone the repository
git clone https://github.com/decatrondev/decatron.git Decatron

# Go to the project
cd Decatron/decatron
```

The rest of this guide uses `/var/www/html/decatron/Decatron/decatron` as the project folder. Use another path if you prefer and adjust the commands and the nginx file.

---

## Install Dependencies and Build

### Backend (.NET)

```bash
cd /var/www/html/decatron/Decatron/decatron

# Restore NuGet packages
dotnet restore
```

### Frontend (React/Vite)

```bash
cd /var/www/html/decatron/Decatron/decatron/ClientApp

# Install Node dependencies
npm install

# Build the static site into ClientApp/dist
npm run build
```

nginx serves `ClientApp/dist`; there is no frontend process to keep running in production. The Vite dev server (`npm run dev`, port 5173) is only for development.

### Required directories

```bash
# Create the data folders the application needs
mkdir -p /var/www/html/decatron/Decatron/decatron/ClientApp/public/downloads
mkdir -p /var/www/html/decatron/Decatron/decatron/ClientApp/public/uploads/soundalerts
mkdir -p /var/www/html/decatron/Decatron/decatron/ClientApp/public/timerextensible
mkdir -p /var/www/html/decatron/Decatron/decatron/ClientApp/public/system-files
mkdir -p /var/www/html/decatron/tts-cache
mkdir -p /var/www/html/decatron/Decatron/decatron/logs

# Permissions (adjust the user to the one that runs the backend)
sudo chown -R www-data:www-data /var/www/html/decatron/tts-cache
```

Modules such as brand logos, emotes, trading cards and tournaments use further folders; their paths and defaults are in [ENV_VARIABLES.md](ENV_VARIABLES.md#physical-paths).

---

## Configure the Application

### Create the secrets file

Copy the example file and edit it with your real values:

```bash
cd /var/www/html/decatron/Decatron/decatron
cp appsettings.Secrets.json.example appsettings.Secrets.json
nano appsettings.Secrets.json
```

See [ENV_VARIABLES.md](ENV_VARIABLES.md) for the complete reference of every setting.

### Minimum required configuration

```json
{
    "ConnectionStrings": {
        "DefaultConnection": "Host=localhost;Port=5432;Database=decatron_prod;Username=decatron_user;Password=YOUR_PASSWORD"
    },
    "TwitchSettings": {
        "ClientId": "YOUR_TWITCH_CLIENT_ID",
        "ClientSecret": "YOUR_TWITCH_CLIENT_SECRET",
        "BotUsername": "your_bot_name",
        "ChannelId": "YOUR_CHANNEL_ID",
        "RedirectUri": "https://YOUR_DOMAIN/api/auth/callback",
        "FrontendUrl": "https://YOUR_DOMAIN"
    },
    "JwtSettings": {
        "SecretKey": "RANDOM_SECURE_KEY_OF_AT_LEAST_32_CHARACTERS",
        "ExpiryMinutes": 60,
        "RefreshTokenExpiryDays": 7
    }
}
```

### Configure CORS (if you use a different domain)

The CORS origins are written in `Program.cs` (policy `AllowReact`). If your domain is not `decatron.net`, edit it:

```csharp
// Program.cs - look for the "AddCors" section
policy.WithOrigins(
    "http://localhost:5173",
    "https://your-domain.com",
    "https://www.your-domain.com"
)
```

Other defaults in the code point to `decatron.net` and should be set for your own domain through settings: `SongRequest:PublicBaseUrl`, `Emotes:PublicBase`, `EpicSettings:RedirectUri` and `DiscordSettings:FrontendUrl` (see [ENV_VARIABLES.md](ENV_VARIABLES.md)).

---

## Database Setup

### Create the user and the database

```bash
# Open PostgreSQL as superuser
sudo -u postgres psql

# Create the user
CREATE USER decatron_user WITH PASSWORD 'YOUR_SECURE_PASSWORD';

# Create the database
CREATE DATABASE decatron_prod OWNER decatron_user;

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE decatron_prod TO decatron_user;

# Exit
\q
```

### Create the schema

The backend does **not** create or migrate tables at startup (there is no `EnsureCreated` or `Migrate` in `Program.cs`). The schema is built from SQL scripts that you apply by hand with `psql` before restarting the backend. For an empty database, load the baseline schema first (structure only, generated from production with `pg_dump --schema-only` on 2026-10-10); the incremental scripts (`Add_*`, `Fix_*`, ...) are applied only for changes made after that date.

```bash
cd /var/www/html/decatron/Decatron/decatron

# Load the baseline schema into an empty database
psql -U decatron_user -d decatron_prod -f Decatron.Data/Schema/baseline.sql

# Then apply the scripts added after 2026-10-10 (example)
psql -U decatron_user -d decatron_prod -f Decatron.Data/Migrations/SCRIPT_NAME.sql
```

### Verify the database

```bash
sudo -u postgres psql -d decatron_prod -c "\dt"
```

Production has more than 240 tables. Some of the main ones are `users`, `bot_tokens`, `custom_commands`, `timer_configs`, `tips_configs` and `sound_alert_configs`.

---

## Nginx Configuration

### Create the configuration file

```bash
sudo nano /etc/nginx/sites-available/your-domain.conf
```

Paste the following configuration (replace `YOUR_DOMAIN` with your real domain). It proxies the API, the SignalR hubs and the folders the backend serves, and serves the built frontend from `ClientApp/dist`:

```nginx
server {
    server_name YOUR_DOMAIN;

    client_max_body_size 60M;

    # SignalR - WebSocket for real-time overlays and Song Request
    location /hubs/ {
        proxy_pass http://localhost:7264;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Static files served by the .NET backend (one block per prefix)
    location ~ ^/(downloads|uploads|timerextensible|system-files|tts-audio|tcg-packs) {
        proxy_pass http://localhost:7264;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API backend (.NET on port 7264). The upgrade headers allow the
    # Decatron Desktop WebSocket (/api/desktop/ws).
    location /api {
        proxy_pass http://localhost:7264;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
        proxy_buffering off;
        client_max_body_size 60M;
    }

    # Built assets (hashed file names: cache for a year)
    location /assets/ {
        alias /var/www/html/decatron/Decatron/decatron/ClientApp/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Translation files: never cache them
    location /locales/ {
        alias /var/www/html/decatron/Decatron/decatron/ClientApp/dist/locales/;
        add_header Cache-Control "no-cache" always;
    }

    # Song Request public pages go through the backend, which returns the same
    # index.html with the page's meta tags (link previews in Discord, X, WhatsApp).
    # If the backend fails, the static index.html is served and the page still loads.
    location ~ ^/sr/[^/]+(?:/p/[^/]+)?/?$ {
        proxy_pass http://localhost:7264;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 3s;
        proxy_read_timeout 10s;
        proxy_intercept_errors on;
        error_page 500 502 503 504 = @sr_spa;
    }

    location @sr_spa {
        root /var/www/html/decatron/Decatron/decatron/ClientApp/dist;
        rewrite ^ /index.html break;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    }

    # Frontend (single-page app)
    location / {
        root /var/www/html/decatron/Decatron/decatron/ClientApp/dist;
        try_files $uri /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    }

    listen 80;
}
```

### Enable the site

```bash
# Create the symlink
sudo ln -s /etc/nginx/sites-available/your-domain.conf /etc/nginx/sites-enabled/

# Check the configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Important ports

| Port | Service | Description |
|------|---------|-------------|
| 7264 | .NET backend | REST API, SignalR hubs, static files |
| 5173 | Vite dev server | Development only |
| 80 | nginx | HTTP (redirects to 443) |
| 443 | nginx | HTTPS (SSL) |
| 5432 | PostgreSQL | Database |

---

## SSL with Certbot

```bash
# Get an SSL certificate
sudo certbot --nginx -d YOUR_DOMAIN

# Follow the interactive prompts:
# - Enter an e-mail
# - Accept the terms
# - Choose to redirect HTTP to HTTPS (option 2)

# Check automatic renewal
sudo certbot renew --dry-run
```

Certbot edits your nginx file to add the SSL directives and the HTTP to HTTPS redirect. It installs an automatic renewal timer; check it with:

```bash
sudo systemctl status certbot.timer
```

---

## Running the Backend

The backend runs in a `screen` session so it stays alive in the background. You can use any process manager (systemd, for example) instead.

### Start the backend

```bash
# Create a screen session for the backend
screen -S decatron-api

# Inside the session:
cd /var/www/html/decatron/Decatron/decatron
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"

# Detach the session: Ctrl+A, then D
```

### Managing screen sessions

```bash
# List active sessions
screen -ls

# Reattach to a session
screen -r decatron-api

# Stop a session (from inside)
# Ctrl+C to stop the process, then type: exit
```

### Verify that everything works

```bash
# The backend is listening (public endpoint, returns the list of OAuth scopes)
curl -s http://localhost:7264/api/oauth/scopes | head -c 200

# nginx and the frontend
curl -s -o /dev/null -w "%{http_code}" https://YOUR_DOMAIN

# Backend logs
tail -f /var/www/html/decatron/Decatron/decatron/logs/decatron-*.txt
```

---

## Updating and Redeploying

### Update procedure

```bash
# 1. Back up the database
pg_dump -U decatron_user decatron_prod > ~/backups/decatron_$(date +%Y%m%d_%H%M%S).sql

# 2. Pull the changes
cd /var/www/html/decatron/Decatron/decatron
git pull origin main

# 3. Restore backend dependencies
dotnet restore

# 4. Install dependencies and rebuild the frontend
cd ClientApp
npm install
npm run build
cd ..

# 5. Apply new SQL scripts (if any)
# Check for new files in Decatron.Data/Migrations/ and apply them in order
ls -la Decatron.Data/Migrations/

# 6. Restart the backend
screen -r decatron-api
# Ctrl+C to stop it, then:
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"
# Ctrl+A, D to detach
```

Apply the SQL scripts **before** restarting the backend, so the new code never runs against an old schema. The frontend needs no restart: nginx serves the new `dist` as soon as the build finishes.

### Quick deploy script

You can create a script such as `/var/www/html/decatron/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "=== Decatron Deploy ==="
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups

# Database backup
mkdir -p $BACKUP_DIR
echo "[1/5] Backing up the database..."
pg_dump -U decatron_user decatron_prod > $BACKUP_DIR/decatron_$TIMESTAMP.sql

# Pull changes
echo "[2/5] Pulling changes..."
cd /var/www/html/decatron/Decatron/decatron
git pull origin main

# Restore .NET dependencies
echo "[3/5] Restoring .NET dependencies..."
dotnet restore

# Build the frontend
echo "[4/5] Building the frontend..."
cd ClientApp && npm install && npm run build && cd ..

echo "[5/5] Done. Now apply any new SQL scripts and restart the backend:"
echo "  screen -r decatron-api"
echo ""
echo "Backup saved at: $BACKUP_DIR/decatron_$TIMESTAMP.sql"
```

---

## Rollback Procedure

### Code rollback

```bash
# 1. Stop the backend

# 2. See the latest commits
cd /var/www/html/decatron/Decatron/decatron
git log --oneline -10

# 3. Go back to the previous commit
git checkout <COMMIT_HASH>

# 4. Restore dependencies and rebuild the frontend
dotnet restore
cd ClientApp && npm install && npm run build && cd ..

# 5. Restart the backend
```

### Database rollback

```bash
# 1. Stop the backend

# 2. Restore the backup
sudo -u postgres psql -c "DROP DATABASE decatron_prod;"
sudo -u postgres psql -c "CREATE DATABASE decatron_prod OWNER decatron_user;"
sudo -u postgres psql -d decatron_prod < ~/backups/decatron_YYYYMMDD_HHMMSS.sql

# 3. Restart the backend
```

**WARNING:** a database rollback loses all data created after the backup (new users, tips, settings and so on). Use it only as a last resort.

### Partial rollback of a SQL script

The project's SQL scripts have no rollback scripts. If a script fails halfway:

1. Check which tables or columns were partially created
2. Remove by hand what was created
3. Fix the SQL script
4. Run it again

It is best to always run scripts inside a transaction:

```sql
BEGIN;
-- content of the migration script
COMMIT;
```

---

## Additional Notes

### Configuration file structure

```
appsettings.json                      <- Public configuration (logging, scopes, module defaults)
appsettings.Secrets.json              <- Secrets (NOT in git, never commit it)
appsettings.Secrets.json.example      <- Secrets template (in git, no real values)
appsettings.Secrets.{Environment}.json <- Secrets of one environment (for example Staging)
```

### Logs

Logs are written to `logs/` inside the project folder with daily rotation: files named `decatron-YYYYMMDD.txt`, at most 50 MB each, 14 files kept. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more details.

### Production database

- More than 240 tables and several hundred indexes
- Main user: `decatron_user`
- Migrations are manual SQL scripts; `dotnet ef migrations` is not used
- Take daily backups with `pg_dump`
