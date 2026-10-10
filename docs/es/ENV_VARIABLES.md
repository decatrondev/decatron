# Variables de entorno y ajustes

> English: [../ENV_VARIABLES.md](../ENV_VARIABLES.md)

Referencia de todos los ajustes que lee el backend de Decatron. Los ajustes son claves de configuración normales de ASP.NET Core: `Seccion:Clave` en el código, variables de entorno (`Seccion__Clave`) o `"Seccion": { "Clave": ... }` anidado en los archivos JSON. Para una guía por tareas (configuración de Twitch, base de datos, registros) consulta [CONFIGURATION.md](CONFIGURATION.md).

Esta página lista nombres, tipos y valores por defecto tomados del código. Los valores reales nunca van en el repositorio.

---

## Contenido

1. [Archivos de configuración y orden de carga](#archivos-de-configuración-y-orden-de-carga)
2. [Variables de entorno del sistema](#variables-de-entorno-del-sistema)
3. [Archivo de secretos mínimo](#archivo-de-secretos-mínimo)
4. [Base de datos](#base-de-datos)
5. [Twitch](#twitch)
6. [JWT](#jwt)
7. [Kick](#kick)
8. [Discord](#discord)
9. [Pagos: PayPal y Culqi](#pagos-paypal-y-culqi)
10. [Música: Spotify y Last.fm](#música-spotify-y-lastfm)
11. [Proveedores de IA](#proveedores-de-ia)
12. [Texto a voz y reconocimiento de voz](#texto-a-voz-y-reconocimiento-de-voz)
13. [Traducción en vivo](#traducción-en-vivo)
14. [Juegos: Riot, Epic y Fortnite](#juegos-riot-epic-y-fortnite)
15. [Song Request, torneos, cartas, emotes y marca](#song-request-torneos-cartas-emotes-y-marca)
16. [Correo y facturación](#correo-y-facturación)
17. [Ajustes públicos en appsettings.json](#ajustes-públicos-en-appsettingsjson)
18. [Orígenes CORS](#orígenes-cors)
19. [Rutas físicas](#rutas-físicas)
20. [Resumen de servicios externos](#resumen-de-servicios-externos)

---

## Archivos de configuración y orden de carga

| Archivo | Propósito | En Git |
|---------|-----------|--------|
| `appsettings.json` | Ajustes públicos: registros, scopes de Twitch, valores por defecto de módulos | Sí |
| `appsettings.{Environment}.json` | Sobrescrituras estándar de ASP.NET Core por entorno | A tu criterio |
| `appsettings.Secrets.json` | **Todos los secretos y credenciales** | **No** |
| `appsettings.Secrets.{Environment}.json` | Secretos de un entorno (por ejemplo `appsettings.Secrets.Staging.json`) | **No** |
| `appsettings.Secrets.json.example` | Plantilla con las claves mínimas y sin valores reales | Sí |

`Program.cs` agrega los dos archivos `appsettings.Secrets*` (opcionales, se recargan al cambiar) después de las fuentes de configuración por defecto, así que cuando la misma clave aparece en varios sitios **gana la fuente posterior**. De menor a mayor prioridad: `appsettings.json`, `appsettings.{Environment}.json`, secretos de usuario (solo en Development), variables de entorno, argumentos de línea de comandos, `appsettings.Secrets.json`, `appsettings.Secrets.{Environment}.json`.

---

## Variables de entorno del sistema

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `ASPNETCORE_ENVIRONMENT` | `Production`, `Development`, `Staging` | Selecciona los archivos por entorno y habilita Swagger (`/swagger`) solo en `Development`. |
| `ASPNETCORE_URLS` | por ejemplo `http://localhost:7264` | Dirección en la que escucha Kestrel. `--urls` en la línea de comandos hace lo mismo. |

```bash
ASPNETCORE_ENVIRONMENT=Production dotnet run --urls "http://localhost:7264"
```

---

## Archivo de secretos mínimo

`appsettings.Secrets.json.example` contiene solo este mínimo. Todo lo demás es opcional y depende de los módulos que habilites.

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=decatron;Username=decatron_user;Password=TU_CONTRASEÑA"
  },
  "TwitchSettings": {
    "ClientId": "tu_twitch_client_id",
    "ClientSecret": "tu_twitch_client_secret",
    "BotUsername": "nombre_de_tu_bot",
    "ChannelId": "tu_id_numerico_de_canal",
    "RedirectUri": "https://tu-dominio.com/api/auth/callback",
    "FrontendUrl": "https://tu-dominio.com"
  },
  "JwtSettings": {
    "SecretKey": "CLAVE_ALEATORIA_DE_AL_MENOS_32_CARACTERES",
    "ExpiryMinutes": 60,
    "RefreshTokenExpiryDays": 7
  }
}
```

---

## Base de datos

### `ConnectionStrings:DefaultConnection` (PostgreSQL)

Obligatoria. Sin ella el contexto de base de datos no se registra y la aplicación no puede funcionar.

```
Host=localhost;Port=5432;Database=decatron;Username=decatron_user;Password=TU_CONTRASEÑA
```

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `Host` | Servidor PostgreSQL | `localhost` |
| `Port` | Puerto de PostgreSQL | `5432` |
| `Database` | Nombre de la base de datos | `decatron` |
| `Username` | Usuario de la base de datos | `decatron_user` |
| `Password` | Contraseña del usuario | |

El esquema no se crea automáticamente. Carga `Decatron.Data/Schema/baseline.sql` en una base vacía y aplica los scripts posteriores de `Decatron.Data/Migrations/` (consulta [CONFIGURATION.md](CONFIGURATION.md#configuración-de-la-base-de-datos)).

### `ConnectionStrings:GachaConnection` (MySQL, opcional)

La usan solo los endpoints de vinculación de cuentas de GachaVerse (`GachaAuthController`). Sin ella esos endpoints registran un error y el resto de la aplicación no se ve afectado.

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `Server` | Servidor MySQL | `localhost` |
| `Port` | Puerto de MySQL | `3306` |
| `Database` | Base de datos de GachaVerse | `gachaverse_db` |
| `Uid` | Usuario de MySQL | |
| `Password` | Contraseña de MySQL | |

### `GachaSettings`

| Clave | Tipo | Por defecto | Descripción |
|-------|------|-------------|-------------|
| `WebUrl` | string | `http://localhost:3000` | URL de la instancia de GachaVerse |
| `BotUsername` | string | `decatronstreambot` | Usuario del bot que se muestra en GachaVerse |

---

## Twitch

### `TwitchSettings`

| Clave | Tipo | Obligatoria | Descripción |
|-------|------|-------------|-------------|
| `ClientId` | string | **Sí** | Client ID de tu aplicación en la [consola de desarrolladores de Twitch](https://dev.twitch.tv/console/apps) |
| `ClientSecret` | string | **Sí** | Client Secret de esa aplicación |
| `BotUsername` | string | **Sí** | Usuario de la cuenta de Twitch del bot |
| `ChannelId` | string | **Sí** | ID numérico de Twitch del canal principal. El bot se une a él por defecto |
| `RedirectUri` | string | **Sí** | Callback de OAuth. Debe coincidir exactamente con la consola, por ejemplo `https://tu-dominio.com/api/auth/callback` |
| `FrontendUrl` | string | No | URL base de la app React, usada en las redirecciones tras iniciar sesión. Por defecto `http://localhost:5173` |
| `Scopes` | string | **Sí** (en `appsettings.json`) | Scopes de Twitch separados por espacios que se piden al iniciar sesión. Ya está definido en `appsettings.json` |
| `WebhookCallbackUrl` | string | No | Heredada: URL pública para los callbacks de webhook de EventSub. Solo se lee cuando se crea una suscripción con el transporte webhook, que está apagado |
| `WebhookSecret` | string | No | Heredada: secreto HMAC del transporte webhook. Misma condición |

Notas:

- Los tokens OAuth de la cuenta del bot se guardan en la tabla `bot_tokens` y se renuevan en segundo plano. `TwitchSettings` tiene las propiedades `BotToken`, `EventSubWebhookSecret`, `EventSubWebhookUrl` y `EventSubWebhookPort`, pero el código no las lee.
- EventSub funciona con un conduit de shards WebSocket (`EventSubSettings:ShardCount`); no hace falta una URL pública de webhook. Consulta [CONFIGURATION.md](CONFIGURATION.md#paso-4-eventsub-conduit).
- `Twitch:ClientId` y `Twitch:ClientSecret` (sin "Settings") los leen las variables de script que llaman a la API de Twitch (`TwitchInfoVariables`). Ponles los mismos valores si usas esas variables.

### Scopes

Definidos en `appsettings.json`:

```
chat:read chat:edit clips:edit channel:bot channel:edit:commercial channel:manage:broadcast channel:manage:redemptions channel:manage:moderators channel:read:editors channel:read:redemptions channel:read:subscriptions channel:read:vips moderation:read moderator:read:followers user:read:email user:edit:broadcast channel_editor user:manage:blocked_users user:write:chat bits:read channel:read:hype_train
```

Los scopes que pidas deben estar permitidos para la aplicación en la consola de Twitch, y los streamers deben volver a iniciar sesión para conceder cualquier scope que agregues.

### `EventSubSettings`

| Clave | Tipo | Por defecto | Descripción |
|-------|------|-------------|-------------|
| `ShardCount` | int | `1` | Cantidad de shards WebSocket del conduit de EventSub |

---

## JWT

### `JwtSettings`

| Clave | Tipo | Obligatoria | Descripción | Recomendación |
|-------|------|-------------|-------------|---------------|
| `SecretKey` | string | **Sí** | Clave con la que se firman los JWT. Al menos 32 caracteres. El backend se niega a iniciar sin ella | `openssl rand -base64 48` |
| `ExpiryMinutes` | int | **Sí** | Duración del token de acceso, en minutos | `60` |
| `RefreshTokenExpiryDays` | int | **Sí** | Duración del refresh token, en días | `7` |

La validación del token comprueba la firma y la vigencia (5 minutos de tolerancia de reloj). El emisor y la audiencia **no** se validan, así que se acepta cualquier token firmado con la misma clave.

---

## Kick

### `KickSettings`

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `ClientId` | string | Client ID de tu aplicación de Kick |
| `ClientSecret` | string | Client Secret |
| `RedirectUri` | string | Callback de OAuth |
| `WebhookUrl` | string | URL pública a la que Kick envía los eventos de webhook |
| `Scopes` | string | Scopes de Kick separados por espacios que se solicitan |

Solo es obligatoria si habilitas el inicio de sesión con Kick y los módulos basados en Kick.

---

## Discord

### `DiscordSettings`

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `BotToken` | string | Token del bot de Discord |
| `AppId` | string | ID de la aplicación |
| `ClientSecret` | string | Secreto de cliente de OAuth |
| `RedirectUri` | string | Callback usado para vincular una cuenta de Discord |
| `LoginRedirectUri` | string | Callback usado para iniciar sesión con Discord |
| `FrontendUrl` | string | URL base del frontend. Por defecto `https://twitch.decatron.net` (configura la tuya) |

Solo es obligatoria si ejecutas el bot de Discord (comandos slash, niveles, imágenes de bienvenida, alertas de directo).

---

## Pagos: PayPal y Culqi

### `PayPalSettings` (propinas y donaciones)

Las donaciones van directamente a la cuenta de PayPal del streamer: Decatron crea la orden con el streamer como `payee`.

| Clave | Tipo | Obligatoria | Descripción |
|-------|------|-------------|-------------|
| `Mode` | string | Sí | `sandbox` para pruebas, `live` para producción |
| `ClientId` | string | Sí | Client ID de sandbox ([panel de desarrolladores de PayPal](https://developer.paypal.com/dashboard/applications/sandbox)) |
| `ClientSecret` | string | Sí | Client Secret de sandbox |
| `LiveClientId` | string | Sí (producción) | Client ID de producción |
| `LiveClientSecret` | string | Sí (producción) | Client Secret de producción |
| `RedirectUri` | string | Sí | Callback cuando un streamer conecta su PayPal, por ejemplo `https://tu-dominio.com/api/tips/paypal/callback` |

### `SupportersPayPal` (compras de tier)

Las mismas claves de arriba, leídas por el controlador de Supporters, más:

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `ReturnUrl` | string | A dónde enviar al usuario tras un pago exitoso |
| `CancelUrl` | string | A dónde enviar al usuario si cancela |

### `CulqiSettings` y `CulqiSettingsTest` (pagos con tarjeta de paquetes de créditos)

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `PublicKey` | string | Llave pública de Culqi |
| `SecretKey` | string | Llave secreta de Culqi |

`CulqiSettings` contiene las llaves de producción y `CulqiSettingsTest` las de prueba; cuál se usa depende del modo de pago que gestiona `PaymentModeService`.

---

## Música: Spotify y Last.fm

### `SpotifySettings` (Now Playing)

| Clave | Tipo | Obligatoria | Descripción |
|-------|------|-------------|-------------|
| `ClientId` | string | Solo para Spotify | Client ID del [panel de Spotify](https://developer.spotify.com/dashboard) |
| `ClientSecret` | string | Solo para Spotify | Client Secret |
| `RedirectUri` | string | Solo para Spotify | Callback de OAuth, por ejemplo `https://tu-dominio.com/api/spotify/callback`. Agrégalo a los Redirect URIs de la aplicación |

El código limita a 5 los cupos de Spotify para usuarios no premium (`MaxSpotifyUsers`), de acuerdo con el límite de usuarios del panel de Spotify para aplicaciones en modo de desarrollo, y mantiene una lista de espera de cupos.

### `LastFmSettings`

| Clave | Tipo | Obligatoria | Descripción |
|-------|------|-------------|-------------|
| `ApiKey` | string | Solo para Last.fm | API key de [last.fm/api/account/create](https://www.last.fm/api/account/create) |

Last.fm funciona con cualquier reproductor que haga scrobbling a Last.fm. El código llama a la API de Last.fm por HTTP simple (`http://ws.audioscrobbler.com`) y la API key va en la cadena de consulta.

---

## Proveedores de IA

El proveedor y el modelo que usa cada función se guardan en la base de datos (`decatron_ai_global_config`) y se editan desde el panel de administración, no en los archivos de ajustes. Los archivos solo contienen las claves.

| Sección | Clave | Descripción |
|---------|-------|-------------|
| `GeminiSettings` | `ApiKey` | API key de Google Gemini ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) |
| `OpenRouterSettings` | `ApiKey` | API key de OpenRouter ([openrouter.ai/keys](https://openrouter.ai/keys)) |

Solo son obligatorias si usas `!ia`, el chat privado con IA u otras funciones de IA.

---

## Texto a voz y reconocimiento de voz

### `AwsPolly`

| Clave | Tipo | Por defecto | Descripción |
|-------|------|-------------|-------------|
| `AccessKeyId` | string | | ID de la llave de acceso de AWS |
| `SecretAccessKey` | string | | Llave secreta de AWS |
| `Region` | string | `us-east-1` | Región de AWS |
| `CachePath` | string | `/var/www/html/decatron/tts-cache` | Carpeta de los audios generados; se sirve en `/tts-audio` |

El usuario IAM necesita `polly:SynthesizeSpeech` (por ejemplo la política `AmazonPollyReadOnlyAccess`). Sin credenciales la aplicación inicia con credenciales anónimas y las llamadas de TTS fallan en ejecución; las funciones que usan TTS lo omiten.

### `TtsSettings`

| Clave | Tipo | Por defecto | Descripción |
|-------|------|-------------|-------------|
| `CachePath` | string | `/var/www/html/decatron/tts-cache` | Ruta de caché que se lee al iniciar para el mapeo de `/tts-audio` |

### `Deepgram` y `FishAudio`

| Clave | Tipo | Por defecto | Descripción |
|-------|------|-------------|-------------|
| `Deepgram:ApiKey` | string | | Llave de Deepgram (reconocimiento de voz y TTS Aura) usada por la traducción en vivo |
| `FishAudio:ApiKey` | string | | Llave de FishAudio (motor de TTS de la traducción en vivo) |
| `FishAudio:Model` | string | `s1` | Modelo de FishAudio |

---

## Traducción en vivo

La sección `LiveTranslation` de `appsettings.json` contiene los límites y los tiempos del cliente (`SttModel`, `GeminiFallbackModel`, `SttCreditsPerSecond`, `MaxConcurrentChannels`, `MaxLanguagesPerChannel`, `LinkCodeMinutes`, `SmartSegmentation`, `ClientTuning`, ...). La clase que la enlaza es `LiveTranslationOptions`. La sección se recarga sin reiniciar el backend. El vínculo con el escritorio usa `DesktopOptions`.

---

## Juegos: Riot, Epic y Fortnite

| Sección | Clave | Por defecto | Descripción |
|---------|-------|-------------|-------------|
| `RiotApi` | `PlatformApiKey` | | Llave de Riot para League of Legends |
| `RiotApi` | `TftApiKey` | | Llave de Riot para Teamfight Tactics |
| `RiotApi` | `ValorantApiKey` | | Llave de Riot para Valorant |
| `EpicSettings` | `ClientId`, `ClientSecret` | | Aplicación OAuth de Epic Games |
| `EpicSettings` | `RedirectUri` | `https://decatron.net/api/auth/epic/callback` | Callback de OAuth de Epic (configura tu propio dominio) |
| `EpicSettings` | `Scopes` | `basic_profile friends_list country presence` | Scopes de Epic |
| `Fortnite` | `CurrentSeason` | `Unknown` | Etiqueta de la temporada que usan los módulos de Fortnite |

Una llave de Riot ausente se trata como no configurada para ese juego.

---

## Song Request, torneos, cartas, emotes y marca

| Clave | Por defecto | Descripción |
|-------|-------------|-------------|
| `SongRequest:YtDlpPath` | `yt-dlp` | Comando o ruta del binario yt-dlp usado para resolver medios |
| `SongRequest:PublicBaseUrl` | `https://decatron.net` | URL base para construir los enlaces públicos de la cola (`/sr/{canal}`); configura tu propio dominio |
| `Tournament:FilesPath` | `/var/www/html/decatron/tournament-files` | Carpeta de capturas y archivos de torneos |
| `Tournament:PublicAssetsPath` | `/var/www/html/decatron/tournament-public-assets` | Carpeta de recursos públicos de torneos (apariencia) |
| `TcgSettings:ImagesPath` | `/var/www/html/decatron/tcg-card-images` | Imágenes de las cartas; las de los sobres se sirven desde `{ImagesPath}/packs` en `/tcg-packs` |
| `TcgSettings:ImageSigningSecret` | | Secreto que firma las URL de las imágenes de cartas |
| `Emotes:AssetsPath` | `/var/www/html/decatron/emote-assets` | Imágenes de emotes; se sirven en `/uploads/emotes` |
| `Emotes:PublicBase` | `https://decatron.net` | URL base para construir las URL públicas de emotes; configura tu propio dominio |
| `Brand:AssetsPath` | `/var/www/html/decatron/brand-assets` | Logos subidos desde la página de marca del administrador; se sirven en `/uploads/brand` |
| `ClipSettings:DownloadsPath` | (ver `appsettings.json`) | Clips de shoutout descargados; se sirven en `/downloads` |
| `WheelOfLuck:Enabled` | | Interruptor general del módulo de Ruleta |

Asegúrate de que el usuario de la aplicación pueda escribir en todas las carpetas anteriores.

---

## Correo y facturación

### `EmailSettings`

| Clave | Tipo | Por defecto | Descripción |
|-------|------|-------------|-------------|
| `ResendApiKey` | string | vacío | API key del servicio de correo Resend |
| `FromAddress` | string | `DecatronAPI <support@decatron.net>` | Remitente; configura el tuyo |
| `AdminEmail` | string | `support@decatron.net` | Dirección del administrador para avisos; configura la tuya |

### `DecatronApi` (enlace opcional de facturación)

| Clave | Tipo | Por defecto | Descripción |
|-------|------|-------------|-------------|
| `BaseUrl` | string | `https://decatronapi.decatron.net` | URL base del servicio de facturación |
| `ApiKey` | string | | Llave Bearer de ese servicio; la facturación se omite si está vacía |
| `CompanyId` | int | | ID de la empresa emisora |
| `Enabled` | bool | `true` | Interruptor general de la facturación; además requiere `ApiKey` |

### `TtsCredits`

| Clave | Descripción |
|-------|-------------|
| `TransitionEndsAt` | Fecha de fin de la transición de créditos de TTS (definida en `appsettings.json`) |

---

## Ajustes públicos en appsettings.json

`appsettings.json` no contiene secretos:

| Clave | Descripción |
|-------|-------------|
| `TwitchSettings:Scopes` | Scopes de Twitch (ver arriba) |
| `Serilog:MinimumLevel:Default` | Nivel mínimo de registro: `Verbose`, `Debug`, `Information`, `Warning`, `Error`, `Fatal` |
| `Serilog:WriteTo` | Salida por consola y un archivo rotativo: ruta `logs/decatron-.txt`, un archivo por día, límite de 50 MB por archivo (`fileSizeLimitBytes`), 14 archivos conservados (`retainedFileCountLimit`) |
| `Logging:LogLevel` | Niveles de registro nativos de ASP.NET Core (Serilog los sobrescribe) |
| `AllowedHosts` | `*` acepta cualquier host |
| `ClipSettings`, `EventSubSettings`, `LiveTranslation`, `WheelOfLuck`, `Fortnite`, `DecatronApi`, `TtsCredits` | Ajustes de módulos descritos arriba |

---

## Orígenes CORS

Los orígenes están escritos directamente en `Program.cs` (política `AllowReact`) y no se configuran con ajustes:

```
http://localhost:5173
https://twitch.decatron.net
https://decatron.net
https://www.decatron.net
```

Para permitir otro origen, edita el bloque `AddCors` de `Program.cs`. Una segunda política, `TournamentEmbed`, permite cualquier origen sin credenciales para el overlay público de torneos y el widget de ranking.

---

## Rutas físicas

| Ruta | Propósito | Configurable |
|------|-----------|--------------|
| `{ClipSettings:DownloadsPath}` | Clips de Twitch descargados (`/downloads`) | Sí |
| `ClientApp/public/uploads/soundalerts` | Medios de alertas de sonido (`/uploads/soundalerts`) | No |
| `ClientApp/public/timerextensible` | Medios del timer (`/timerextensible`) | No |
| `ClientApp/public/system-files` | Archivos del sistema precargados (`/system-files`) | No |
| `{AwsPolly:CachePath}` | Caché de audio TTS (`/tts-audio`) | Sí |
| `{Brand:AssetsPath}`, `{Emotes:AssetsPath}`, `{TcgSettings:ImagesPath}`, `{Tournament:*}` | Ver la tabla anterior | Sí |
| `logs/` | Archivos de Serilog | Sí (`Serilog:WriteTo`) |

---

## Resumen de servicios externos

| Servicio | Necesario para | Costo |
|----------|----------------|-------|
| PostgreSQL | Todo | Gratis |
| Aplicación de desarrollador de Twitch | Inicio de sesión, bot, EventSub | Gratis |
| Aplicación de desarrollador de Kick | Inicio de sesión de Kick y módulos | Gratis |
| Aplicación de Discord | Bot de Discord e inicio de sesión | Gratis |
| PayPal para desarrolladores | Propinas y compras de tier | Gratis (PayPal cobra comisión por los pagos) |
| Culqi | Pagos con tarjeta de paquetes de créditos | Por transacción |
| Spotify para desarrolladores | Now Playing | Gratis |
| API de Last.fm | Now Playing (alternativa a Spotify) | Gratis |
| Google Gemini, OpenRouter | Funciones de IA | Planes gratuitos y modelos de pago |
| AWS Polly | Texto a voz | De pago (hay nivel gratuito) |
| Deepgram, FishAudio | Traducción en vivo | De pago |
| API de Riot, Epic Games | Torneos, overlays de juegos, Fortnite | Gratis |
| Resend | Correo | Nivel gratuito y de pago |
| MySQL + GachaVerse | Vinculación con GachaVerse | Solo si usas GachaVerse |
