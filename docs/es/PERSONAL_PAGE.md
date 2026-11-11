# Página personal (`decatron.net/@nombre`)

Cada canal puede tener su propia página en `decatron.net/@nombre`: un enlace corto con las redes, la foto y el estilo del streamer. Es gratis y no está ligada a ningún otro módulo. Este documento cubre la subfase 5.1 (la base y las cinco plantillas: Escena, Credencial, Canal de TV, Inventario y Póster) la 5.2 (contenido para mayores de 18, dominios y denuncias) y la 5.3 (escena por capas).

> **Todavía no está abierta al público.** Mientras `PersonalPages:PublicOpen` sea `false` (por defecto), una página publicada solo la ven su dueño, quienes tienen `control_total` en ese canal y los dueños del sistema, con un aviso de vista previa. Las protecciones de la subfase 5.2 ya están; abrirla es solo cambiar esa clave.

## Modelo de datos

Migraciones: `Decatron.Data/Migrations/Add_Personal_Pages.sql` y `Add_Personal_Pages_Safety.sql` (5.2), ambas idempotentes.

| Tabla | Para qué |
|---|---|
| `personal_pages` | Una página por canal (`channel_user_id` único). `handle` único, `draft` y `published` en JSON, `status` (`active`/`hidden`), `hidden_reason`, `needs_new_handle`, `forced_adult` (admin la marcó +18), `revision` (concurrencia optimista) |
| `personal_page_handle_history` | Nombres viejos que redirigen a la página durante 30 días |
| `personal_page_reserved_handles` | Nombres reservados por admin (se suman a la lista fija `PersonalPageRules.BuiltInReserved`) |
| `personal_page_handle_appeals` | Apelaciones por un nombre tomado: quién pide, mensaje, estado (`pending`, `rejected`, `transferred`, `withdrawn`) y revisión |
| `personal_page_domains` | Dominios de admin: `adult` (fuerza +18) o `blocked` (no se puede enlazar). Se suman a las listas fijas |
| `personal_page_reports` | Denuncias: página, quién denuncia, motivo, detalle, enlace (id y URL al momento de denunciar), estado (`open`, `resolved`, `dismissed`) y resolución (`hidden`, `forced_adult`, `domain_blocked`). Una abierta por persona y página |

Todavía no hay `tenant_id`: las páginas existen solo en decatron.net. El soporte para tenants agregará la columna con RLS y el nombre pasará a ser único por tenant.

Contenido (`PersonalPageContent`, común a todas las plantillas): `displayName`, `bio`, `avatarUrl`, `template`, `theme`, `accent`, `font`, `links[]` (`id`, `kind`, `url`, `title`, `visible`, `size`, `adult`), `adult` (toda la página +18) y `scene` (5.3: `enabled`, `background` `color`/`pattern`/`media`, `bgColor`, `bgMedia`, `layers[]` con `id`, `kind` `photo`/`name`/`bio`/`sticker`/`text`, `x`, `y`, `width`, `height`, `visible`, `mediaUrl`, `text`, `font`, `color`, `size`, `align`). Cambiar de plantilla nunca pierde contenido. `template` es `scene`, `badge`, `channel`, `inventory` o `poster`; `size` (`normal`, `wide`, `big`) lo usan Inventario (casillas 1×1, 2×1, 2×2) y Póster (créditos chicos, medianos o grandes; si ninguna red está en grande, la primera se muestra grande).

## Reglas (`Decatron.Core/Helpers/PersonalPageRules.cs`)

- Nombre: de 3 a 25 caracteres, minúsculas, números, `-` y `_`, sin empezar ni terminar con ellos. Palabras reservadas fijas más la lista de admin. `pagina-<número>` queda reservado para nombres provisionales.
- El primero que lo registra se lo queda. Se puede cambiar una vez cada 30 días; el viejo redirige 30 días y en ese tiempo nadie más puede tomarlo.
- Nombre visible hasta 50 caracteres, bio hasta 300, título de enlace hasta 60, dirección hasta 500, hasta 100 enlaces (tope técnico, no de plan).
- Enlaces solo `https`, sin credenciales ni puertos propios. Los de una red tienen que usar los dominios de esa red (Twitch, Kick, YouTube, TikTok, Instagram, X, Discord, Facebook, Threads, Bluesky, OnlyFans, Fansly). OnlyFans y Fansly van marcados como para adultos.
- Fotos: subidas propias (se vuelven a codificar en WEBP, máximo 512 px, sin metadatos, hasta 10 MB) o la foto del canal desde el CDN de Twitch/Kick.
- Color de acento desde la foto: `PersonalPageAccent.FromPixels` (función pura).
- Para publicar hace falta un nombre visible.

