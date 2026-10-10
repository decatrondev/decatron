# Guía de despliegue

> English: [../DEPLOYMENT.md](../DEPLOYMENT.md)

Guía paso a paso para desplegar Decatron en un servidor Ubuntu con nginx, PostgreSQL y SSL. El backend corre como un proceso .NET y el frontend se compila una vez y nginx lo sirve como archivos estáticos.

---

## Contenido

1. [Requisitos previos](#requisitos-previos)
2. [Clonar el repositorio](#clonar-el-repositorio)
3. [Instalar dependencias y compilar](#instalar-dependencias-y-compilar)
4. [Configurar la aplicación](#configurar-la-aplicación)
5. [Configuración de la base de datos](#configuración-de-la-base-de-datos)
6. [Configuración de nginx](#configuración-de-nginx)
7. [SSL con Certbot](#ssl-con-certbot)
8. [Ejecutar el backend](#ejecutar-el-backend)
9. [Actualizar y redesplegar](#actualizar-y-redesplegar)
10. [Procedimiento de rollback](#procedimiento-de-rollback)
11. [Notas adicionales](#notas-adicionales)

---

## Requisitos previos

El servidor necesita:

| Componente | Versión mínima | Comando de verificación |
|------------|----------------|-------------------------|
| Ubuntu | 22.04 LTS | `lsb_release -a` |
| .NET SDK | 8.0 | `dotnet --version` |
| Node.js | 20.19+ o 22.12+ (lo exige Vite 7) | `node --version` |
| npm | 10+ | `npm --version` |
| PostgreSQL | 14+ | `psql --version` |
| nginx | 1.18+ | `nginx -v` |
| certbot | 1.x+ | `certbot --version` |
| screen (o cualquier gestor de procesos) | cualquiera | `screen --version` |
| git | 2.x+ | `git --version` |
| yt-dlp | la más reciente | `yt-dlp --version` |

### Instalar los requisitos en Ubuntu

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# .NET 8 SDK
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt update
sudo apt install -y dotnet-sdk-8.0

# Node.js 22 (con NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# nginx
sudo apt install -y nginx

# certbot para SSL
sudo apt install -y certbot python3-certbot-nginx

# screen
sudo apt install -y screen

# yt-dlp (necesario para los clips de Twitch y Song Request)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

---

## Clonar el repositorio

```bash
# Crear el directorio base
sudo mkdir -p /var/www/html/decatron
cd /var/www/html/decatron

# Clonar el repositorio
git clone https://github.com/decatrondev/decatron.git Decatron

# Ir al proyecto
cd Decatron/decatron
```

El resto de esta guía usa `/var/www/html/decatron/Decatron/decatron` como carpeta del proyecto. Usa otra ruta si prefieres y ajusta los comandos y el archivo de nginx.

---

## Instalar dependencias y compilar

### Backend (.NET)

```bash
cd /var/www/html/decatron/Decatron/decatron

# Restaurar los paquetes NuGet
dotnet restore
```

### Frontend (React/Vite)

```bash
cd /var/www/html/decatron/Decatron/decatron/ClientApp

# Instalar las dependencias de Node
npm install

# Compilar el sitio estático en ClientApp/dist
npm run build
```

nginx sirve `ClientApp/dist`; en producción no hay ningún proceso del frontend que mantener. El servidor de desarrollo de Vite (`npm run dev`, puerto 5173) es solo para desarrollo.

### Directorios necesarios

```bash
# Crear las carpetas de datos que necesita la aplicación
mkdir -p /var/www/html/decatron/Decatron/decatron/ClientApp/public/downloads
mkdir -p /var/www/html/decatron/Decatron/decatron/ClientApp/public/uploads/soundalerts
mkdir -p /var/www/html/decatron/Decatron/decatron/ClientApp/public/timerextensible
mkdir -p /var/www/html/decatron/Decatron/decatron/ClientApp/public/system-files
mkdir -p /var/www/html/decatron/tts-cache
mkdir -p /var/www/html/decatron/Decatron/decatron/logs

# Permisos (ajusta el usuario al que ejecuta el backend)
sudo chown -R www-data:www-data /var/www/html/decatron/tts-cache
```

Módulos como los logos de la marca, los emotes, las cartas coleccionables y los torneos usan más carpetas; sus rutas y valores por defecto están en [ENV_VARIABLES.md](ENV_VARIABLES.md#rutas-físicas).

---

## Configurar la aplicación

### Crear el archivo de secretos

Copia el archivo de ejemplo y edítalo con tus valores reales:

```bash
cd /var/www/html/decatron/Decatron/decatron
cp appsettings.Secrets.json.example appsettings.Secrets.json
nano appsettings.Secrets.json
```

Consulta [ENV_VARIABLES.md](ENV_VARIABLES.md) para la referencia completa de cada ajuste.

### Configuración mínima requerida

```json
{
    "ConnectionStrings": {
        "DefaultConnection": "Host=localhost;Port=5432;Database=decatron_prod;Username=decatron_user;Password=TU_CONTRASEÑA"
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
        "SecretKey": "CLAVE_ALEATORIA_SEGURA_DE_AL_MENOS_32_CARACTERES",
        "ExpiryMinutes": 60,
        "RefreshTokenExpiryDays": 7
    }
}
```

### Configurar CORS (si usas otro dominio)

Los orígenes CORS están escritos en `Program.cs` (política `AllowReact`). Si tu dominio no es `decatron.net`, edítalo:

```csharp
// Program.cs - busca la sección "AddCors"
policy.WithOrigins(
    "http://localhost:5173",
    "https://tu-dominio.com",
    "https://www.tu-dominio.com"
)
```

Otros valores por defecto del código apuntan a `decatron.net` y conviene definirlos para tu propio dominio mediante ajustes: `SongRequest:PublicBaseUrl`, `Emotes:PublicBase`, `EpicSettings:RedirectUri` y `DiscordSettings:FrontendUrl` (consulta [ENV_VARIABLES.md](ENV_VARIABLES.md)).

---

## Configuración de la base de datos

### Crear el usuario y la base de datos

```bash
# Abrir PostgreSQL como superusuario
sudo -u postgres psql

# Crear el usuario
CREATE USER decatron_user WITH PASSWORD 'TU_CONTRASEÑA_SEGURA';

# Crear la base de datos
CREATE DATABASE decatron_prod OWNER decatron_user;

# Dar permisos
GRANT ALL PRIVILEGES ON DATABASE decatron_prod TO decatron_user;

# Salir
\q
```

### Crear el esquema

El backend **no** crea ni migra tablas al iniciar (no hay `EnsureCreated` ni `Migrate` en `Program.cs`). El esquema se construye con scripts SQL que aplicas a mano con `psql` antes de reiniciar el backend. Para una base vacía, carga primero el esquema base (solo estructura, generado desde producción con `pg_dump --schema-only` el 2026-10-10); los scripts incrementales (`Add_*`, `Fix_*`, ...) se aplican solo para cambios hechos después de esa fecha.

```bash
cd /var/www/html/decatron/Decatron/decatron

# Cargar el esquema base en una base vacía
psql -U decatron_user -d decatron_prod -f Decatron.Data/Schema/baseline.sql

# Después, aplicar los scripts agregados tras el 2026-10-10 (ejemplo)
psql -U decatron_user -d decatron_prod -f Decatron.Data/Migrations/NOMBRE_DEL_SCRIPT.sql
```

### Verificar la base de datos

```bash
sudo -u postgres psql -d decatron_prod -c "\dt"
```

En producción hay más de 240 tablas. Algunas de las principales son `users`, `bot_tokens`, `custom_commands`, `timer_configs`, `tips_configs` y `sound_alert_configs`.

---

## Configuración de nginx

### Crear el archivo de configuración

```bash
sudo nano /etc/nginx/sites-available/tu-dominio.conf
```

Pega la siguiente configuración (reemplaza `TU_DOMINIO` por tu dominio real). Hace de proxy de la API, de los hubs de SignalR y de las carpetas que sirve el backend, y sirve el frontend compilado desde `ClientApp/dist`:

```nginx
server {
    server_name TU_DOMINIO;

    client_max_body_size 60M;

    # SignalR - WebSocket para overlays en tiempo real y Song Request
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

    # Archivos estáticos servidos por el backend .NET (un bloque para todos los prefijos)
    location ~ ^/(downloads|uploads|timerextensible|system-files|tts-audio|tcg-packs) {
        proxy_pass http://localhost:7264;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend de la API (.NET en el puerto 7264). Las cabeceras de upgrade permiten
    # el WebSocket de Decatron Desktop (/api/desktop/ws).
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

    # Recursos compilados (nombres con hash: caché de un año)
    location /assets/ {
        alias /var/www/html/decatron/Decatron/decatron/ClientApp/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Archivos de traducción: nunca en caché
    location /locales/ {
        alias /var/www/html/decatron/Decatron/decatron/ClientApp/dist/locales/;
        add_header Cache-Control "no-cache" always;
    }

    # Las páginas públicas de Song Request pasan por el backend, que devuelve el mismo
    # index.html con las meta tags de la página (vista previa de enlaces en Discord, X, WhatsApp).
    # Si el backend falla, se sirve el index.html estático y la página carga igual.
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

    # Frontend (aplicación de una sola página)
    location / {
        root /var/www/html/decatron/Decatron/decatron/ClientApp/dist;
        try_files $uri /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    }

    listen 80;
}
```

### Habilitar el sitio

```bash
# Crear el enlace simbólico
sudo ln -s /etc/nginx/sites-available/tu-dominio.conf /etc/nginx/sites-enabled/

# Verificar la configuración
sudo nginx -t

# Recargar nginx
sudo systemctl reload nginx
```

### Puertos importantes

| Puerto | Servicio | Descripción |
|--------|----------|-------------|
| 7264 | Backend .NET | API REST, hubs de SignalR, archivos estáticos |
| 5173 | Servidor de desarrollo de Vite | Solo para desarrollo |
| 80 | nginx | HTTP (redirige a 443) |
| 443 | nginx | HTTPS (SSL) |
| 5432 | PostgreSQL | Base de datos |

---

## SSL con Certbot

```bash
# Obtener un certificado SSL
sudo certbot --nginx -d TU_DOMINIO

# Seguir las indicaciones interactivas:
# - Ingresar un correo
# - Aceptar los términos
# - Elegir redirigir HTTP a HTTPS (opción 2)

# Comprobar la renovación automática
sudo certbot renew --dry-run
```

Certbot edita tu archivo de nginx para agregar las directivas SSL y la redirección de HTTP a HTTPS. Instala un temporizador de renovación automática; compruébalo con:

```bash
sudo systemctl status certbot.timer
```

---

## Ejecutar el backend

El backend corre en una sesión de `screen` para mantenerse activo en segundo plano. Puedes usar en su lugar cualquier gestor de procesos (systemd, por ejemplo).

### Iniciar el backend

```bash
# Crear una sesión de screen para el backend
screen -S decatron-api

# Dentro de la sesión:
cd /var/www/html/decatron/Decatron/decatron
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"

# Separar la sesión: Ctrl+A, luego D
```

### Gestionar las sesiones de screen

```bash
# Ver las sesiones activas
screen -ls

# Volver a una sesión
screen -r decatron-api

# Detener una sesión (desde dentro)
# Ctrl+C para detener el proceso y luego escribir: exit
```

### Verificar que todo funciona

```bash
# El backend está escuchando (endpoint público, devuelve la lista de scopes de OAuth)
curl -s http://localhost:7264/api/oauth/scopes | head -c 200

# nginx y el frontend
curl -s -o /dev/null -w "%{http_code}" https://TU_DOMINIO

# Registros del backend
tail -f /var/www/html/decatron/Decatron/decatron/logs/decatron-*.txt
```

---

## Actualizar y redesplegar

### Procedimiento de actualización

```bash
# 1. Hacer una copia de seguridad de la base de datos
pg_dump -U decatron_user decatron_prod > ~/backups/decatron_$(date +%Y%m%d_%H%M%S).sql

# 2. Descargar los cambios
cd /var/www/html/decatron/Decatron/decatron
git pull origin main

# 3. Restaurar las dependencias del backend
dotnet restore

# 4. Instalar las dependencias y recompilar el frontend
cd ClientApp
npm install
npm run build
cd ..

# 5. Aplicar los scripts SQL nuevos (si los hay)
# Revisa si hay archivos nuevos en Decatron.Data/Migrations/ y aplícalos en orden
ls -la Decatron.Data/Migrations/

# 6. Reiniciar el backend
screen -r decatron-api
# Ctrl+C para detenerlo y luego:
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"
# Ctrl+A, D para separar
```

Aplica los scripts SQL **antes** de reiniciar el backend, para que el código nuevo nunca corra contra un esquema viejo. El frontend no necesita reinicio: nginx sirve el nuevo `dist` en cuanto termina la compilación.

### Script de despliegue rápido

Puedes crear un script como `/var/www/html/decatron/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "=== Despliegue de Decatron ==="
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups

# Copia de seguridad de la base de datos
mkdir -p $BACKUP_DIR
echo "[1/5] Creando la copia de seguridad de la base de datos..."
pg_dump -U decatron_user decatron_prod > $BACKUP_DIR/decatron_$TIMESTAMP.sql

# Descargar los cambios
echo "[2/5] Descargando los cambios..."
cd /var/www/html/decatron/Decatron/decatron
git pull origin main

# Restaurar las dependencias de .NET
echo "[3/5] Restaurando las dependencias de .NET..."
dotnet restore

# Compilar el frontend
echo "[4/5] Compilando el frontend..."
cd ClientApp && npm install && npm run build && cd ..

echo "[5/5] Listo. Ahora aplica los scripts SQL nuevos y reinicia el backend:"
echo "  screen -r decatron-api"
echo ""
echo "Copia de seguridad guardada en: $BACKUP_DIR/decatron_$TIMESTAMP.sql"
```

---

## Procedimiento de rollback

### Rollback del código

```bash
# 1. Detener el backend

# 2. Ver los últimos commits
cd /var/www/html/decatron/Decatron/decatron
git log --oneline -10

# 3. Volver al commit anterior
git checkout <HASH_DEL_COMMIT>

# 4. Restaurar las dependencias y recompilar el frontend
dotnet restore
cd ClientApp && npm install && npm run build && cd ..

# 5. Reiniciar el backend
```

### Rollback de la base de datos

```bash
# 1. Detener el backend

# 2. Restaurar la copia de seguridad
sudo -u postgres psql -c "DROP DATABASE decatron_prod;"
sudo -u postgres psql -c "CREATE DATABASE decatron_prod OWNER decatron_user;"
sudo -u postgres psql -d decatron_prod < ~/backups/decatron_AAAAMMDD_HHMMSS.sql

# 3. Reiniciar el backend
```

**ADVERTENCIA:** un rollback de la base de datos pierde todos los datos creados después de la copia de seguridad (usuarios nuevos, propinas, configuraciones, etc.). Úsalo solo como último recurso.

### Rollback parcial de un script SQL

Los scripts SQL del proyecto no tienen scripts de rollback. Si un script falla a medio camino:

1. Revisa qué tablas o columnas se crearon parcialmente
2. Elimina a mano lo que se creó
3. Corrige el script SQL
4. Vuelve a ejecutarlo

Es mejor ejecutar siempre los scripts dentro de una transacción:

```sql
BEGIN;
-- contenido del script de migración
COMMIT;
```

---

## Notas adicionales

### Estructura de los archivos de configuración

```
appsettings.json                      <- Configuración pública (registros, scopes, valores por defecto de módulos)
appsettings.Secrets.json              <- Secretos (NO está en git, nunca lo subas)
appsettings.Secrets.json.example      <- Plantilla de secretos (en git, sin valores reales)
appsettings.Secrets.{Environment}.json <- Secretos de un entorno (por ejemplo Staging)
```

### Registros

Los registros se escriben en `logs/` dentro de la carpeta del proyecto con rotación diaria: archivos llamados `decatron-AAAAMMDD.txt`, de máximo 50 MB cada uno, y se conservan 14. Consulta [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para más detalles.

### Base de datos en producción

- Más de 240 tablas y varios cientos de índices
- Usuario principal: `decatron_user`
- Las migraciones son scripts SQL manuales; no se usa `dotnet ef migrations`
- Haz copias de seguridad diarias con `pg_dump`
