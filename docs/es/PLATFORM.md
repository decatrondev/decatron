# Plataforma Decatron (backend como servicio) -- Arquitectura

Este documento describe la plataforma multi-tenant que convive con el bot de Decatron: un comprador recibe un espacio aislado en `slug.decatron.top`, carga su propia app de Twitch, su cuenta de bot, su bot de Discord y sus llaves de API, y sus streamers inician sesión ahí. El bot de `decatron.net` es el tenant **#1** y sigue funcionando igual que siempre.

Todo lo que se dice aquí sale del código. Los planes, los precios y el lanzamiento público siguen en definición; solo se describe lo que ya funciona.

## 1. Tenants y aislamiento

- Un **tenant** es una fila de `tenants` (`slug`, `name`, `status`). El tenant #1 es el bot original: lee sus credenciales de `appsettings` y nunca toca los almacenes por tenant.
- **¿De qué tenant es esta petición?** `TenantMiddleware` lo resuelve primero por **Host** (`slug.decatron.top`, con `ITenantResolver.ByHost`) y después por el usuario con sesión. Manda el Host: una sesión de otro tenant no cambia el tenant de ese subdominio. Los servicios que no viven dentro de una petición lo leen de `TenantAmbient.Current` (por defecto 1).
- **Aislamiento en la base de datos.** Toda tabla con `tenant_id` tiene seguridad por filas (política `tenant_isolation` sobre `app_tenant_id()`), y la aplicación se conecta como `decatron_app`, un rol sin privilegios de superusuario. Una conexión sin contexto de tenant no ve nada y no puede insertar. Ajustes: `Platform:TenantContext:Mode` (`strict`) y `Platform:TenantContext:Rls` (`context`).
- **Una fila de cuenta por tenant.** Con `Platform:IdentityPerTenant` activo, la misma persona tiene una fila de `users` propia, con sus tokens, en cada tenant.
- **Subdominios reservados** (`www`, `api`, `admin`, `mail`, `panel`, `login`, `prueba`, `decatron`, `twitch`, `kick`, ...) no se pueden registrar; la lista vive en `PlatformSlug`. Los slugs tienen de 3 a 30 caracteres `a-z0-9-`, sin guion al inicio, al final ni doble.

## 2. Credenciales por tenant

Cada tenant trae las suyas: aplicación de Twitch, cuenta de bot de Twitch, token del bot de Discord y llaves de API opcionales (IA, Deepgram, Fish Audio).

- **Cifrado.** Los secretos se guardan con `SecretVault` (`ENC2`, AES-GCM). Cada tenant tiene su propia clave de datos, envuelta con una clave maestra guardada en un archivo fuera del repositorio (`Platform:MasterKeyPath`). Los secretos son de solo escritura: la API devuelve «configurado, últimos 4 caracteres», nunca el valor.
- **Falla cerrado.** `ICredentialProvider` devuelve los valores del tenant #1 solo para el #1. Cualquier otro tenant sin credenciales recibe un error, nunca las del #1.
- **Auditoría.** Cada lectura y escritura queda en `credential_access_log` (quién, qué, cuándo; nunca el secreto).
- **Lo que fija la plataforma y el comprador no elige:** la URL de retorno (`https://slug.decatron.top/api/auth/callback`) y los scopes de Twitch.
- **Ejecución por tenant:** conduit y shards de EventSub (`TenantEventSubHub`, `Platform:EventSub:TenantShardCount`), gateway de Discord (`DiscordTenantGateway`, con tope `Platform:Discord:MaxGateways`, 20 por defecto), envío de mensajes con el bot propio del tenant y tareas de fondo que corren una vez por tenant (`TenantTaskRunner`).

## 3. Planes y límites