### Mayores de 18, dominios y denuncias (5.2)

- `adult` de un enlace o de la página lo marca el dueño. Se fuerza (sin poder desmarcar) para OnlyFans y Fansly, para los sitios de `BuiltInAdultDomains` y para los dominios `adult` de admin; la página entera se fuerza con `forced_adult`. `ApplyForced` lo aplica al guardar y `PublicView` otra vez al mostrar, porque admin puede agregar dominios después.
- Un dominio coincide consigo y con sus subdominios (`DomainMatches`). Los dominios `blocked` no se pueden guardar (`link_blocked:i`) y los enlaces ya guardados a esos sitios dejan de mostrarse. Los acortadores (`Shorteners`) no se aceptan en enlaces libres (`link_shortener:i`).
- Admin no puede agregar los dominios de las redes de la lista ni decatron.net (`IsProtectedHost`).
- Denuncias: solo con sesión, nunca la propia página, una abierta por persona y página, hasta `ReportsPerDay` (10) por persona en 24 horas, más un límite por IP (`personal-page-report`, 8 cada 10 minutos). Motivos: `adult_unmarked`, `scam`, `impersonation`, `hate`, `copyright`, `other`.
- Acciones de admin sobre una denuncia: `dismiss`, `hide` (oculta la página con la nota como motivo y cierra todas sus denuncias abiertas), `force_adult` y `block_domain` (bloquea el dominio del enlace denunciado). Nada se oculta automáticamente.
- La confirmación de edad del visitante es una declaración, no una verificación: se recuerda en el navegador (`localStorage`).

### Escena por capas (5.3)

- Lienzo de `SceneWidth` × `SceneHeight` (1080 × 1350, 4:5) que se escala como un overlay. El orden de `layers` es el orden de dibujo. Una sola capa `photo`, `name` y `bio`; hasta `SceneStickersMax` (20) stickers y `SceneTextsMax` (10) textos de hasta 120 caracteres (topes técnicos, no de plan).
- Los archivos (stickers y fondo) tienen que ser de la **Galería de medios** del canal (`timer_media_files`, la misma de Timer y Alertas, con la cuota de almacenamiento por plan): `PersonalPageService.GalleryAsync` arma URL pública → tipo y `SceneErrors` lo exige al guardar y publicar (`layer_media:i`, `scene_bg_media`). Stickers: `image` o `gif`; fondo: además `video`.
- `SceneView` quita al mostrar las capas ocultas y los archivos borrados de la galería después (el fondo vuelve al patrón); `MissingSceneMedia` alimenta el aviso del panel (`missingMedia` en `GET /api/personal-page`).

## API

