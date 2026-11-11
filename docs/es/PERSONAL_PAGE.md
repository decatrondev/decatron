# Página personal (`decatron.net/@nombre`)

Cada canal puede tener su propia página en `decatron.net/@nombre`: un enlace corto con las redes, la foto y el estilo del streamer. Es gratis y no está ligada a ningún otro módulo. Este documento cubre la subfase 5.1: la base y las cinco plantillas (Escena, Credencial, Canal de TV, Inventario y Póster).

> **Todavía no está abierta al público.** Mientras `PersonalPages:PublicOpen` sea `false` (por defecto), una página publicada solo la ven su dueño, quienes tienen `control_total` en ese canal y los dueños del sistema, con un aviso de vista previa. Se abre cuando estén las protecciones para mayores de 18 y las denuncias (subfase 5.2).

## Modelo de datos

Migración: `Decatron.Data/Migrations/Add_Personal_Pages.sql` (idempotente).

| Tabla | Para qué |
|---|---|
| `personal_pages` | Una página por canal (`channel_user_id` único). `handle` único, `draft` y `published` en JSON, `status` (`active`/`hidden`), `hidden_reason`, `needs_new_handle`, `revision` (concurrencia optimista) |
| `personal_page_handle_history` | Nombres viejos que redirigen a la página durante 30 días |
| `personal_page_reserved_handles` | Nombres reservados por admin (se suman a la lista fija `PersonalPageRules.BuiltInReserved`) |
| `personal_page_handle_appeals` | Apelaciones por un nombre tomado: quién pide, mensaje, estado (`pending`, `rejected`, `transferred`, `withdrawn`) y revisión |

Todavía no hay `tenant_id`: las páginas existen solo en decatron.net. El soporte para tenants agregará la columna con RLS y el nombre pasará a ser único por tenant.

Contenido (`PersonalPageContent`, común a todas las plantillas): `displayName`, `bio`, `avatarUrl`, `template`, `theme`, `accent`, `font`, `links[]` (`id`, `kind`, `url`, `title`, `visible`, `size`). Cambiar de plantilla nunca pierde contenido. `template` es `scene`, `badge`, `channel`, `inventory` o `poster`; `size` (`normal`, `wide`, `big`) lo usan Inventario (casillas 1×1, 2×1, 2×2) y Póster (créditos chicos, medianos o grandes; si ninguna red está en grande, la primera se muestra grande).

## Reglas (`Decatron.Core/Helpers/PersonalPageRules.cs`)

- Nombre: de 3 a 25 caracteres, minúsculas, números, `-` y `_`, sin empezar ni terminar con ellos. Palabras reservadas fijas más la lista de admin. `pagina-<número>` queda reservado para nombres provisionales.
- El primero que lo registra se lo queda. Se puede cambiar una vez cada 30 días; el viejo redirige 30 días y en ese tiempo nadie más puede tomarlo.
- Nombre visible hasta 50 caracteres, bio hasta 300, título de enlace hasta 60, dirección hasta 500, hasta 100 enlaces (tope técnico, no de plan).
- Enlaces solo `https`, sin credenciales ni puertos propios. Los de una red tienen que usar los dominios de esa red (Twitch, Kick, YouTube, TikTok, Instagram, X, Discord, Facebook, Threads, Bluesky, OnlyFans, Fansly). OnlyFans y Fansly van marcados como para adultos.
- Fotos: subidas propias (se vuelven a codificar en WEBP, máximo 512 px, sin metadatos, hasta 10 MB) o la foto del canal desde el CDN de Twitch/Kick.
- Color de acento desde la foto: `PersonalPageAccent.FromPixels` (función pura).
- Para publicar hace falta un nombre visible.

## API

