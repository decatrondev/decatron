# Guía de solución de problemas

> English: [../TROUBLESHOOTING.md](../TROUBLESHOOTING.md)

Guía práctica para diagnosticar y resolver los problemas más comunes de Decatron. Las rutas suponen que el proyecto está en `/var/www/html/decatron/Decatron/decatron`; ajústalas si el tuyo está en otro sitio.

---

## Contenido

1. [Cómo revisar los registros](#cómo-revisar-los-registros)
2. [Cómo reiniciar los servicios](#cómo-reiniciar-los-servicios)
3. [502 Bad Gateway](#502-bad-gateway)
4. [El bot no se conecta al chat de Twitch](#el-bot-no-se-conecta-al-chat-de-twitch)
5. [No llegan eventos de Twitch (EventSub)](#no-llegan-eventos-de-twitch-eventsub)
6. [Los overlays no se actualizan (SignalR)](#los-overlays-no-se-actualizan-signalr)
7. [Problemas de vencimiento de tokens](#problemas-de-vencimiento-de-tokens)
8. [Errores de conexión a la base de datos](#errores-de-conexión-a-la-base-de-datos)
9. [Problemas con PayPal y propinas](#problemas-con-paypal-y-propinas)
10. [Problemas con Spotify y Now Playing](#problemas-con-spotify-y-now-playing)
11. [Problemas con la IA](#problemas-con-la-ia)
12. [Problemas con TTS](#problemas-con-tts)
13. [Problemas de inicio de sesión y autenticación](#problemas-de-inicio-de-sesión-y-autenticación)
14. [Referencia rápida de comandos](#referencia-rápida-de-comandos)

---

## Cómo revisar los registros

### Ubicación de los registros

Los registros se escriben en `/var/www/html/decatron/Decatron/decatron/logs/`:

```bash
# Listar los archivos de registro disponibles
ls -la /var/www/html/decatron/Decatron/decatron/logs/

# Los archivos se llaman decatron-AAAAMMDD.txt, por ejemplo decatron-20261010.txt
```

### Ver los registros en tiempo real

```bash
# Seguir el registro actual
tail -f /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt

# Solo errores
tail -f /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | grep -i "ERR\|error\|exception"

# Un módulo concreto
tail -f /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | grep -i "twitch\|bot"
```

### Salida de la consola

Si el backend corre en una sesión de screen, los mismos registros aparecen en la consola:

```bash
screen -r decatron-api
# Los registros aparecen como: [HH:mm:ss LEV] Mensaje
# Ctrl+A, D para salir sin detenerlo
```

### Configuración de los registros

Los registros se configuran en `appsettings.json`:

- **Rotación:** un archivo por día
- **Tamaño máximo:** 50 MB por archivo (al alcanzarlo empieza uno nuevo)
- **Retención:** 14 archivos
- **Formato:** `[2026-10-10 14:30:00 INF] Mensaje`

Para obtener más detalle de forma temporal:

```json
{
    "Serilog": {
        "MinimumLevel": {
            "Default": "Debug"
        }
    }
}
```

Reinicia el backend después de cambiar la configuración de los registros. Pon la sobrescritura en `appsettings.Secrets.json` (o en un archivo de entorno) en lugar de editar el `appsettings.json` que se sube al repositorio.

---

## Cómo reiniciar los servicios

### Reiniciar el backend

```bash
# 1. Volver a la sesión de screen
screen -r decatron-api

# 2. Detener el proceso actual: Ctrl+C

# 3. Iniciarlo de nuevo
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"

# 4. Separar: Ctrl+A, luego D
```

### Frontend

El frontend es una compilación estática que sirve nginx: no hay ningún proceso que reiniciar. Si lo cambias, vuelve a compilar:

```bash
cd /var/www/html/decatron/Decatron/decatron/ClientApp
npm run build
```

### Reiniciar nginx

```bash
sudo systemctl reload nginx    # recarga la configuración sin detenerlo
sudo systemctl restart nginx   # reinicio completo
```

### Reiniciar PostgreSQL

```bash
sudo systemctl restart postgresql
```

### Si se perdió la sesión de screen

```bash
# Comprobar si hay sesiones existentes
screen -ls

# Si no hay ninguna, crear una nueva:
screen -S decatron-api
# Iniciar el backend...
# Ctrl+A, D
```

---

## 502 Bad Gateway

### Síntomas

- El navegador muestra el "502 Bad Gateway" de nginx
- La página no carga en absoluto, o carga pero la API no responde

### Causas y soluciones

**1. El backend .NET no está corriendo**

```bash
# Comprobar si el backend escucha en el puerto 7264
ss -tlnp | grep 7264

# Si nada escucha, revisar la sesión de screen
screen -r decatron-api

# Si la sesión no existe, iniciarla de nuevo:
screen -S decatron-api
cd /var/www/html/decatron/Decatron/decatron
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"
```

**2. Falta la compilación del frontend (página en blanco, 404 o 403 en `/`)**

```bash
# nginx sirve ClientApp/dist; comprueba que exista
ls /var/www/html/decatron/Decatron/decatron/ClientApp/dist/index.html

# Si no existe:
cd /var/www/html/decatron/Decatron/decatron/ClientApp
npm install && npm run build
```

**3. nginx no está corriendo o tiene un error de configuración**

```bash
sudo systemctl status nginx

# Si hay un error de configuración:
sudo nginx -t

# Corrígelo y recarga:
sudo systemctl reload nginx
```

**4. El backend se cayó por una excepción no controlada**

```bash
# Revisar los últimos registros
tail -50 /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt

# Buscar errores fatales
grep -i "fatal\|unhandled\|crash" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt
```

---

## El bot no se conecta al chat de Twitch

### Síntomas

- El bot no responde a los comandos en el chat
- No hay mensajes del bot en el chat de Twitch
- Errores en los registros como "IRC disconnected" o errores de token

### Causas y soluciones

**1. Token del bot vencido o inválido**

```bash
# Buscar errores de token en los registros
grep -i "token\|refresh\|auth" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -20
```

`BotTokenRefreshBackgroundService` renueva los tokens del bot automáticamente cada 30 minutos. Si falla, revisa la base de datos:

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT bot_username, token_expiration, is_active FROM bot_tokens;"
```

Si los tokens están vencidos y la renovación falla, la cuenta del bot debe autorizar de nuevo.

**2. Credenciales de Twitch incorrectas**

Revisa `appsettings.Secrets.json`:
- `TwitchSettings:ClientId` coincide con tu aplicación en la [consola de desarrolladores de Twitch](https://dev.twitch.tv/console/apps)
- `TwitchSettings:ClientSecret` es el correcto
- `TwitchSettings:BotUsername` es exactamente el nombre de la cuenta del bot
- `TwitchSettings:ChannelId` es el ID numérico correcto del canal

**3. Faltan scopes**

Si el bot se conecta pero no puede enviar mensajes, los scopes que se piden al iniciar sesión (`TwitchSettings:Scopes` en `appsettings.json`) deben incluir al menos `chat:read`, `chat:edit`, `channel:bot` y `user:write:chat`. Después de cambiar los scopes, la cuenta debe volver a iniciar sesión.

**4. TwitchLib se desconecta en silencio**

El bot usa TwitchLib para IRC. Tras una desconexión reintenta un número limitado de veces (3) y puede fallar cuando:
- Twitch está en mantenimiento
- Se superó el límite de mensajes de IRC
- La IP del servidor está bloqueada temporalmente por Twitch

Reinicia el backend. Si persiste, espera entre 15 y 30 minutos y vuelve a intentarlo.

**5. El bot se inicia con `Task.Run` (sin supervisor)**

El bot de Twitch se lanza con `Task.Run()` en `Program.cs`, no como un `BackgroundService`. Si se detiene, nada lo reinicia automáticamente: reinicia todo el backend.

---

## No llegan eventos de Twitch (EventSub)

### Síntomas

- Los follows, subs, bits, raids, canjes de puntos del canal o comandos de chat no disparan nada
- El bot está en el canal pero las alertas y los timers no reaccionan

### Causas y soluciones

EventSub funciona mediante un conduit con shards WebSocket (consulta [CONFIGURATION.md](CONFIGURATION.md#paso-4-eventsub-conduit)). El antiguo transporte webhook está apagado, así que un problema de webhook no es la causa.

```bash
# ¿Está creado el conduit y conectados los shards?
grep -i "conduit" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -20
```

**1. No se pudo crear el conduit.** Una línea del registro dice que no se pudo obtener ni crear el conduit y que el transporte WebSocket no arranca. Revisa `TwitchSettings:ClientId` y `ClientSecret` y reinicia el backend.

**2. Un shard está desconectado.** Líneas como "Shard N ... Desconectado" o "Reconectado por Twitch" muestran reconexiones de shards. Las desconexiones frecuentes suelen indicar problemas de red en el servidor.

**3. La cantidad de shards no coincide.** `EventSubSettings:ShardCount` se aplica al conduit existente cuando arranca el backend; si el registro dice que no se pudo escalar el conduit, se sigue usando la cantidad anterior de shards.

**4. El canal no tiene suscripciones.** Las suscripciones se crean cuando el streamer inicia sesión y para todos los usuarios activos cuando arranca el backend. Pide al streamer que vuelva a iniciar sesión, o reinicia el backend con el bot habilitado para ese canal.

---

## Los overlays no se actualizan (SignalR)

### Síntomas

- El overlay de OBS muestra datos desactualizados
- El timer no se actualiza en el overlay
- No aparecen los shoutouts, las alertas de propinas ni las alertas de eventos

### Causas y soluciones

**1. Se perdió la conexión WebSocket**

nginx debe reenviar las conexiones WebSocket de `/hubs/`. El bloque `location` necesita estas líneas:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400;
```

Revisa tu archivo:

```bash
grep -A12 "location /hubs" /etc/nginx/sites-enabled/tu-dominio.conf
```

**2. `proxy_read_timeout` es muy bajo**

SignalR mantiene las conexiones abiertas indefinidamente. Si `proxy_read_timeout` es menor que 86400 (24 horas), nginx cierra la conexión.

**3. El overlay no se unió al canal correcto**

Los clientes de overlay llaman a `JoinChannel(channel)` para suscribirse al grupo `overlay_{channel}`. Si el canal es incorrecto, no reciben actualizaciones. Comprueba que la URL del overlay tenga el parámetro `?channel=` correcto (copia la URL desde la página del módulo en el panel).

**4. El backend se reinició y se perdieron las conexiones**

Cuando el backend se reinicia, todas las conexiones de SignalR se cierran. Los overlays se reconectan solos, pero a veces no lo hacen: actualiza la fuente del overlay en OBS (clic derecho, Actualizar).

**5. El hub no necesita autenticación**

`OverlayHub` acepta a cualquier cliente, por diseño (las fuentes de navegador de OBS no tienen sesión). Muchas conexiones espurias pueden causar ruido, pero no datos incorrectos.

---

## Problemas de vencimiento de tokens

### Síntomas

- Los usuarios cierran sesión con frecuencia
- "401 Unauthorized" en la consola del navegador
- "Token expired" en los registros

### Causas y soluciones

**1. El JWT del panel venció**

El JWT dura `JwtSettings:ExpiryMinutes` minutos (60 en el ejemplo).

```bash
grep "ExpiryMinutes" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

Aumenta `ExpiryMinutes` si hace falta (por ejemplo a 120 o 240) y reinicia el backend.

**2. Tokens de Twitch vencidos**

Los tokens de acceso de Twitch duran unas horas. Dos servicios en segundo plano los renuevan: `UserTokenRefreshBackgroundService` (usuarios, y también los tokens de Kick) y `BotTokenRefreshBackgroundService` (el bot), ambos cada 30 minutos.

```bash
grep -i "token refresh\|TokenRefresh" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -10
```

Si la renovación falla, el usuario debe volver a iniciar sesión desde el panel.

**3. Tokens de Spotify vencidos**

```bash
grep -i "spotify" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | grep -i "error\|fail\|401"
```

Si la renovación falla, vuelve a conectar Spotify desde la página de Now Playing.

**4. Reloj del servidor desincronizado**

Si la hora del servidor es incorrecta, los tokens pueden parecer vencidos o no vencidos por error.

```bash
date
sudo timedatectl set-ntp true
```

---

## Errores de conexión a la base de datos

### Síntomas

- Error 500 en cualquier endpoint
- "Npgsql.NpgsqlException" o "connection refused" en los registros
- La aplicación no funciona

### Causas y soluciones

**1. PostgreSQL no está corriendo**

```bash
sudo systemctl status postgresql
# Si está detenido:
sudo systemctl start postgresql
```

**2. Cadena de conexión incorrecta**

```bash
# Comprobar que la base de datos existe
sudo -u postgres psql -l | grep decatron

# Comprobar que el usuario puede conectarse
psql -h localhost -U decatron_user -d decatron_prod -c "SELECT 1;"
```

**3. Contraseña incorrecta**

Revisa `ConnectionStrings:DefaultConnection` en `appsettings.Secrets.json`.

**4. Se alcanzó el límite de conexiones**

```bash
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
sudo -u postgres psql -c "SHOW max_connections;"

# Si hay muchas conexiones colgadas, reinicia PostgreSQL:
sudo systemctl restart postgresql
```

**5. Faltan tablas**

El backend no crea tablas. Si una función falla con "relation ... does not exist", no se aplicó el script SQL correspondiente.

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

En producción hay más de 240 tablas. Carga `Decatron.Data/Schema/baseline.sql` en una base vacía y aplica los scripts de `Decatron.Data/Migrations/` agregados después (consulta [DEPLOYMENT.md](DEPLOYMENT.md#crear-el-esquema)).

**6. Tablas con el propietario equivocado**

Algunas tablas pueden haberse creado con el usuario `postgres` en lugar de `decatron_user`:

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public' AND tableowner != 'decatron_user';"

# Cambiar el propietario si hace falta
sudo -u postgres psql -d decatron_prod -c "ALTER TABLE nombre_tabla OWNER TO decatron_user;"
```

---

## Problemas con PayPal y propinas

### Síntomas

- Error al conectar el PayPal del streamer
- Las propinas no se procesan
- "PayPal order creation failed" en los registros
- El dinero no llega al streamer

### Causas y soluciones

**1. Modo sandbox o live**

```bash
grep -A8 "PayPalSettings" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json | grep Mode
```

Si `Mode` es `sandbox`, los pagos son de prueba y no son reales. Para producción debe ser `live`.

**2. Credenciales de PayPal inválidas**

Revisa `ClientId` / `ClientSecret` (sandbox) o `LiveClientId` / `LiveClientSecret` (live) en `appsettings.Secrets.json`. Las credenciales se obtienen en [developer.paypal.com](https://developer.paypal.com).

**3. Falla el callback de OAuth de PayPal**

`PayPalSettings:RedirectUri` debe ser exactamente `https://tu-dominio.com/api/tips/paypal/callback` y coincidir con la configurada en la aplicación de PayPal.

**4. Sobre el webhook de PayPal**

`POST /api/tips/paypal/webhook` responde 401 cuando faltan las cabeceras de firma de PayPal, pero no las verifica criptográficamente; solo confirma el evento. El pago en sí lo completa `POST /api/tips/paypal/capture-order`, así que un webhook que falla no detiene las propinas.

**5. El streamer no conectó su PayPal**

Los pagos van al correo de PayPal del streamer. Si la cuenta no está conectada, el endpoint de la página de donación devuelve un error.

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT user_id, paypal_email, paypal_connected FROM tips_configs WHERE user_id = <ID_DE_USUARIO>;"
```

---

## Problemas con Spotify y Now Playing

### Síntomas

- El overlay de Now Playing no muestra la canción
- Error al conectar Spotify
- "Spotify token refresh failed" en los registros

### Causas y soluciones

**1. Cupo de Spotify sin asignar o token vencido**

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT user_id, provider, spotify_slot_assigned, spotify_token_expires_at FROM now_playing_configs WHERE provider = 'spotify';"
```

**2. Credenciales de Spotify incorrectas**

Revisa en `appsettings.Secrets.json`:
- `SpotifySettings:ClientId`
- `SpotifySettings:ClientSecret`
- `SpotifySettings:RedirectUri`, que debe ser `https://tu-dominio.com/api/spotify/callback` y estar registrada exactamente igual en el [panel de desarrolladores de Spotify](https://developer.spotify.com/dashboard)

**3. Cupos de Spotify agotados**

Spotify está limitado a 5 cupos para usuarios no premium; el resto espera en una lista.

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT user_id, spotify_slot_requested, spotify_slot_assigned FROM now_playing_configs WHERE spotify_slot_requested = true;"
```

**4. Last.fm no funciona (proveedor alternativo)**

- Comprueba que `LastFmSettings:ApiKey` esté definido
- Comprueba que el usuario de Last.fm sea correcto en la configuración del usuario
- Las llamadas usan HTTP simple (`http://ws.audioscrobbler.com`); un firewall que bloquee el HTTP saliente las rompe

**5. El servicio de consulta no está corriendo**

```bash
grep -i "NowPlaying" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -10
```

`NowPlayingBackgroundService` revisa cada 3 segundos. Si no hay líneas recientes en el registro, reinicia el backend.

---

## Problemas con la IA

### Síntomas

- El comando `!ia` no responde
- Errores por falta de API key
- Respuestas muy lentas o tiempos de espera agotados

### Causas y soluciones

**1. La IA no está habilitada globalmente**

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT enabled, ai_provider, model, fallback_enabled FROM decatron_ai_global_config LIMIT 1;"
```

El administrador de la plataforma la habilita y configura desde el panel de administración.

**2. El canal no tiene permiso para usar la IA**

```bash
sudo -u postgres psql -d decatron_prod -c "SELECT user_id, channel_name, enabled FROM decatron_ai_channel_permissions;"
```

**3. API key de Gemini inválida o vencida**

```bash
grep -c "GeminiSettings" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
grep -i "gemini\|ai.*error" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -10
```

**4. OpenRouter (respaldo) tampoco funciona**

Si el proveedor principal falla y el respaldo está habilitado, el sistema prueba OpenRouter. Si fallan los dos:

```bash
grep -c "OpenRouterSettings" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
grep -i "openrouter" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -10
```

**5. Tiempo de espera activo**

`!ia` tiene un tiempo de espera por canal y por usuario. Quien acaba de usarlo debe esperar.

**6. Créditos insuficientes**

Las funciones de IA de pago descuentan créditos (`AiCreditGate`). Si la cuenta no tiene, se rechazan las solicitudes.

---

## Problemas con TTS

### Síntomas

- Las alertas no reproducen el audio de TTS
- "Polly credentials not configured"
- No se generan archivos de TTS en la caché

### Causas y soluciones

**1. Credenciales de AWS sin configurar**

```bash
grep -c "AwsPolly" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

Sin credenciales el sistema usa credenciales anónimas de AWS, que fallan en cada llamada a Polly; las funciones que usan TTS lo omiten.

**2. El directorio de la caché no existe o no tiene permisos**

```bash
ls -la /var/www/html/decatron/tts-cache/

# Si no existe:
mkdir -p /var/www/html/decatron/tts-cache
chown www-data:www-data /var/www/html/decatron/tts-cache   # el usuario que ejecuta el backend
```

**3. Región de AWS incorrecta**

La región por defecto es `us-east-1`. Si tu cuenta de AWS tiene restricciones de región:

```json
{
    "AwsPolly": {
        "Region": "us-east-1"
    }
}
```

**4. Permisos de IAM insuficientes**

El usuario de IAM necesita al menos `polly:SynthesizeSpeech` (y `polly:DescribeVoices` para el catálogo de voces). Revisa la [consola de IAM de AWS](https://console.aws.amazon.com/iam/).

---

## Problemas de inicio de sesión y autenticación

### Síntomas

- El botón "Iniciar sesión con Twitch" redirige pero no completa el inicio de sesión
- "Invalid or expired login session" o "Callback failed"
- El usuario queda en un bucle de redirecciones

### Causas y soluciones

**1. `RedirectUri` no coincide**

`TwitchSettings:RedirectUri` debe coincidir **exactamente** con la de la consola de desarrolladores de Twitch:

```
https://tu-dominio.com/api/auth/callback
```

**2. `ClientId` o `ClientSecret` incorrectos**

Compáralos con [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps).

**3. `FrontendUrl` incorrecta**

Tras iniciar sesión, el backend redirige a `{FrontendUrl}/login?code=...`. Si esta URL es incorrecta, el navegador nunca recibe el código.

```bash
grep "FrontendUrl" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

**4. El código de un solo uso venció**

El backend conserva el JWT en memoria 60 segundos detrás de un código de un solo uso; el frontend lo cambia con `POST /api/auth/exchange`. Si el navegador es lento, una extensión lo bloquea o el backend se reinició entre medias, el intercambio responde 401 ("Invalid or expired code"). Basta con iniciar sesión de nuevo.

**5. Clave JWT demasiado corta**

```bash
# La clave debe tener al menos 32 caracteres
grep "SecretKey" /var/www/html/decatron/Decatron/decatron/appsettings.Secrets.json
```

**6. Inicio de sesión con Kick o Discord**

Los inicios de sesión de Kick y Discord siguen el mismo flujo con sus propios ajustes (`KickSettings`, `DiscordSettings`): revisa también allí las URI de redirección.

---

## Referencia rápida de comandos

### Diagnóstico general

```bash
# Estado de los servicios
sudo systemctl status nginx postgresql
screen -ls
ss -tlnp | grep "7264\|5432\|80\|443"

# Últimos errores en los registros
grep -i "ERR\|error\|exception\|fatal" /var/www/html/decatron/Decatron/decatron/logs/decatron-$(date +%Y%m%d).txt | tail -20

# Uso de disco (los registros y la caché de TTS pueden crecer)
du -sh /var/www/html/decatron/Decatron/decatron/logs/
du -sh /var/www/html/decatron/tts-cache/

# Conexiones activas a la base de datos
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'decatron_prod';"
```

### Reinicio completo

```bash
# 1. Detener el backend
screen -S decatron-api -X quit 2>/dev/null

# 2. Reiniciar PostgreSQL
sudo systemctl restart postgresql

# 3. Reiniciar nginx
sudo systemctl restart nginx

# 4. Iniciar el backend
screen -dmS decatron-api bash -c 'cd /var/www/html/decatron/Decatron/decatron && ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"'

# 5. Verificar
sleep 10
screen -ls
curl -s -o /dev/null -w "%{http_code}" http://localhost:7264/api/oauth/scopes
curl -s -o /dev/null -w "%{http_code}" https://TU_DOMINIO
```

### Verificación de la base de datos

```bash
# Comprobar la conexión
sudo -u postgres psql -d decatron_prod -c "SELECT 1;"

# Contar las tablas
sudo -u postgres psql -d decatron_prod -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Tamaño de la base de datos
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('decatron_prod'));"

# Las 5 tablas más grandes
sudo -u postgres psql -d decatron_prod -c "SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid)) AS size FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 5;"

# Cantidad de usuarios
sudo -u postgres psql -d decatron_prod -c "SELECT count(*) FROM users;"

# Tokens del bot
sudo -u postgres psql -d decatron_prod -c "SELECT bot_username, token_expiration, created_at FROM bot_tokens ORDER BY created_at DESC LIMIT 5;"
```

### Copia de seguridad de emergencia

```bash
# Copia rápida
pg_dump -U decatron_user -h localhost decatron_prod > ~/emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# Comprobar que se creó
ls -la ~/emergency_backup_*.sql
```