Panel (con sesión, dueño del canal o `control_total`; sección de permisos `personal_page`; solo en decatron.net):

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/personal-page` | Página, nombre sugerido, canal, redes, tipografías, límites, `publicOpen` y `domains` (adultos, bloqueados y acortadores, para marcar en el editor) |
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

Pública (anónima): `GET /api/public/personal-pages/{handle}` (página publicada con el +18 aplicado y sin enlaces bloqueados, `adult`, `isOwner`, `reportReasons`; o `{ redirect }` para un nombre viejo; `not_found`, `not_open`, `hidden`, `not_published`; una página +18 responde con `X-Robots-Tag: noindex`) y `GET /api/public/personal-pages/assets/{pageId}/{file}`.

Denunciar (con sesión): `POST /api/public/personal-pages/{handle}/report` `{ reason, detail?, linkId? }`.

Admin (dueño del sistema): `GET /api/admin/personal-pages`, `POST /api/admin/personal-pages/{id}/visibility`, `GET|POST /api/admin/personal-pages/reserved`, `DELETE /api/admin/personal-pages/reserved/{handle}`, `GET /api/admin/personal-pages/appeals`, `POST .../appeals/{id}/reject`, `POST .../appeals/{id}/transfer`, `POST /api/admin/personal-pages/{id}/forced-adult` `{ forced }`, `GET /api/admin/personal-pages/reports?status=`, `POST .../reports/{id}/resolve` `{ action, note }`, `GET|POST /api/admin/personal-pages/domains` `{ domain, kind, note }` y `DELETE .../domains/{domain}`.

Los errores son códigos estables (`{ code, details }`), nunca mensajes internos. Una `revision` vieja devuelve `409 stale_revision`.

Aceptar una apelación (`transfer`) da el nombre a quien la envió (y le crea la página si no tiene); el dueño actual pasa a `pagina-<id>` con `needs_new_handle = true` y puede elegir otro nombre sin esperar 30 días. Las demás apelaciones pendientes por ese nombre se rechazan.

## Front

- Panel: `/mi-pagina` (`ClientApp/src/pages/personal-page/`), pestañas Guía, Perfil, Redes y enlaces, Apariencia y Nombre, con vista previa de celular y escritorio.
- Página pública: `/@nombre` (`PersonalPagePublic.tsx`). React Router no admite `@:param`, así que la ruta es `/:atHandle` y el componente exige la `@`.
- Plantillas: `SceneTemplate.tsx`, `BadgeTemplate.tsx` (QR con el paquete `qrcode`), `ChannelTemplate.tsx`, `InventoryTemplate.tsx` y `PosterTemplate.tsx`, elegidas por `TemplateRenderer.tsx`. Todas mantienen en escritorio la composición de su maqueta, centrada y más grande, con container queries (la vista previa del panel dibuja la de celular). Maquetas: `.dev/plans/pagina-personal/maquetas/` (fuera de git).
- Escena por capas: `SceneCanvas.tsx` (lienzo con porcentajes y unidades `cqw`, mismo componente en la página y en el editor) y `SceneTab.tsx` (pestaña Escena con `OverlayCanvasEditor` y `MediaSelector` en modo `galleryOnly`).
- Puerta de edad y aviso de enlace +18: `AgeGate.tsx` (la página +18 no se dibuja hasta confirmar; en una página normal, `TemplateRenderer` tapa el título de los enlaces +18 propios y pide confirmar al tocarlos, para las cinco plantillas). Denunciar: `ReportBar.tsx`, al pie, oculto para el dueño.
- Admin: `/admin/paginas` (Denuncias, Apelaciones, Páginas, Dominios y Reservados).
- Textos: `public/locales/{es,en}/personal-page.json`; docs en `docs-personal-page.json`.

## Vista previa al compartir

`PersonalPageSharePageController` sirve `/@{handle}` con meta tags Open Graph cuando las páginas están abiertas y la página está publicada y activa; si no, las meta tags generales. Una página +18 sale neutra (solo `@nombre`, sin foto ni bio) con `robots: noindex`. Necesita un `location` de nginx para `/@…` hacia el backend (mismo patrón que la vista previa de los torneos).

## Configuración

| Clave | Por defecto | Descripción |
|---|---|---|
| `PersonalPages:PublicOpen` | `false` | Abre las páginas al público |
| `PersonalPages:PublicAssetsPath` | `/var/www/html/decatron/personal-page-assets` | Carpeta de las fotos subidas (el usuario del backend tiene que poder escribir) |

## Pruebas

`Decatron.Tests/PersonalPageTests.cs`: reglas puras (nombre, espera de 30 días, redirección, direcciones por red, foto, errores del contenido, color) y pruebas de base contra `decatron_schema` (el primero se lo queda, restricción de único, borrador/publicar/descartar, espera y redirección, recuperar un nombre viejo, reservados, transferencia por apelación, rechazar/retirar, ocultar). Subfase 5.2: dominios y subdominios, normalización de dominios, dominios protegidos, acortadores, bloqueados, +18 forzado, vista pública, y en base: guardar con dominios de admin, reglas y límite diario de denuncias, ocultar desde una denuncia, +18 forzado que se mantiene y bloquear el dominio de un enlace denunciado. Subfase 5.3: escena válida, capas con errores e índice, archivos solo de la galería, topes, vista pública sin capas ocultas ni archivos borrados, y en base: la galería del canal y archivos de otro canal rechazados.