Panel (con sesión, dueño del canal o `control_total`; sección de permisos `personal_page`; solo en decatron.net):

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/personal-page` | Página, nombre sugerido, canal, redes, tipografías, límites, `publicOpen` |
| GET | `/api/personal-page/handle-check?handle=` | Forma y disponibilidad (`length`, `chars`, `edge`, `reserved`, `taken`, `redirecting`) |
| POST | `/api/personal-page` | Crear la página `{ handle }` |
| PUT | `/api/personal-page/draft` | Guardar el borrador `{ content, revision }` |
| POST | `/api/personal-page/publish` | Publicar el borrador `{ revision }` |
| POST | `/api/personal-page/discard` | Volver el borrador a lo publicado `{ revision }` |
| PUT | `/api/personal-page/handle` | Cambiar el nombre `{ handle, revision }` |
| POST | `/api/personal-page/avatar` | Subir la foto (multipart `file`, `revision`), devuelve `suggestedAccent` |
| POST | `/api/personal-page/accent-from-photo` | Color de acento desde la foto actual |
| GET/POST | `/api/personal-page/appeals` | Mis apelaciones / enviar una `{ handle, message }` |
| POST | `/api/personal-page/appeals/{id}/withdraw` | Retirar una apelación pendiente |

Pública (anónima): `GET /api/public/personal-pages/{handle}` (página publicada, o `{ redirect }` para un nombre viejo; `not_found`, `not_open`, `hidden`, `not_published`) y `GET /api/public/personal-pages/assets/{pageId}/{file}`.

Admin (dueño del sistema): `GET /api/admin/personal-pages`, `POST /api/admin/personal-pages/{id}/visibility`, `GET|POST /api/admin/personal-pages/reserved`, `DELETE /api/admin/personal-pages/reserved/{handle}`, `GET /api/admin/personal-pages/appeals`, `POST .../appeals/{id}/reject`, `POST .../appeals/{id}/transfer`.

Los errores son códigos estables (`{ code, details }`), nunca mensajes internos. Una `revision` vieja devuelve `409 stale_revision`.

Aceptar una apelación (`transfer`) da el nombre a quien la envió (y le crea la página si no tiene); el dueño actual pasa a `pagina-<id>` con `needs_new_handle = true` y puede elegir otro nombre sin esperar 30 días. Las demás apelaciones pendientes por ese nombre se rechazan.

## Front

- Panel: `/mi-pagina` (`ClientApp/src/pages/personal-page/`), pestañas Guía, Perfil, Redes y enlaces, Apariencia y Nombre, con vista previa de celular y escritorio.
- Página pública: `/@nombre` (`PersonalPagePublic.tsx`). React Router no admite `@:param`, así que la ruta es `/:atHandle` y el componente exige la `@`.
- Plantillas: `SceneTemplate.tsx`, `BadgeTemplate.tsx` (QR con el paquete `qrcode`), `ChannelTemplate.tsx`, `InventoryTemplate.tsx` y `PosterTemplate.tsx`, elegidas por `TemplateRenderer.tsx`. Todas mantienen en escritorio la composición de su maqueta, centrada y más grande, con container queries (la vista previa del panel dibuja la de celular). Maquetas: `.dev/plans/pagina-personal/maquetas/` (fuera de git).
- Admin: `/admin/paginas`.
- Textos: `public/locales/{es,en}/personal-page.json`; docs en `docs-personal-page.json`.

## Vista previa al compartir

`PersonalPageSharePageController` sirve `/@{handle}` con meta tags Open Graph cuando las páginas están abiertas y la página está publicada y activa; si no, las meta tags generales. Necesita un `location` de nginx para `/@…` hacia el backend (mismo patrón que la vista previa de los torneos).

## Configuración

| Clave | Por defecto | Descripción |
|---|---|---|
| `PersonalPages:PublicOpen` | `false` | Abre las páginas al público (subfase 5.2) |
| `PersonalPages:PublicAssetsPath` | `/var/www/html/decatron/personal-page-assets` | Carpeta de las fotos subidas (el usuario del backend tiene que poder escribir) |

## Pruebas

`Decatron.Tests/PersonalPageTests.cs`: reglas puras (nombre, espera de 30 días, redirección, direcciones por red, foto, errores del contenido, color) y pruebas de base contra `decatron_schema` (el primero se lo queda, restricción de único, borrador/publicar/descartar, espera y redirección, recuperar un nombre viejo, reservados, transferencia por apelación, rechazar/retirar, ocultar).
