# Guia de Despliegue / Deployment Guide

Guia paso a paso para desplegar Decatron en un servidor Ubuntu con nginx, PostgreSQL y SSL.

---

## Tabla de Contenidos

1. [Prerrequisitos / Prerequisites](#prerrequisitos--prerequisites)
2. [Clonar repositorio / Clone Repository](#clonar-repositorio--clone-repository)
3. [Instalar dependencias / Install Dependencies](#instalar-dependencias--install-dependencies)
4. [Configurar la aplicacion / Configure Application](#configurar-la-aplicacion--configure-application)
5. [Base de datos / Database Setup](#base-de-datos--database-setup)
6. [Configurar nginx / Nginx Configuration](#configurar-nginx--nginx-configuration)
7. [SSL con Certbot / SSL with Certbot](#ssl-con-certbot--ssl-with-certbot)
8. [Ejecutar con screen / Running with screen](#ejecutar-con-screen--running-with-screen)
9. [Actualizar y redesplegar / Updating & Redeploying](#actualizar-y-redesplegar--updating--redeploying)
10. [Procedimiento de rollback / Rollback Procedure](#procedimiento-de-rollback--rollback-procedure)

---

## Prerrequisitos / Prerequisites

El servidor debe tener instalado:

| Componente | Version minima | Comando de verificacion |
|------------|---------------|------------------------|
| Ubuntu | 22.04 LTS | `lsb_release -a` |
| .NET SDK | 8.0 | `dotnet --version` |
| Node.js | 18.x+ | `node --version` |
| npm | 9.x+ | `npm --version` |
| PostgreSQL | 14+ | `psql --version` |
| nginx | 1.18+ | `nginx -v` |
| certbot | 1.x+ | `certbot --version` |
| screen | cualquiera | `screen --version` |
| git | 2.x+ | `git --version` |

### Instalar prerrequisitos en Ubuntu / Install Prerequisites on Ubuntu

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# .NET 8 SDK
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt update
sudo apt install -y dotnet-sdk-8.0

# Node.js 18+ (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# nginx
sudo apt install -y nginx

# certbot para SSL
sudo apt install -y certbot python3-certbot-nginx

# screen
sudo apt install -y screen

# yt-dlp (necesario para clips de Twitch)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

---

## Clonar repositorio / Clone Repository

```bash
# Crear directorio base
sudo mkdir -p /var/www/html/decatron
cd /var/www/html/decatron

# Clonar el repositorio
git clone https://github.com/decatrondev/decatron.git Decatron

# Navegar al proyecto
cd Decatron/decatron
```

---

## Instalar dependencias / Install Dependencies

### Backend (.NET)

```bash
cd /var/www/html/decatron/Decatron/decatron

# Restaurar paquetes NuGet
dotnet restore
```

### Frontend (React/Vite)

```bash
cd /var/www/html/decatron/Decatron/decatron/ClientApp

# Instalar dependencias de Node
npm install
```

### Directorios necesarios / Required Directories

```bash
# Crear directorios de datos que la aplicacion necesita
mkdir -p /var/www/html/decatron/Decatron/decatron/ClientApp/public/downloads
mkdir -p /var/www/html/decatron/Decatron/decatron/ClientApp/public/uploads/soundalerts
mkdir -p /var/www/html/decatron/Decatron/decatron/ClientApp/public/timerextensible
mkdir -p /var/www/html/decatron/Decatron/decatron/ClientApp/public/system-files
mkdir -p /var/www/html/decatron/tts-cache
mkdir -p /var/www/html/decatron/Decatron/decatron/logs

# Permisos
sudo chown -R www-data:www-data /var/www/html/decatron/tts-cache
```

---

## Configurar la aplicacion / Configure Application

### Crear archivo de secretos / Create Secrets File

Copiar el archivo de ejemplo y editarlo con tus valores reales:

```bash
cd /var/www/html/decatron/Decatron/decatron
cp appsettings.Secrets.json.example appsettings.Secrets.json
nano appsettings.Secrets.json
```

Ver [ENV_VARIABLES.md](ENV_VARIABLES.md) para la documentacion completa de cada variable.

### Archivo minimo requerido / Minimum Required Configuration

```json
{
    "ConnectionStrings": {
        "DefaultConnection": "Host=localhost;Port=5432;Database=decatron_prod;Username=decatron_user;Password=TU_PASSWORD_AQUI"
    },
    "TwitchSettings": {
        "ClientId": "TU_TWITCH_CLIENT_ID",
        "ClientSecret": "TU_TWITCH_CLIENT_SECRET",
        "BotUsername": "nombre_de_tu_bot",
        "ChannelId": "TU_CHANNEL_ID",
        "RedirectUri": "https://TU_DOMINIO/api/auth/callback",
        "FrontendUrl": "https://TU_DOMINIO"
    },
    "JwtSettings": {
        "SecretKey": "CLAVE_MINIMO_32_CARACTERES_ALEATORIA_SEGURA",
        "ExpiryMinutes": 60,
        "RefreshTokenExpiryDays": 7
    }
}
```

### Configurar CORS (si usas un dominio diferente) / Configure CORS

Los origenes CORS estan hardcodeados en `Program.cs` (lineas 93-97). Si tu dominio es diferente a `decatron.net`, debes editarlo:

```csharp
// Program.cs - buscar la seccion "AddCors"
policy.WithOrigins(
    "http://localhost:5173",
    "https://tu-dominio.com",
    "https://www.tu-dominio.com"
)
```

---

## Base de datos / Database Setup

### Crear usuario y base de datos / Create User and Database

```bash
# Acceder a PostgreSQL como superusuario
sudo -u postgres psql

# Crear usuario
CREATE USER decatron_user WITH PASSWORD 'TU_PASSWORD_SEGURO';

# Crear base de datos
CREATE DATABASE decatron_prod OWNER decatron_user;

# Dar permisos
GRANT ALL PRIVILEGES ON DATABASE decatron_prod TO decatron_user;

# Salir
\q
```

### Ejecutar migraciones / Run Migrations

EF Core crea todas las tablas automaticamente en la primera ejecucion. No se necesitan migraciones manuales.

```bash
cd /var/www/html/decatron/Decatron/decatron

# Iniciar la aplicacion — EF Core creara todas las tablas automaticamente
dotnet run
```

### Verificar la base de datos / Verify Database

```bash
sudo -u postgres psql -d decatron_prod -c "\dt"
```

Deberias ver aproximadamente 78 tablas. Las principales son: `users`, `bot_tokens`, `custom_commands`, `timer_configs`, `tips_configs`, `sound_alert_configs`, etc.

---

## Configurar nginx / Nginx Configuration

### Crear el archivo de configuracion / Create Configuration File

```bash
sudo nano /etc/nginx/sites-available/tu-dominio.conf
```

Pegar la siguiente configuracion (reemplazar `TU_DOMINIO` con tu dominio real):

```nginx
server {
    server_name TU_DOMINIO;

    client_max_body_size 60M;

    # SignalR - WebSocket para overlays en tiempo real
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

    # Archivos estaticos servidos por el backend .NET
    location /downloads {
        proxy_pass http://localhost:7264;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads {
        proxy_pass http://localhost:7264;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /timerextensible {
        proxy_pass http://localhost:7264;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /system-files {
        proxy_pass http://localhost:7264;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /tts-audio {
        proxy_pass http://localhost:7264;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API backend (.NET en puerto 7264)
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
        client_max_body_size 60M;
    }

    # Frontend React/Vite (puerto 5173)
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen 80;
}
```

### Habilitar el sitio / Enable the Site

```bash
# Crear symlink
sudo ln -s /etc/nginx/sites-available/tu-dominio.conf /etc/nginx/sites-enabled/

# Verificar configuracion
sudo nginx -t

# Recargar nginx
sudo systemctl reload nginx
```

### Puertos importantes / Important Ports

| Puerto | Servicio | Descripcion |
|--------|----------|-------------|
| 7264 | Backend .NET | API REST, SignalR, archivos estaticos |
| 5173 | Frontend Vite | React dev server (desarrollo) |
| 80 | nginx | HTTP (redirige a 443) |
| 443 | nginx | HTTPS (SSL) |
| 5432 | PostgreSQL | Base de datos |

---

## SSL con Certbot / SSL with Certbot

```bash
# Obtener certificado SSL
sudo certbot --nginx -d TU_DOMINIO

# Seguir las instrucciones interactivas:
# - Ingresar email
# - Aceptar terminos
# - Elegir redirigir HTTP a HTTPS (opcion 2)

# Verificar renovacion automatica
sudo certbot renew --dry-run
```

Certbot modificara automaticamente tu archivo nginx para agregar las directivas SSL y la redireccion HTTP->HTTPS.

### Renovacion automatica / Automatic Renewal

Certbot instala un cron/timer automatico. Verificar:

```bash
sudo systemctl status certbot.timer
```

---

## Ejecutar con screen / Running with screen

La aplicacion se ejecuta en sesiones de `screen` para mantenerla activa en background.

### Iniciar el backend / Start Backend

```bash
# Crear sesion screen para el backend
screen -S decatron-api

# Dentro de la sesion:
cd /var/www/html/decatron/Decatron/decatron
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"

# Separar la sesion: Ctrl+A, luego D
```

### Iniciar el frontend / Start Frontend

```bash
# Crear sesion screen para el frontend
screen -S decatron-frontend

# Dentro de la sesion:
cd /var/www/html/decatron/Decatron/decatron/ClientApp
npm run dev -- --host 0.0.0.0 --port 5173

# Separar la sesion: Ctrl+A, luego D
```

### Gestionar sesiones de screen / Managing Screen Sessions

```bash
# Ver sesiones activas
screen -ls

# Reconectar a una sesion
screen -r decatron-api
screen -r decatron-frontend

# Detener una sesion (desde dentro)
# Ctrl+C para detener el proceso, luego escribir: exit
```

### Verificar que todo funciona / Verify Everything Works

```bash
# Verificar que el backend esta escuchando
curl -s http://localhost:7264/api/auth/login | head -5

# Verificar que el frontend esta escuchando
curl -s http://localhost:5173 | head -5

# Verificar nginx
curl -s -o /dev/null -w "%{http_code}" https://TU_DOMINIO

# Verificar logs del backend
tail -f /var/www/html/decatron/Decatron/decatron/logs/decatron-*.txt
```

---

## Actualizar y redesplegar / Updating & Redeploying

### Procedimiento de actualizacion / Update Procedure

```bash
# 1. Hacer backup de la base de datos
pg_dump -U decatron_user decatron_prod > ~/backups/decatron_$(date +%Y%m%d_%H%M%S).sql

# 2. Reconectar y detener el backend
screen -r decatron-api
# Ctrl+C para detener
# No cerrar la sesion screen

# 3. Reconectar y detener el frontend
screen -r decatron-frontend
# Ctrl+C para detener
# No cerrar la sesion screen

# 4. Descargar cambios
cd /var/www/html/decatron/Decatron/decatron
git pull origin main

# 5. Reinstalar dependencias del backend
dotnet restore

# 6. Reinstalar dependencias del frontend
cd ClientApp
npm install
cd ..

# 7. Ejecutar nuevas migraciones SQL (si las hay)
# Revisar si hay nuevos archivos en Migrations/
ls -la Migrations/
# Ejecutar las nuevas migraciones en orden

# 8. Reiniciar el backend
screen -r decatron-api
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"
# Ctrl+A, D para separar

# 9. Reiniciar el frontend
screen -r decatron-frontend
npm run dev -- --host 0.0.0.0 --port 5173
# Ctrl+A, D para separar
```

### Script de despliegue rapido / Quick Deploy Script

Puedes crear un script en `/var/www/html/decatron/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "=== Decatron Deploy ==="
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups

# Backup de la base de datos
mkdir -p $BACKUP_DIR
echo "[1/6] Creando backup de la base de datos..."
pg_dump -U decatron_user decatron_prod > $BACKUP_DIR/decatron_$TIMESTAMP.sql

# Pull de cambios
echo "[2/6] Descargando cambios..."
cd /var/www/html/decatron/Decatron/decatron
git pull origin main

# Restaurar dependencias .NET
echo "[3/6] Restaurando dependencias .NET..."
dotnet restore

# Instalar dependencias del frontend
echo "[4/6] Instalando dependencias del frontend..."
cd ClientApp && npm install && cd ..

echo "[5/6] Deploy completado."
echo "[6/6] IMPORTANTE: Reiniciar manualmente las sesiones screen."
echo "  screen -r decatron-api"
echo "  screen -r decatron-frontend"
echo ""
echo "Backup guardado en: $BACKUP_DIR/decatron_$TIMESTAMP.sql"
```

---

## Procedimiento de rollback / Rollback Procedure

### Rollback de codigo / Code Rollback

```bash
# 1. Detener los servicios (backend y frontend en screen)

# 2. Ver los ultimos commits
cd /var/www/html/decatron/Decatron/decatron
git log --oneline -10

# 3. Volver al commit anterior
git checkout <COMMIT_HASH>

# 4. Restaurar dependencias
dotnet restore
cd ClientApp && npm install && cd ..

# 5. Reiniciar los servicios
```

### Rollback de base de datos / Database Rollback

```bash
# 1. Detener el backend

# 2. Restaurar el backup
sudo -u postgres psql -c "DROP DATABASE decatron_prod;"
sudo -u postgres psql -c "CREATE DATABASE decatron_prod OWNER decatron_user;"
sudo -u postgres psql -d decatron_prod < ~/backups/decatron_YYYYMMDD_HHMMSS.sql

# 3. Reiniciar el backend
```

**ADVERTENCIA:** El rollback de base de datos perdera todos los datos creados despues del backup (usuarios nuevos, tips, configuraciones, etc.). Solo usar como ultimo recurso.

### Rollback parcial de una migracion SQL / Partial SQL Migration Rollback

Las migraciones SQL del proyecto no tienen scripts de rollback. Si una migracion falla a mitad de ejecucion:

1. Revisar que tablas/columnas se crearon parcialmente
2. Eliminar manualmente lo que se creo
3. Corregir el script SQL
4. Ejecutarlo de nuevo

Se recomienda siempre ejecutar migraciones dentro de una transaccion:

```sql
BEGIN;
-- contenido del script de migracion
COMMIT;
```

---

## Notas adicionales / Additional Notes

### Estructura de archivos de configuracion / Configuration File Structure

```
appsettings.json                    <- Configuracion publica (logging, scopes)
appsettings.Secrets.json            <- Secretos (NO en git, NUNCA commitear)
appsettings.Secrets.json.example    <- Template de secretos (en git, sin valores reales)
appsettings.Staging.json            <- Config especifica de staging
appsettings.Secrets.Staging.json    <- Secretos de staging
```

### Logs

Los logs se escriben en `/var/www/html/decatron/Decatron/decatron/logs/` con rotacion diaria (maximo 7 archivos de 10MB cada uno). Ver [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para mas detalles.

### Base de datos en produccion

- **78 tablas**, 296 indices, 43 foreign keys
- Usuario principal: `decatron_user`
- Las migraciones son manuales (scripts SQL), no se usa `dotnet ef migrations`
- Hacer backups diarios con `pg_dump`