Las capacidades son filas, no código. El catálogo (`capabilities`) tiene cuatro grupos: `module.*` (encendido o apagado), `quota.*` (tope numérico), `byo.*` (puede cargar una llave propia) y `feature.*`. Los planes son `internal` (tenant #1, sin topes), `sandbox`, `semilla`, `creator`, `pro`, `studio` y `exclusivo`.

- **Precedencia:** ajuste del tenant, luego complemento, luego plan, luego valor por defecto (`IEntitlements`).
- **Sandbox.** Un tenant nuevo empieza en `sandbox` por 7 días.
- **Ciclo de vida.** `TenantLifecycle` (cada 60 s por defecto) pausa la conexión de EventSub y el gateway de Discord de un tenant que no está operativo (suspendido, cancelado, sandbox vencido, sin suscripción) y los reanuda solo. Registra `tenant.purge.due` para los tenants que pasaron el plazo de guarda (`Platform:Lifecycle:PurgeAfterDays`, 30 por defecto); nunca borra por su cuenta.
- **Aplicación de los límites.** `[RequiresModule("module.x")]` en los controladores, filtros por plan en los comandos de chat y las tareas de fondo, y contadores de comandos, timers, almacenamiento, correos y mensajes de chat al mes (el de chat solo mide).
- **Qué muestra el panel.** `GET /api/platform/my-modules` (cualquier sesión iniciada, el tenant sale del Host) lista los módulos que incluye el plan. El panel del streamer oculta del menú los módulos que el plan no trae, marca sus tarjetas como «No incluido en tu plan» y muestra un aviso corto en lugar de la página si alguien abre su dirección. Es solo informativo: el servidor sigue respondiendo 403 `module_not_included`. Si la lista no se puede cargar, se muestra todo.
- **Llaves propias.** La IA, la voz y la traducción corren con las llaves del propio tenant. Sin llave, la función queda apagada; las llaves de Decatron nunca se usan para otro tenant. Un proveedor se habilita cuando el plan incluye al menos una de sus capacidades (`byo.ai` o `byo.translate` para la IA, `byo.stt` o `byo.tts` para Deepgram, `byo.tts` para Fish Audio); el panel del comprador muestra «No incluido en tu plan» para un proveedor que el plan no incluye, y el servidor se niega a guardar su llave (`byo_not_in_plan`).

- **Correo.** Hay dos caminos de correo separados. El correo de la plataforma (enlaces de acceso, invitaciones del equipo, lista de espera) es de Decatron y sale por Resend o por el servidor de correo propio de Decatron (SMTP), a elección desde el panel de administración en Correo → Proveedor (`platform_mail_settings`; la contraseña SMTP vive en `appsettings.Secrets.json`, nunca en la base; si el servidor propio falla con un correo real, se reintenta por Resend). El correo que un tenant envía a sus propios usuarios debe usar la llave de Resend del propio tenant (`byo.email`); nunca pasa por la llave de Decatron y no hay cuota de correos.
- La exportación y el borrado de un tenant son herramientas solo del dueño (`GET .../export`, `POST .../purge`). El borrado pide el slug como confirmación y solo funciona con un tenant que no está operativo.

## 4. La cuenta del comprador

El comprador es independiente de Twitch: se identifica por correo y es `owner` en `tenant_members`.

1. **Registro** en `decatron.top/registro`: correo, nombre del proyecto y subdominio, más un desafío de Turnstile. Por defecto el registro es **por aprobación** (`Platform:SignupMode`): solo los correos que el dueño de la plataforma aprobó pueden recibir un enlace. Una solicitud de cualquier otro correo recibe la misma respuesta que una normal pero no envía nada ni gasta cuota de correos, así que nadie puede saber quién está aprobado; la aprobación se vuelve a comprobar al confirmar el enlace, de modo que retirarla detiene un registro pendiente. Aprobar (desde la lista de espera o a mano, en el panel de administración) no envía ningún correo ni crea nada. Con el modo `open` cualquiera puede registrarse. Límites: 5 solicitudes por IP y 3 por correo al día; la cuota de correos se comparte con la lista de espera (`Platform:WaitlistMaxEmailsPerDay`, 40 por defecto).
2. Se envía por correo un enlace de un solo uso, válido 30 minutos. El tenant se crea **solo al confirmar el enlace**, en una transacción: tenant, cuenta del dueño, membresía y suscripción sandbox. La respuesta a una solicitud nunca revela si un correo existe.
3. **Volver a entrar:** `slug.decatron.top/panel/login` envía un enlace de un solo uso de 15 minutos, válido solo en ese host.
4. **Sesión:** un JWT de 8 horas con el claim `tnt` (el tenant) y `scope=buyer`. `TenantMiddleware` responde 403 si el claim no coincide con el Host, y una sesión de comprador solo abre `/api/platform/`, `/api/auth/`, `/api/brand` y `/api/design/tokens`, nunca las pantallas del streamer. Se entrega por el código de canje de 60 segundos (`/api/auth/exchange`), no por la URL.
5. **Panel** (`slug.decatron.top/panel`): el comprador carga la app de Twitch, vincula el bot, reabre la conexión de EventSub y, si quiere, agrega un bot de Discord y llaves propias. Cada acción vuelve a comprobar en la base de datos que quien llama sigue siendo el dueño (o, en las rutas de lectura, administrador).

### Equipo (administradores)

El dueño puede invitar administradores por correo (pestaña **Equipo** del panel). Reglas:

- **Qué puede hacer un administrador:** entrar al panel en modo **solo lectura** (estado de las conexiones, plan, uso y permisos) y reabrir la conexión de EventSub. No toca credenciales (app de Twitch, bot, Discord, llaves propias), el 2FA ni el equipo, y nunca ve pistas de credenciales (Client ID, últimos caracteres, nombres de cuentas): solo «configurado / sin configurar». El servidor elige el filtro por ruta: `RequireBuyerOwner` para todo lo sensible (una acción nueva nace protegida) y `RequireBuyerMember` (dueño o admin) solo para las rutas de lectura y el reinicio de EventSub.
- **Invitación:** un correo con un enlace de un solo uso y 7 días de vida. Al abrirlo (se confirma con `POST`, así que una vista previa del correo no lo gasta) se crea la cuenta de comprador del invitado en ese tenant (`users`, `auth_provider='email'`) y una fila en `tenant_members` con rol `admin`, y se le inicia sesión por el código de canje de 60 segundos. El enlace solo sirve en el subdominio del propio tenant. Solo se guarda el hash del token (`tenant_invitations`, con seguridad por filas).
- **Tope:** `quota.admins` cuenta dueño + admins + invitaciones vivas, y se comprueba al invitar **y otra vez al aceptar** (si el plan bajó entretanto, la invitación no se acepta). Falla cerrado. En un plan sin lugar extra (sandbox, Semilla) el formulario sale desactivado con «no incluido en tu plan». Topes contra abuso: 5 invitaciones pendientes y 10 invitaciones al día por tenant (las canceladas cuentan); las invitaciones usan la cuota compartida de correos (`Platform:WaitlistMaxEmailsPerDay`) y no dependen de `Platform:SignupMode`. Un proyecto que no está operativo no puede invitar ni aceptar.
- **Quitar:** el dueño puede quitar a un admin o cancelar una invitación. El rol se lee de la base en cada llamada (nunca del token), así que quitar cierra el acceso al instante; la cuenta del admin queda inactiva. Invitar y quitar piden el paso del 2FA si el dueño lo activó. Cada invitación, aceptación, cancelación y baja queda en `credential_access_log` (proveedor `team`, sin correos).
- Los **streamers** que entraron con Twitch (`viewer`) se listan en una pestaña aparte, solo lectura; cuentan para `quota.channels`, no para `quota.admins`.
- Fuera de alcance: transferir la propiedad y roles intermedios.

### Transparencia

El panel muestra lo que el comprador necesita para decidir con claridad (`GET /api/platform/buyer/transparency`):

- el plan, sus módulos (incluidos o no), los límites con su uso actual y qué llaves propias aplican;
- cada permiso de Twitch que pide la plataforma, separado entre streamers y cuenta del bot, con su motivo y el módulo que lo necesita. La fuente única es `TwitchScopeCatalog`; una prueba unitaria falla si un scope que se pide no tiene entrada.
- `channel_editor` (un scope retirado de la API v5 que hace fallar a las apps nuevas de Twitch con «No se han podido cargar los datos de autorización») se quita para todos los tenants menos el #1.

### Inicio de sesión del streamer en el subdominio del tenant

`slug.decatron.top/login` muestra el nombre del tenant como marca, solo el botón de Twitch (Kick y Discord usan las apps de Decatron, no las del tenant) y la lista de permisos. Se alimenta del endpoint público `GET /api/platform/tenant-info`. El login usa siempre la aplicación de Twitch propia del tenant; si el tenant no tiene una, o no está activo, la página lo dice en lugar de redirigir.

## 5. Verificación en dos pasos (obligatoria para el dueño)

- **Método:** TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s, un paso de desfase de reloj) y 8 códigos de recuperación de un solo uso. Un código se acepta una sola vez (se guarda el último paso usado).
- **Almacenamiento:** el secreto va cifrado con `SecretVault`; los códigos de recuperación se guardan solo como hash; las tablas `tenant_buyer_mfa` y `tenant_buyer_recovery_codes` tienen seguridad por filas. Cada evento va a `credential_access_log` (`mfa_setup`, `mfa_enable`, `mfa_ok`, `mfa_fail`, `mfa_locked`, `mfa_recovery`, `mfa_codes`, `mfa_disable`).
- **Bloqueo:** 5 fallos seguidos bloquean la cuenta 15 minutos.
- **Obligatoria para el dueño.** Mientras `Platform:RequireOwnerMfa` esté encendida (por defecto), un dueño sin 2FA recibe `403 mfa_required` en toda ruta del comprador salvo `GET /buyer/me` (que informa `mfa.required`) y las propias rutas del 2FA; el panel muestra entonces solo la pantalla para activarlo. A los administradores no se les pide (son de solo lectura). Desactivar el 2FA se permite, pero el panel vuelve a bloquearse hasta activarlo de nuevo.
- **Avisos de seguridad por correo** al dueño cuando se desactiva el 2FA y cuando se usa un código de recuperación (best effort: un correo que falle nunca bloquea la acción).
- **Qué protege:** guardar, reemplazar o quitar la app de Twitch, el bot, el bot de Discord o una llave propia (y generar el enlace del bot). Con el 2FA activo, esas acciones necesitan el encabezado `X-Step-Up`, un token firmado que devuelve `POST /api/platform/buyer/mfa/verify` tras un código válido. Dura 10 minutos y está atado al tenant, al usuario y a la activación vigente, así que desactivar y volver a activar el 2FA invalida los tokens anteriores. Sin 2FA las acciones funcionan como antes; el panel recomienda activarlo.
- Desactivar el 2FA y regenerar los códigos de recuperación exigen un código válido en la misma petición.

