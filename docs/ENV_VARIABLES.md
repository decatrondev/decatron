# Variables de Entorno y Configuracion / Environment Variables & Configuration

Documentacion completa de todas las variables de configuracion del proyecto Decatron.

---

## Tabla de Contenidos

1. [Archivos de configuracion / Configuration Files](#archivos-de-configuracion--configuration-files)
2. [Variables de entorno del sistema / System Environment Variables](#variables-de-entorno-del-sistema--system-environment-variables)
3. [Template completo de appsettings.Secrets.json](#template-completo-de-appsettingssecretsjson)
4. [Base de datos / Database](#base-de-datos--database)
5. [Twitch](#twitch)
6. [JWT (Autenticacion) / JWT (Authentication)](#jwt-autenticacion--jwt-authentication)
7. [PayPal (Tips/Donaciones) / PayPal (Tips/Donations)](#paypal-tipsdonaciones--paypal-tipsdonations)
8. [PayPal Supporters](#paypal-supporters)
9. [Spotify (Now Playing)](#spotify-now-playing)
10. [Last.fm (Now Playing)](#lastfm-now-playing)
11. [Gemini (DecatronAI)](#gemini-decatronai)
12. [OpenRouter (DecatronAI/Chat)](#openrouter-decatronaichat)
13. [AWS Polly (TTS)](#aws-polly-tts)
14. [GachaVerse (Integracion)](#gachaverse-integracion)
15. [Configuracion publica (appsettings.json)](#configuracion-publica-appsettingsjson)
16. [CORS Origins](#cors-origins)
17. [Rutas fisicas / Physical Paths](#rutas-fisicas--physical-paths)

---

## Archivos de configuracion / Configuration Files

| Archivo | Proposito | En Git |
|---------|-----------|--------|
| `appsettings.json` | Config publica: logging, scopes de Twitch | Si |
| `appsettings.Secrets.json` | **Todos los secretos y credenciales** | **NO** |
| `appsettings.Secrets.json.example` | Template sin valores reales | Si |
| `appsettings.Staging.json` | Overrides para entorno staging | Depende |
| `appsettings.Secrets.Staging.json` | Secretos del entorno staging | **NO** |

**Prioridad de carga:** `appsettings.json` -> `appsettings.{Environment}.json` -> `appsettings.Secrets.json` -> Variables de entorno

---

## Variables de entorno del sistema / System Environment Variables

| Variable | Valor | Descripcion |
|----------|-------|-------------|
| `ASPNETCORE_ENVIRONMENT` | `Production` / `Development` / `Staging` | Determina que archivos de config se cargan y si Swagger esta disponible. **Production** deshabilita Swagger y mensajes de error detallados. |
| `ASPNETCORE_URLS` | `http://localhost:7264` | URL donde escucha Kestrel. Se puede pasar tambien con `--urls` al ejecutar. |

Ejemplo de uso:

```bash
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"
```

---

## Template completo de appsettings.Secrets.json

Este es el archivo completo con TODAS las claves posibles. Copiar como `appsettings.Secrets.json` y rellenar con valores reales:

```json
{
    "ConnectionStrings": {
        "DefaultConnection": "Host=localhost;Port=5432;Database=decatron_prod;Username=decatron_user;Password=TU_PASSWORD_DB",
        "GachaConnection": "Server=localhost;Port=3306;Database=gachaverse_db;Uid=tu_usuario;Password=TU_PASSWORD_MYSQL"
    },
    "TwitchSettings": {
        "ClientId": "tu_twitch_client_id",
        "ClientSecret": "tu_twitch_client_secret",
        "BotUsername": "nombre_de_tu_bot",
        "ChannelId": "tu_channel_id_numerico",
        "RedirectUri": "https://tu-dominio.com/api/auth/callback",
        "WebhookCallbackUrl": "https://tu-dominio.com/api/twitch/webhook",
        "WebhookSecret": "whsec_un_secreto_aleatorio_para_webhooks",
        "EventSubWebhookSecret": "whsec_un_secreto_aleatorio_para_eventsub",
        "FrontendUrl": "https://tu-dominio.com"
    },
    "JwtSettings": {
        "SecretKey": "CLAVE_ALEATORIA_DE_MINIMO_32_CARACTERES",
        "ExpiryMinutes": 60,
        "RefreshTokenExpiryDays": 7
    },
    "PayPalSettings": {
        "Mode": "live",
        "ClientId": "tu_paypal_sandbox_client_id",
        "ClientSecret": "tu_paypal_sandbox_client_secret",
        "LiveClientId": "tu_paypal_live_client_id",
        "LiveClientSecret": "tu_paypal_live_client_secret",
        "RedirectUri": "https://tu-dominio.com/api/tips/paypal/callback"
    },
    "SupportersPayPal": {
        "Mode": "live",
        "ClientId": "tu_paypal_sandbox_client_id",
        "ClientSecret": "tu_paypal_sandbox_client_secret",
        "LiveClientId": "tu_paypal_live_client_id",
        "LiveClientSecret": "tu_paypal_live_client_secret",
        "ReturnUrl": "https://tu-dominio.com/supporters",
        "CancelUrl": "https://tu-dominio.com/supporters"
    },
    "SpotifySettings": {
        "ClientId": "tu_spotify_client_id",
        "ClientSecret": "tu_spotify_client_secret",
        "RedirectUri": "https://tu-dominio.com/api/spotify/callback"
    },
    "LastFmSettings": {
        "ApiKey": "tu_lastfm_api_key",
        "SharedSecret": "tu_lastfm_shared_secret"
    },
    "GeminiSettings": {
        "ApiKey": "tu_google_gemini_api_key"
    },
    "OpenRouterSettings": {
        "ApiKey": "tu_openrouter_api_key"
    },
    "GachaSettings": {
        "WebUrl": "https://gacha.tu-dominio.com",
        "BotUsername": "nombre_de_tu_bot"
    },
    "AwsPolly": {
        "AccessKeyId": "tu_aws_access_key_id",
        "SecretAccessKey": "tu_aws_secret_access_key",
        "Region": "us-east-1",
        "CachePath": "/var/www/html/decatron/tts-cache"
    }
}
```

---

## Base de datos / Database

### ConnectionStrings:DefaultConnection (PostgreSQL)

| Parametro | Descripcion | Ejemplo |
|-----------|-------------|---------|
| `Host` | Servidor PostgreSQL | `localhost` |
| `Port` | Puerto PostgreSQL | `5432` |
| `Database` | Nombre de la base de datos | `decatron_prod` |
| `Username` | Usuario de PostgreSQL | `decatron_user` |
| `Password` | Contrasena del usuario | `tu_password_seguro` |

**Formato:** `Host=localhost;Port=5432;Database=decatron_prod;Username=decatron_user;Password=TU_PASSWORD`

**Requerido:** Si. Sin esta variable la aplicacion no arranca.

### ConnectionStrings:GachaConnection (MySQL - Opcional)

Solo necesario si usas la integracion con GachaVerse.

| Parametro | Descripcion | Ejemplo |
|-----------|-------------|---------|
| `Server` | Servidor MySQL | `localhost` |
| `Port` | Puerto MySQL | `3306` |
| `Database` | Base de datos GachaVerse | `gachaverse_db` |
| `Uid` | Usuario MySQL | `decatronuser` |
| `Password` | Contrasena MySQL | `tu_password` |

**Requerido:** No. Solo si se activa la integracion GachaVerse.

---

## Twitch

### TwitchSettings

| Clave | Tipo | Requerido | Descripcion | Donde obtenerlo |
|-------|------|-----------|-------------|-----------------|
| `ClientId` | string | **Si** | Client ID de tu aplicacion en Twitch Developer Console | [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) |
| `ClientSecret` | string | **Si** | Client Secret de la aplicacion | Twitch Developer Console |
| `BotUsername` | string | **Si** | Nombre de usuario de la cuenta del bot en Twitch | La cuenta de Twitch que usaras como bot |
| `ChannelId` | string | **Si** | ID numerico del canal principal del streamer | Usar la API de Twitch o [streamscharts.com](https://streamscharts.com) para obtenerlo |
| `RedirectUri` | string | **Si** | URI de callback para OAuth de Twitch. Debe coincidir exactamente con la configurada en Twitch Dev Console | `https://tu-dominio.com/api/auth/callback` |
| `WebhookCallbackUrl` | string | No | URL publica para recibir webhooks de Twitch | `https://tu-dominio.com/api/twitch/webhook` |
| `WebhookSecret` | string | No | Secreto compartido para verificar firmas de webhooks. Usar un string aleatorio de 20+ caracteres | Generado por ti |
| `EventSubWebhookSecret` | string | No | Secreto para verificar payloads de EventSub. Puede ser igual a WebhookSecret | Generado por ti |
| `FrontendUrl` | string | No | URL base del frontend React. Usado para redirecciones post-login | `https://tu-dominio.com` (default: `http://localhost:5173`) |

### Scopes de Twitch (en appsettings.json publico)

Los scopes se configuran en `appsettings.json` (no en Secrets):

```json
{
    "TwitchSettings": {
        "Scopes": "chat:read chat:edit clips:edit channel:bot channel:edit:commercial channel:manage:broadcast channel:manage:redemptions channel:read:editors channel:read:redemptions channel:read:subscriptions channel:read:vips moderation:read moderator:read:followers user:read:email user:edit:broadcast channel_editor user:manage:blocked_users user:write:chat bits:read channel:read:hype_train"
    }
}
```

Estos scopes deben coincidir con los configurados en la aplicacion de Twitch Developer Console.

---

## JWT (Autenticacion) / JWT (Authentication)

### JwtSettings

| Clave | Tipo | Requerido | Descripcion | Recomendacion |
|-------|------|-----------|-------------|---------------|
| `SecretKey` | string | **Si** | Clave secreta para firmar tokens JWT. **Minimo 32 caracteres.** | Generar con `openssl rand -base64 48` |
| `ExpiryMinutes` | int | **Si** | Duracion del token JWT de acceso en minutos | `60` (1 hora) |
| `RefreshTokenExpiryDays` | int | **Si** | Duracion del refresh token en dias | `7` (1 semana) |

**Nota de seguridad:** La clave JWT no debe contener informacion predecible. Usar un generador criptografico:

```bash
openssl rand -base64 48
```

**Nota tecnica:** La validacion de JWT en produccion tiene `ValidateIssuer = false` y `ValidateAudience = false`. Esto significa que cualquier token firmado con la misma clave sera aceptado independientemente del emisor o audiencia.

---

## PayPal (Tips/Donaciones) / PayPal (Tips/Donations)

### PayPalSettings

Configuracion para el sistema de tips/donaciones de los streamers. Los pagos van directamente al PayPal del streamer (no al tuyo).

| Clave | Tipo | Requerido | Descripcion | Donde obtenerlo |
|-------|------|-----------|-------------|-----------------|
| `Mode` | string | **Si** | `sandbox` para pruebas, `live` para produccion | Segun tu entorno |
| `ClientId` | string | **Si** | Client ID de PayPal **Sandbox** | [developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox) |
| `ClientSecret` | string | **Si** | Client Secret de PayPal **Sandbox** | PayPal Developer Dashboard |
| `LiveClientId` | string | **Si** (prod) | Client ID de PayPal **Live** | [developer.paypal.com](https://developer.paypal.com/dashboard/applications/live) |
| `LiveClientSecret` | string | **Si** (prod) | Client Secret de PayPal **Live** | PayPal Developer Dashboard |
| `RedirectUri` | string | **Si** | Callback para OAuth de PayPal cuando el streamer conecta su cuenta | `https://tu-dominio.com/api/tips/paypal/callback` |

**Como funciona:** Cuando un streamer conecta su PayPal, Decatron obtiene un OAuth token para crear ordenes de pago donde el `payee` es el email del streamer. El dinero va directo al streamer, no pasa por tu cuenta.

### SupportersPayPal

Configuracion separada para el sistema de supporters/suscripciones de la plataforma.

| Clave | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `Mode` | string | No | `sandbox` o `live` |
| `ClientId` | string | No | Client ID Sandbox |
| `ClientSecret` | string | No | Client Secret Sandbox |
| `LiveClientId` | string | No | Client ID Live |
| `LiveClientSecret` | string | No | Client Secret Live |
| `ReturnUrl` | string | No | URL a donde redirigir despues de un pago exitoso |
| `CancelUrl` | string | No | URL a donde redirigir si el usuario cancela el pago |

---

## Spotify (Now Playing)

### SpotifySettings

Para el overlay de "Now Playing" que muestra la cancion actual del streamer.

| Clave | Tipo | Requerido | Descripcion | Donde obtenerlo |
|-------|------|-----------|-------------|-----------------|
| `ClientId` | string | No* | Client ID de tu app de Spotify | [developer.spotify.com](https://developer.spotify.com/dashboard) |
| `ClientSecret` | string | No* | Client Secret de la app | Spotify Developer Dashboard |
| `RedirectUri` | string | No* | Callback de OAuth de Spotify | `https://tu-dominio.com/api/spotify/callback` |

*Requerido solo si se quiere usar la integracion con Spotify en el overlay Now Playing.

**Configuracion en Spotify Developer Dashboard:**
1. Crear una aplicacion en [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Agregar `https://tu-dominio.com/api/spotify/callback` como Redirect URI
3. Copiar Client ID y Client Secret

**Limitacion:** Spotify tiene un limite de 5 usuarios con cupos en modo gratuito, gestionado manualmente por el admin del sistema.

---

## Last.fm (Now Playing)

### LastFmSettings

Alternativa a Spotify para el overlay Now Playing. Funciona con cualquier reproductor que haga scrobbling a Last.fm.

| Clave | Tipo | Requerido | Descripcion | Donde obtenerlo |
|-------|------|-----------|-------------|-----------------|
| `ApiKey` | string | No* | API Key de Last.fm | [last.fm/api/account/create](https://www.last.fm/api/account/create) |
| `SharedSecret` | string | No* | Shared Secret de la API | Se genera junto con la API Key |

*Requerido solo si se quiere usar Last.fm como proveedor de Now Playing.

**Nota:** Las llamadas a la API de Last.fm se hacen via HTTP (no HTTPS) en el codigo actual. La API key viaja en texto plano. Esto es una vulnerabilidad conocida documentada en la auditoria.

---

## Gemini (DecatronAI)

### GeminiSettings

Proveedor primario de IA para el comando `!ia` en el chat de Twitch y para DecatronChat.

| Clave | Tipo | Requerido | Descripcion | Donde obtenerlo |
|-------|------|-----------|-------------|-----------------|
| `ApiKey` | string | No* | API Key de Google Gemini (AI Studio) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

*Requerido solo si se quiere usar DecatronAI. Gemini es el proveedor principal; OpenRouter es el fallback.

**Modelo por defecto:** Se configura en la tabla `decatron_ai_global_config` de la base de datos (no en appsettings). El admin lo cambia desde el panel web `/admin/decatron-ai`.

---

## OpenRouter (DecatronAI/Chat)

### OpenRouterSettings

Proveedor secundario/fallback de IA. Tambien usado por DecatronChat.

| Clave | Tipo | Requerido | Descripcion | Donde obtenerlo |
|-------|------|-----------|-------------|-----------------|
| `ApiKey` | string | No* | API Key de OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) |

*Requerido solo si se quiere usar IA con fallback o DecatronChat.

**Modelo por defecto para Chat:** `x-ai/grok-4.1-fast:free` (configurable en la base de datos).

---

## AWS Polly (TTS)

### AwsPolly

Text-to-Speech para alertas de tips y sound alerts.

| Clave | Tipo | Requerido | Descripcion | Donde obtenerlo |
|-------|------|-----------|-------------|-----------------|
| `AccessKeyId` | string | No* | AWS Access Key ID | [AWS IAM Console](https://console.aws.amazon.com/iam/) |
| `SecretAccessKey` | string | No* | AWS Secret Access Key | AWS IAM Console |
| `Region` | string | No | Region de AWS | Default: `us-east-1` |
| `CachePath` | string | No | Ruta donde se guardan los audios TTS generados | Default: `/var/www/html/decatron/tts-cache` |

*Requerido solo si se quiere usar TTS en alertas.

**Permisos IAM necesarios:** El usuario IAM necesita la politica `AmazonPollyReadOnlyAccess` o un custom policy con `polly:SynthesizeSpeech`.

**Nota:** Si las credenciales no estan configuradas, la aplicacion usa `AnonymousAWSCredentials` como fallback, lo cual fallara en runtime cuando se intente usar TTS.

---

## GachaVerse (Integracion)

### GachaSettings

Integracion con la plataforma GachaVerse para vincular cuentas.

| Clave | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `WebUrl` | string | No | URL de la instancia de GachaVerse. Default: `http://localhost:3000` |
| `BotUsername` | string | No | Username del bot en GachaVerse. Default: `decatronstreambot` |

**Nota:** La integracion GachaVerse tambien requiere `ConnectionStrings:GachaConnection` con acceso a MySQL.

---

## Configuracion publica (appsettings.json)

Estas variables estan en `appsettings.json` y no contienen secretos:

### Serilog (Logging)

```json
{
    "Serilog": {
        "MinimumLevel": {
            "Default": "Information",
            "Override": {
                "Microsoft": "Warning",
                "System": "Warning",
                "Microsoft.AspNetCore": "Warning"
            }
        },
        "WriteTo": [
            {
                "Name": "Console",
                "Args": {
                    "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}"
                }
            },
            {
                "Name": "File",
                "Args": {
                    "path": "logs/decatron-.txt",
                    "rollingInterval": "Day",
                    "fileSizeLimitBytes": 10485760,
                    "retainedFileCountLimit": 7
                }
            }
        ]
    }
}
```

| Clave | Descripcion |
|-------|-------------|
| `Serilog:MinimumLevel:Default` | Nivel minimo de log: `Verbose`, `Debug`, `Information`, `Warning`, `Error`, `Fatal` |
| `Serilog:WriteTo[1]:Args:path` | Ruta del archivo de log. El `-` al final es un placeholder para la fecha |
| `Serilog:WriteTo[1]:Args:rollingInterval` | Rotacion de logs: `Day` = un archivo por dia |
| `Serilog:WriteTo[1]:Args:fileSizeLimitBytes` | Tamano maximo por archivo: `10485760` = 10MB |
| `Serilog:WriteTo[1]:Args:retainedFileCountLimit` | Cuantos archivos de log conservar: `7` = una semana |

### Otros

| Clave | Valor | Descripcion |
|-------|-------|-------------|
| `AllowedHosts` | `*` | Hosts permitidos. `*` acepta todos |
| `Logging:LogLevel:Default` | `Information` | Nivel de log nativo de ASP.NET Core (Serilog lo sobreescribe) |

---

## CORS Origins

Los origenes CORS estan **hardcodeados** en `Program.cs` (no configurables via appsettings):

```
http://localhost:5173      <- Desarrollo local
https://twitch.decatron.net <- Produccion
https://decatron.net        <- Produccion
https://www.decatron.net    <- Produccion
```

Para agregar un nuevo origen, editar `Program.cs` en la seccion `AddCors` (lineas 93-97).

---

## Rutas fisicas / Physical Paths

Rutas de directorios usadas por la aplicacion (hardcodeadas o con default):

| Ruta | Proposito | Configurable |
|------|-----------|--------------|
| `ClientApp/public/downloads` | Clips de Twitch descargados | No |
| `ClientApp/public/uploads/soundalerts` | Archivos de sound alerts subidos por usuarios | No |
| `ClientApp/public/timerextensible` | Media del timer extensible (videos, imagenes) | No |
| `ClientApp/public/system-files` | Archivos del sistema | No |
| `/var/www/html/decatron/tts-cache` | Cache de audios TTS generados por AWS Polly | Si (`AwsPolly:CachePath`) |
| `logs/` | Archivos de log de Serilog | Si (`Serilog:WriteTo[1]:Args:path`) |

---

## Resumen de dependencias externas / External Dependencies Summary

| Servicio | Necesario para | Costo |
|----------|---------------|-------|
| PostgreSQL | Todo el sistema | Gratis |
| Twitch Developer App | Login, bot, EventSub | Gratis |
| PayPal Developer | Tips/donaciones | Gratis (PayPal cobra comision al streamer) |
| Spotify Developer | Overlay Now Playing | Gratis |
| Last.fm API | Overlay Now Playing (alternativa a Spotify) | Gratis |
| Google Gemini AI | DecatronAI (`!ia`) | Gratis con limites / Pago |
| OpenRouter | DecatronAI fallback + DecatronChat | Algunos modelos gratis / Pago |
| AWS Polly | Text-to-Speech en alertas | Pago (free tier: 5M chars/mes por 12 meses) |
| MySQL + GachaVerse | Integracion GachaVerse | Solo si usas GachaVerse |
