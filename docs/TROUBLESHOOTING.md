# Solucion de Problemas / Troubleshooting Guide

Guia practica para diagnosticar y resolver los problemas mas comunes en Decatron.

---

## Tabla de Contenidos

1. [Como revisar logs / How to Check Logs](#como-revisar-logs--how-to-check-logs)
2. [Como reiniciar servicios / How to Restart Services](#como-reiniciar-servicios--how-to-restart-services)
3. [502 Bad Gateway (servicio no corriendo)](#502-bad-gateway--servicio-no-corriendo)
4. [Bot no conecta al chat de Twitch](#bot-no-conecta-al-chat-de-twitch--bot-not-connecting-to-twitch-chat)
5. [Overlays no se actualizan (SignalR)](#overlays-no-se-actualizan--overlays-not-updating-signalr)
6. [Problemas de expiracion de tokens](#problemas-de-expiracion-de-tokens--token-expiration-issues)
7. [Errores de conexion a la base de datos](#errores-de-conexion-a-la-base-de-datos--database-connection-errors)
8. [Problemas con PayPal/Tips](#problemas-con-paypaltips--paypal--tips-issues)
9. [Problemas con Spotify/Now Playing](#problemas-con-spotifynow-playing--spotify--now-playing-issues)
10. [Problemas con DecatronAI](#problemas-con-decatronai--decatronai-issues)
11. [Problemas con TTS (AWS Polly)](#problemas-con-tts-aws-polly--tts-issues)
12. [Problemas de login/autenticacion](#problemas-de-loginautenticacion--login--authentication-issues)
13. [Referencia rapida de comandos / Quick Command Reference](#referencia-rapida-de-comandos--quick-command-reference)

---

## Como revisar logs / How to Check Logs

### Ubicacion de los logs / Log Location

Los logs se guardan en: `/var/www/html/decatron/Decatron/decatron/logs/`

```bash
# Ver archivos de log disponibles
ls -la /var/www/html/decatron/Decatron/decatron/logs/

# Los archivos siguen el patron: decatron-YYYYMMDD.txt
# Ejemplo: decatron-20260328.txt
```

### Ver logs en tiempo real / Watch Logs in Real Time

```bash
# Seguir el log actual
tail -f /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt

# Filtrar solo errores
tail -f /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | grep -i "ERR\|error\|exception"

# Filtrar por modulo especifico
tail -f /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | grep -i "twitch\|bot"
```

### Ver logs del output de la consola / Console Output Logs

Si el backend corre en una sesion screen, los logs tambien se ven en consola:

```bash
screen -r decatron-api
# Los logs aparecen en formato: [HH:mm:ss LEV] Mensaje
# Ctrl+A, D para salir sin detener
```

### Configuracion de logs / Log Configuration

Los logs se configuran en `appsettings.json`:

- **Rotacion:** Un archivo por dia
- **Tamano maximo:** 10MB por archivo
- **Retencion:** 7 archivos (1 semana)
- **Formato:** `[2026-03-28 14:30:00 INF] Mensaje`

Para cambiar el nivel de detalle temporalmente:

```json
{
    "Serilog": {
        "MinimumLevel": {
            "Default": "Debug"  // Cambiar de "Information" a "Debug" para mas detalle
        }
    }
}
```

**Importante:** Reiniciar el backend despues de cambiar la configuracion de logging.

---

## Como reiniciar servicios / How to Restart Services

### Reiniciar el backend / Restart Backend

```bash
# 1. Reconectar a la sesion screen
screen -r decatron-api

# 2. Detener el proceso actual
# Presionar Ctrl+C

# 3. Reiniciar
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"

# 4. Separar sesion: Ctrl+A, luego D
```

### Reiniciar el frontend / Restart Frontend

```bash
screen -r decatron-frontend
# Ctrl+C para detener
npm run dev -- --host 0.0.0.0 --port 5173
# Ctrl+A, D para separar
```

### Reiniciar nginx

```bash
sudo systemctl reload nginx   # Recarga configuracion sin detener
sudo systemctl restart nginx   # Reinicio completo
```

### Reiniciar PostgreSQL

```bash
sudo systemctl restart postgresql
```

### Si la sesion screen se perdio / If Screen Session is Lost

```bash
# Verificar si hay sesiones existentes
screen -ls

# Si no hay sesiones, crear nuevas:
screen -S decatron-api
# Iniciar backend...
# Ctrl+A, D

screen -S decatron-frontend
# Iniciar frontend...
# Ctrl+A, D
```

---

## 502 Bad Gateway / Servicio no corriendo

### Sintomas / Symptoms

- El navegador muestra "502 Bad Gateway" de nginx
- La pagina no carga en absoluto

### Causas y soluciones / Causes & Solutions

**1. El backend .NET no esta corriendo**

```bash
# Verificar si el backend esta escuchando en el puerto 7264
ss -tlnp | grep 7264

# Si no hay nada escuchando, verificar la sesion screen
screen -r decatron-api

# Si la sesion no existe, reiniciar:
screen -S decatron-api
cd /var/www/html/decatron/Decatron/decatron
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"
```

**2. El frontend no esta corriendo (pagina en blanco pero API funciona)**

```bash
# Verificar si Vite esta escuchando en el puerto 5173
ss -tlnp | grep 5173

# Si no esta corriendo:
screen -r decatron-frontend
cd /var/www/html/decatron/Decatron/decatron/ClientApp
npm run dev -- --host 0.0.0.0 --port 5173
```

**3. nginx no esta corriendo o tiene error de configuracion**

```bash
# Verificar estado de nginx
sudo systemctl status nginx

# Si hay error de configuracion:
sudo nginx -t

# Corregir el error y recargar:
sudo systemctl reload nginx
```

**4. El backend se cayo por una excepcion no controlada**

```bash
# Revisar los ultimos logs
tail -50 /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt

# Buscar errores fatales
grep -i "fatal\|unhandled\|crash" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt
```

---

## Bot no conecta al chat de Twitch / Bot Not Connecting to Twitch Chat

### Sintomas / Symptoms

- El bot no responde a comandos en el chat
- No hay mensajes del bot en el chat de Twitch
- Error en logs: "Bot connection failed" o "Token validation failed"

### Causas y soluciones / Causes & Solutions

**1. Token del bot expirado o invalido**

```bash
# Buscar errores de token en los logs
grep -i "token\|refresh\|auth" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -20
```

Solucion: El sistema tiene un `BotTokenRefreshService` que refresca tokens automaticamente. Si falla:

```bash
# Verificar en la base de datos que los tokens del bot existen
sudo -u postgres psql -d decatron_prod -c "SELECT username, expires_at FROM bot_tokens;"
```

Si los tokens estan expirados y el refresh falla, el usuario debe re-autenticarse desde el dashboard web.

**2. Credenciales de Twitch incorrectas**

Verificar en `appsettings.Secrets.json`:
- `TwitchSettings:ClientId` coincide con tu app en [dev.twitch.tv](https://dev.twitch.tv)
- `TwitchSettings:ClientSecret` es el correcto
- `TwitchSettings:BotUsername` es exactamente el nombre de la cuenta del bot (case-sensitive en algunos casos)
- `TwitchSettings:ChannelId` es el ID numerico correcto del canal

**3. Scopes insuficientes**

Si el bot se conecta pero no puede enviar mensajes:

```bash
# Los scopes necesarios estan en appsettings.json:
# chat:read chat:edit channel:bot user:write:chat
# Verificar que el token del bot tiene estos scopes
```

Solucion: El streamer debe re-hacer el login desde el dashboard para obtener tokens con los scopes correctos.

**4. TwitchLib se desconecta silenciosamente**

El bot usa TwitchLib para IRC, que puede desconectarse sin error obvio. La reconexion automatica tiene backoff pero puede fallar si:
- Twitch esta en mantenimiento
- El rate limit de IRC se excedio (20 mensajes/30 segundos)
- La IP del servidor esta temporalmente baneada por Twitch

Solucion: Reiniciar el backend. Si persiste, esperar 15-30 minutos e intentar de nuevo.

**5. El bot se inicio con Task.Run (sin supervision)**

El bot de Twitch se lanza con `Task.Run()` en `Program.cs`, sin un `BackgroundService` supervisor. Si el bot falla, nadie lo reinicia automaticamente.

Solucion: Reiniciar el backend completo.

---

## Overlays no se actualizan / Overlays Not Updating (SignalR)

### Sintomas / Symptoms

- El overlay de OBS muestra datos desactualizados
- El timer no se actualiza en el overlay
- Los shoutouts no aparecen
- Las alertas de tips/eventos no se muestran

### Causas y soluciones / Causes & Solutions

**1. Conexion WebSocket perdida**

```bash
# Verificar que nginx tiene la configuracion correcta de WebSocket para /hubs/
# Debe tener estas lineas:
#   proxy_set_header Upgrade $http_upgrade;
#   proxy_set_header Connection "upgrade";
#   proxy_read_timeout 86400;
```

Revisar el archivo nginx:

```bash
cat /etc/nginx/sites-enabled/tu-dominio.conf | grep -A5 "location /hubs"
```

**2. El proxy_read_timeout es muy bajo**

SignalR mantiene conexiones abiertas por tiempo indefinido. Si `proxy_read_timeout` es menor a 86400 (24 horas), nginx cerrara la conexion.

```nginx
location /hubs/ {
    proxy_read_timeout 86400;  # 24 horas
    # ...
}
```

**3. El overlay no se unio al canal correcto**

Los clientes overlay deben llamar a `JoinChannel(channel)` para suscribirse al grupo `overlay_{channel}`. Si el canal es incorrecto, no recibiran actualizaciones.

Solucion: Verificar que la URL del overlay tiene el parametro `?channel=` correcto.

**4. El backend se reinicio y las conexiones se perdieron**

Cuando el backend se reinicia, todas las conexiones SignalR se cierran. Los clientes overlay deberian reconectarse automaticamente (tienen retry logic), pero a veces no funciona.

Solucion: Recargar la pagina del overlay en OBS (clic derecho -> "Refresh").

**5. SignalR Hub sin autenticacion**

El OverlayHub no requiere autenticacion. Cualquier cliente puede conectarse y unirse a cualquier grupo. Esto es por diseno (los overlays de OBS no tienen sesion), pero puede causar problemas si hay muchas conexiones espurias.

---

## Problemas de expiracion de tokens / Token Expiration Issues

### Sintomas / Symptoms

- Los usuarios son deslogueados frecuentemente
- Error "401 Unauthorized" en la consola del navegador
- "Token expired" en los logs

### Causas y soluciones / Causes & Solutions

**1. Token JWT del frontend expirado**

El token JWT dura `ExpiryMinutes` minutos (default: 60). Si el frontend no refresca el token a tiempo:

```bash
# Verificar configuracion
grep "ExpiryMinutes" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

Solucion: Aumentar `ExpiryMinutes` si es necesario (por ejemplo, a 120 o 240).

**2. Tokens de Twitch expirados**

Los tokens de Twitch duran ~4 horas. El sistema tiene dos background services que los refrescan:
- `UserTokenRefreshService` - Refresca tokens de usuarios
- `BotTokenRefreshService` - Refresca tokens del bot

```bash
# Verificar que los servicios de refresh estan corriendo
grep -i "token refresh" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -10
```

Si el refresh falla, el usuario debe re-hacer login desde el dashboard.

**3. Tokens de Spotify expirados**

Los tokens de Spotify duran 1 hora. El `NowPlayingBackgroundService` los refresca automaticamente cuando detecta un 401.

```bash
# Verificar errores de Spotify
grep -i "spotify" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | grep -i "error\|fail\|401"
```

**4. Cambio de hora del servidor**

Si la hora del servidor esta desincronizada, los tokens pueden parecer expirados o no expirados incorrectamente.

```bash
# Verificar hora del servidor
date

# Sincronizar con NTP
sudo timedatectl set-ntp true
```

---

## Errores de conexion a la base de datos / Database Connection Errors

### Sintomas / Symptoms

- Error 500 en cualquier endpoint
- "Npgsql.NpgsqlException" o "connection refused" en los logs
- La aplicacion no arranca

### Causas y soluciones / Causes & Solutions

**1. PostgreSQL no esta corriendo**

```bash
sudo systemctl status postgresql
# Si esta detenido:
sudo systemctl start postgresql
```

**2. Connection string incorrecta**

```bash
# Verificar que la base de datos existe
sudo -u postgres psql -l | grep decatron

# Verificar que el usuario puede conectarse
psql -h localhost -U decatron_user -d decatron_prod -c "SELECT 1;"
```

**3. Password incorrecto**

```bash
# Verificar el password en appsettings.Secrets.json
grep "DefaultConnection" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

**4. Limite de conexiones alcanzado**

```bash
# Ver conexiones activas
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Ver el limite
sudo -u postgres psql -c "SHOW max_connections;"

# Si hay muchas conexiones colgadas, reiniciar PostgreSQL:
sudo systemctl restart postgresql
```

**5. La base de datos esta corrupta o faltan tablas**

```bash
# Contar tablas
sudo -u postgres psql -d decatron_prod -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Deberian ser ~78 tablas. Si faltan, verificar las migraciones.
```

**6. Tablas con owner incorrecto**

Algunas tablas pueden haber sido creadas con el usuario `postgres` en vez de `decatron_user`:

```bash
# Ver tablas con owner diferente
sudo -u postgres psql -d decatron_prod -c "SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public' AND tableowner != 'decatron_user';"

# Cambiar owner si es necesario
sudo -u postgres psql -d decatron_prod -c "ALTER TABLE nombre_tabla OWNER TO decatron_user;"
```

---

## Problemas con PayPal/Tips / PayPal & Tips Issues

### Sintomas / Symptoms

- Error al conectar PayPal del streamer
- Los tips no se procesan
- "PayPal order creation failed" en logs
- El dinero no llega al streamer

### Causas y soluciones / Causes & Solutions

**1. Modo sandbox vs live**

```bash
# Verificar el modo actual
grep -A2 "PayPalSettings" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json | grep Mode
```

Si `Mode` es `sandbox`, los pagos son de prueba y no son reales. Para produccion debe ser `live`.

**2. Credenciales de PayPal invalidas**

- Verificar que `ClientId` / `ClientSecret` (sandbox) o `LiveClientId` / `LiveClientSecret` (live) son correctos en `appsettings.Secrets.json`
- Las credenciales se obtienen de [developer.paypal.com](https://developer.paypal.com)

**3. El callback de OAuth de PayPal falla**

```bash
# Verificar que la RedirectUri esta bien configurada
grep "RedirectUri" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json | grep -i paypal
```

La URI debe ser exactamente `https://tu-dominio.com/api/tips/paypal/callback` y coincidir con la configurada en la app de PayPal.

**4. Webhook de PayPal no verificado**

El endpoint `/api/tips/paypal/webhook` actualmente no verifica la firma de PayPal (hay un TODO en el codigo). Los webhooks funcionan pero no son seguros.

**5. El streamer no ha conectado su PayPal**

Los pagos van directamente al email de PayPal del streamer. Si no ha conectado su cuenta, el endpoint `/api/tips/page/{channelName}` retornara error.

```bash
# Verificar si el streamer tiene PayPal conectado
sudo -u postgres psql -d decatron_prod -c "SELECT user_id, paypal_email, paypal_connected FROM tips_configs WHERE user_id = <USER_ID>;"
```

---

## Problemas con Spotify/Now Playing / Spotify & Now Playing Issues

### Sintomas / Symptoms

- El overlay "Now Playing" no muestra la cancion
- Error al conectar Spotify
- "Spotify token refresh failed" en logs

### Causas y soluciones / Causes & Solutions

**1. Token de Spotify expirado y no se refresca**

```bash
# Verificar tokens en la base de datos
sudo -u postgres psql -d decatron_prod -c "SELECT user_id, provider, spotify_connected FROM now_playing_configs WHERE spotify_connected = true;"
```

**2. Credenciales de Spotify incorrectas**

Verificar en `appsettings.Secrets.json`:
- `SpotifySettings:ClientId`
- `SpotifySettings:ClientSecret`
- `SpotifySettings:RedirectUri` debe ser `https://tu-dominio.com/api/spotify/callback`

La RedirectUri debe estar registrada exactamente igual en el [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

**3. Cupos de Spotify agotados**

Spotify tiene un limite de 5 cupos para usuarios no-premium:

```bash
# Ver cupos asignados
sudo -u postgres psql -d decatron_prod -c "SELECT user_id, spotify_cupo_status FROM now_playing_configs WHERE spotify_cupo_status IS NOT NULL;"
```

**4. Last.fm no funciona (alternativa)**

Si se usa Last.fm en vez de Spotify:
- Verificar que `LastFmSettings:ApiKey` esta configurado
- Verificar que el username de Last.fm es correcto en la config del usuario
- **Nota:** Las llamadas se hacen por HTTP (no HTTPS). Si hay un firewall bloqueando HTTP saliente, fallara.

**5. El NowPlayingBackgroundService no esta corriendo**

```bash
# Verificar en logs
grep -i "NowPlaying\|now_playing" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -10
```

El servicio hace polling cada 3 segundos. Si no hay logs recientes, puede haberse detenido.

---

## Problemas con DecatronAI / DecatronAI Issues

### Sintomas / Symptoms

- El comando `!ia` no responde
- Error "API Key no configurada"
- Respuestas muy lentas o timeout

### Causas y soluciones / Causes & Solutions

**1. DecatronAI no esta habilitado globalmente**

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT enabled, primary_provider, primary_model FROM decatron_ai_global_config LIMIT 1;"
```

El admin debe habilitar DecatronAI desde `/admin/decatron-ai`.

**2. El canal no tiene permiso para usar IA**

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT channel_id, is_enabled FROM decatron_ai_channel_permissions;"
```

**3. API Key de Gemini invalida o expirada**

```bash
# Verificar configuracion
grep "GeminiSettings" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json

# Buscar errores en logs
grep -i "gemini\|ai.*error" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -10
```

**4. OpenRouter (fallback) tampoco funciona**

Si Gemini falla, el sistema intenta OpenRouter como fallback. Si ambos fallan:

```bash
grep "OpenRouterSettings" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
grep -i "openrouter" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -10
```

**5. Cooldown activo**

El comando `!ia` tiene cooldown por canal y por usuario. Si el usuario acaba de usar el comando, debe esperar el tiempo configurado.

---

## Problemas con TTS (AWS Polly) / TTS Issues

### Sintomas / Symptoms

- Las alertas de tips no reproducen audio TTS
- Error "Polly credentials not configured"
- Los archivos TTS no se generan en el cache

### Causas y soluciones / Causes & Solutions

**1. Credenciales de AWS no configuradas**

```bash
grep -A4 "AwsPolly" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

Si no hay credenciales, el sistema usa `AnonymousAWSCredentials` que fallara en cada llamada a Polly.

**2. Directorio de cache no existe o sin permisos**

```bash
# Verificar directorio de cache
ls -la /var/www/html/decatron/tts-cache/

# Si no existe:
mkdir -p /var/www/html/decatron/tts-cache
chmod 777 /var/www/html/decatron/tts-cache
```

**3. Region de AWS incorrecta**

El default es `us-east-1`. Si tu cuenta AWS tiene restricciones de region:

```json
{
    "AwsPolly": {
        "Region": "us-east-1"
    }
}
```

**4. Permisos IAM insuficientes**

El usuario IAM necesita al menos `polly:SynthesizeSpeech`. Verificar en la [consola IAM de AWS](https://console.aws.amazon.com/iam/).

---

## Problemas de login/autenticacion / Login & Authentication Issues

### Sintomas / Symptoms

- El boton "Login con Twitch" redirige pero no completa el login
- Error "Invalid state" o "Callback failed"
- El usuario queda en un loop de redireccion

### Causas y soluciones / Causes & Solutions

**1. RedirectUri no coincide**

La `RedirectUri` en `appsettings.Secrets.json` debe coincidir **exactamente** con la configurada en Twitch Developer Console:

```
https://tu-dominio.com/api/auth/callback
```

**2. ClientId o ClientSecret incorrecto**

```bash
grep -A3 "TwitchSettings" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json | head -5
```

Verificar contra [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps).

**3. FrontendUrl incorrecto (redireccion post-login falla)**

Despues del login, el backend redirige a `FrontendUrl` con el JWT en el query string. Si esta URL es incorrecta, el usuario no recibe el token.

```bash
grep "FrontendUrl" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

**4. El JWT se pierde en la URL**

El JWT se pasa como `?token=JWT` en la redireccion post-login. Si el navegador tiene extensiones que limpian URLs o si hay un proxy intermedio que elimina query strings, el token se perdera.

**5. Clave JWT demasiado corta**

```bash
# La clave debe tener al menos 32 caracteres
grep "SecretKey" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

Si la clave es demasiado corta, la generacion de tokens puede fallar silenciosamente.

---

## Referencia rapida de comandos / Quick Command Reference

### Diagnostico general / General Diagnostics

```bash
# Estado de todos los servicios
sudo systemctl status nginx postgresql
screen -ls
ss -tlnp | grep "7264\|5173\|5432\|80\|443"

# Ultimos errores en logs
grep -i "ERR\|error\|exception\|fatal" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -20

# Uso de disco (los logs y cache pueden crecer)
du -sh /var/www/html/decatron/Decatron/decatron/logs/
du -sh /var/www/html/decatron/tts-cache/

# Conexiones activas a la base de datos
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'decatron_prod';"
```

### Reinicio completo (nuclear) / Full Restart (Nuclear Option)

```bash
# 1. Detener todo
screen -S decatron-api -X quit 2>/dev/null
screen -S decatron-frontend -X quit 2>/dev/null

# 2. Reiniciar PostgreSQL
sudo systemctl restart postgresql

# 3. Reiniciar nginx
sudo systemctl restart nginx

# 4. Iniciar backend
screen -dmS decatron-api bash -c 'cd /var/www/html/decatron/Decatron/decatron && ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"'

# 5. Iniciar frontend
screen -dmS decatron-frontend bash -c 'cd /var/www/html/decatron/Decatron/decatron/ClientApp && npm run dev -- --host 0.0.0.0 --port 5173'

# 6. Verificar
sleep 5
screen -ls
curl -s -o /dev/null -w "%{http_code}" http://localhost:7264/api/auth/login
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

### Verificar estado de la base de datos / Database Health Check

```bash
# Verificar conexion
sudo -u postgres psql -d decatron_prod -c "SELECT 1;"

# Contar tablas
sudo -u postgres psql -d decatron_prod -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Ver tamano de la base de datos
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('decatron_prod'));"

# Ver las 5 tablas mas grandes
sudo -u postgres psql -d decatron_prod -c "SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid)) AS size FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 5;"

# Verificar usuarios activos
sudo -u postgres psql -d decatron_prod -c "SELECT count(*) FROM users;"

# Verificar tokens del bot
sudo -u postgres psql -d decatron_prod -c "SELECT username, expires_at, created_at FROM bot_tokens ORDER BY created_at DESC LIMIT 5;"
```

### Backup de emergencia / Emergency Backup

```bash
# Backup rapido
pg_dump -U decatron_user -h localhost decatron_prod > ~/emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# Verificar que el backup se creo
ls -la ~/emergency_backup_*.sql
```