## 6. Endpoints

Públicos (el tenant sale del Host donde aplica):

| Método | Ruta | Para qué |
|--------|------|----------|
| `GET` | `/api/platform/config` | Ajustes públicos de la landing (clave de Turnstile) |
| `POST` | `/api/platform/waitlist`, `/api/platform/waitlist/confirm` | Lista de espera con confirmación por correo |
| `GET` | `/api/platform/signup/slug` | Si un subdominio está disponible |
| `GET` | `/api/platform/signup/mode` | `open` o `approval`, para que el formulario avise antes de que escriban |
| `POST` | `/api/platform/signup`, `/api/platform/signup/confirm` | Registro del comprador y su confirmación |
| `POST` | `/api/platform/buyer/login-link`, `/api/platform/buyer/login-confirm` | Entrada del comprador con enlace por correo |
| `POST` | `/api/platform/buyer/team/accept` | Un administrador invitado acepta (token de un solo uso, solo en el host del tenant) |
| `GET` | `/api/platform/tenant-info` | Nombre, si está listo y permisos que pide un subdominio de tenant |

Dueño (JWT con `scope=buyer`, dueño del tenant del Host):

| Método | Ruta | Para qué |
|--------|------|----------|
| `GET` | `/api/platform/buyer/tenant` | Estado de la configuración con pistas de credenciales (solo el dueño) |
| `PUT` `DELETE` | `/api/platform/buyer/twitch-app` | Aplicación de Twitch (paso de verificación) |
| `POST` `DELETE` | `/api/platform/buyer/bot-link`, `/bot` | Cuenta del bot (paso de verificación) |
| `PUT` `DELETE` | `/api/platform/buyer/discord-bot` | Bot de Discord (paso de verificación); `POST .../discord-bot/restart` lo reconecta |
| `PUT` `DELETE` | `/api/platform/buyer/byo/{provider}` | Llaves propias (paso de verificación); `POST .../byo/{provider}/test` prueba una llave |
| `GET` `POST` | `/api/platform/buyer/mfa`, `/mfa/setup`, `/mfa/confirm`, `/mfa/verify`, `/mfa/recovery-codes`, `/mfa/disable` | Verificación en dos pasos |

Equipo (solo el dueño; invitar y quitar piden el paso del 2FA si está activado):

| Método | Ruta | Para qué |
|--------|------|----------|
| `GET` | `/api/platform/buyer/team` | Miembros, invitaciones vivas, streamers y lugares |
| `POST` | `/api/platform/buyer/team/invite` | Invitar a un administrador por correo |
| `DELETE` | `/api/platform/buyer/team/invitations/{id}`, `/members/{userId}` | Cancelar una invitación; quitar a un administrador |

Dueño o administrador (rutas de solo lectura):

| Método | Ruta | Para qué |
|--------|------|----------|
| `GET` | `/api/platform/buyer/me`, `/state`, `/transparency` | Resumen (con el rol real), estado de las conexiones sin pistas de credenciales, plan y permisos |
| `POST` | `/api/platform/buyer/eventsub/restart` | Reabrir la conexión de EventSub |

El dueño de la plataforma tiene rutas de administración equivalentes bajo `/api/admin/platform/` (lista de espera, correos aprobados, tenants, planes, ajustes, complementos, exportación y borrado). Son solo para administradores y se documentan aquí a nivel de arquitectura.

## 7. Ajustes

| Clave | Por defecto | Para qué |
|-------|-------------|----------|
| `Platform:TenantContext:Mode` / `:Rls` | `strict` / `context` | Resolución de tenant y modo de RLS |
| `Platform:SignupMode` | `approval` | `open` deja registrarse a cualquiera; cualquier otro valor (o ninguno) significa solo correos aprobados; se recarga en caliente |
| `Platform:IdentityPerTenant` | apagado | Una fila de `users` por tenant |
| `Platform:MasterKeyPath` | `/etc/decatron/tenant-master.key` | Archivo de la clave maestra de `SecretVault` |
| `Platform:BaseUrl` / `Platform:PublicBaseUrl` | `https://decatron.top` / `https://decatron.net` | Enlaces de los correos y del enlace del bot |
| `Platform:DefaultRedirectUri` | `https://slug.decatron.top/api/auth/callback` | URL de retorno de Twitch de un tenant |
| `Platform:WaitlistMaxEmailsPerDay` | 40 | Tope diario de correos compartido por la lista de espera y los enlaces del comprador |
| `Platform:EventSub:TenantShardCount` | 1 (1-10) | Shards del conduit por tenant |
| `Platform:Discord:MaxGateways` | 20 | Gateways de Discord simultáneos |
| `Platform:Lifecycle:IntervalSeconds` / `:PurgeAfterDays` | 60 / 30 | Pulso del ciclo de vida y plazo de guarda antes de marcar un borrado |

## 8. Notas de operación

- Los cambios de esquema viven en `Decatron.Data/Migrations/` y se aplican a mano antes de reiniciar el backend (`Add_Tenant_Credentials.sql`, `Add_Platform_Signups.sql`, `Add_Buyer_Mfa.sql`, entre otros).
- Una instalación nueva carga `Schema/baseline.sql` y después `Migrations/Seed_Platform_Base.sql` (tenant #1, el catálogo de capacidades y el plan interno). Los planes comerciales no se incluyen: para abrir el registro de compradores los creas tú, y hace falta al menos un plan con la clave `sandbox`.
- Un tenant creado a mano también necesita su fila en `tenant_subscriptions`; sin ella el tenant no está operativo y queda pausado.
- `*.decatron.top` resuelve por un registro DNS comodín y un certificado comodín; nginx sirve la misma aplicación de una sola página y envía `/api`, `/hubs` y las cargas al backend.
- Eventos de log que conviene vigilar: `tenant.ambiguous` (un usuario con sesión cuyo tenant no se pudo resolver), `eventsub.tenant.start`, `discord.gateway.mem`, `tenant.purge.due`, `buyer.denied`.
