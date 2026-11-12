# Página personal (`decatron.net/@nombre`)

Cada canal puede tener su propia página en `decatron.net/@nombre`: un enlace corto con las redes, la foto y el estilo del streamer. Es gratis y no está ligada a ningún otro módulo. Este documento cubre la subfase 5.1 (la base y las cinco plantillas: Escena, Credencial, Canal de TV, Inventario y Póster) la 5.2 (contenido para mayores de 18, dominios y denuncias) la 5.3 (escena por capas) la 5.4 (videos, fotos y sonidos), la 5.5 (en vivo, enlaces del bot y estadísticas) y la 5.10 (efectos).

> **Abierta al público desde el 2026-11-11** (`PersonalPages:PublicOpen=true`). Con la clave en `false`, una página publicada solo la ven su dueño, quienes tienen `control_total` en ese canal y los dueños del sistema, con un aviso de vista previa.

## Modelo de datos

Migraciones: `Decatron.Data/Migrations/Add_Personal_Pages.sql`, `Add_Personal_Pages_Safety.sql` (5.2) y `Add_Personal_Page_Stats.sql` (5.5), idempotentes.

| Tabla | Para qué |
|---|---|
| `personal_pages` | Una página por canal (`channel_user_id` único). `handle` único, `draft` y `published` en JSON, `status` (`active`/`hidden`), `hidden_reason`, `needs_new_handle`, `forced_adult` (admin la marcó +18), `revision` (concurrencia optimista) |
| `personal_page_handle_history` | Nombres viejos que redirigen a la página durante 30 días |
| `personal_page_reserved_handles` | Nombres reservados por admin (se suman a la lista fija `PersonalPageRules.BuiltInReserved`) |
| `personal_page_handle_appeals` | Apelaciones por un nombre tomado: quién pide, mensaje, estado (`pending`, `rejected`, `transferred`, `withdrawn`) y revisión |
| `personal_page_domains` | Dominios de admin: `adult` (fuerza +18) o `blocked` (no se puede enlazar). Se suman a las listas fijas |
| `personal_page_daily_stats` | Visitas por página y día (5.5). Solo el número: sin IP, navegador ni quién visitó |
| `personal_page_click_stats` | Clics por página, día y destino (id de enlace, `video:{id}` o `bot:{sr|tip|sprites}`) (5.5) |
| `personal_page_reports` | Denuncias: página, quién denuncia, motivo, detalle, enlace (id y URL al momento de denunciar), estado (`open`, `resolved`, `dismissed`) y resolución (`hidden`, `forced_adult`, `domain_blocked`). Una abierta por persona y página |

Todavía no hay `tenant_id`: las páginas existen solo en decatron.net. El soporte para tenants agregará la columna con RLS y el nombre pasará a ser único por tenant.

Contenido (`PersonalPageContent`, común a todas las plantillas): `displayName`, `bio`, `avatarUrl`, `template`, `theme`, `accent`, `font`, `links[]` (`id`, `kind`, `url`, `title`, `visible`, `size`, `adult`), `adult` (toda la página +18) y `scene` (5.3: `enabled`, `background` `color`/`pattern`/`media`, `bgColor`, `bgMedia`, `layers[]` con `id`, `kind` `photo`/`name`/`bio`/`sticker`/`text`, `x`, `y`, `width`, `height`, `visible`, `mediaUrl`, `text`, `font`, `color`, `size`, `align`), `videos[]` (`id`, `url`, `title`, `visible`), `photos[]` (`id`, `mediaUrl`, `caption`) y `sound` (`entryUrl`, `clickUrl`, `clickEnabled`, `volume`) de la 5.4, , `botLinks` (`songRequest`, `tips`, `sprites`) de la 5.5 y `effects` (`particles`, `density`, `color`, `shine`, `cursor`, `entrance`) de la 5.10. Cambiar de plantilla nunca pierde contenido. `template` es `scene`, `badge`, `channel`, `inventory` o `poster`; `size` (`normal`, `wide`, `big`) lo usan Inventario (casillas 1×1, 2×1, 2×2) y Póster (créditos chicos, medianos o grandes; si ninguna red está en grande, la primera se muestra grande).

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

### Videos, fotos y sonidos (5.4)

- `ParseVideo` reconoce YouTube (`youtube`, `youtube-short`), Twitch (`twitch-channel`, `twitch-video`, `twitch-clip`), Kick (`kick`) y TikTok (`tiktok`), solo `https`, y devuelve el identificador. Nunca se inserta la URL tal cual: el front arma el reproductor oficial con el identificador (YouTube con `youtube-nocookie.com`; Twitch con `parent`). El reproductor se carga al tocar «Reproducir».
- Hasta `VideosMax` (10) videos y `PhotosMax` (12) fotos, descripción hasta 80 caracteres (topes técnicos). Fotos (`image`/`gif`) y sonidos (`sound`) tienen que ser de la galería del canal, igual que la escena.
- `HasSound`: sonido de entrada, o de botones encendido, con volumen mayor que 0. Con sonido, la página muestra la puerta «Entrar» (la misma que la de +18; si es +18 es una sola puerta). `MediaView` quita al mostrar los videos ocultos y los archivos borrados de la galería; `MissingMedia` suma fotos y sonidos al aviso del panel.

### En vivo, enlaces del bot y estadísticas (5.5)

- En vivo: Twitch por `IStreamStatusService.IsLive` (lo que ya sabe el bot por EventSub) y Kick por `MultiviewStatusService.GetKickAsync` (consulta pública con caché, tope de 1,5 s); se miran también las filas vinculadas de la misma cuenta. Va en `live` de la respuesta pública; si falla, la lista sale vacía.
- Enlaces del bot: `AvailableBotLinksAsync` (Song Request encendido → `/sr/{canal}`, propinas encendidas → `/tip/{canal}`, al menos un Sprite → `/sprites/{login}`) y `ChosenBotLinks` (solo los que eligió el dueño). Van en `botLinks` y el front los suma como enlaces propios para que las cinco plantillas los dibujen.
- Estadísticas: `POST /api/public/personal-pages/{handle}/hit` `{ type: visit|click, target? }`, anónimo, siempre 204, con límite por IP (`personal-page-hit`, 60 por minuto). No cuenta a quien administra la página, solo cuenta con la página abierta al público, una visita cada 30 minutos por IP en memoria (nunca se guarda) y por marca en el navegador, y solo destinos reales (`ValidClickTarget`). Suma con `INSERT … ON CONFLICT` (sin carreras). `GET /api/personal-page/stats?days=7|30` (dueño o control total) devuelve la serie diaria con ceros y los clics por destino, y borra lo de más de 12 meses.

### Efectos (5.10)

- Listas cerradas en `PersonalPageRules`: `EffectParticles` (`none`, `sparkles`, `snow`, `confetti`, `bubbles`), `EffectDensities` (`low`, `medium`, `high`), `EffectColors` (`accent`, `white`), `EffectCursors` (`none`, `dots`, `sparkles`) y `EffectEntrances` (`none`, `fade`, `rise`, `cascade`). Todo apagado por defecto (`effects` nulo o `PersonalPageEffects()`). `Normalize` pasa a minúsculas y completa los valores por defecto; `EffectErrors` devuelve `effects_particles`, `effects_density`, `effects_color`, `effects_cursor`, `effects_entrance`. Va en el JSON del contenido: sin migración.
- Front (`PageEffects.tsx`): las partículas y la estela son un canvas 2D propio (sin librerías), dibujado dentro de la raíz de la plantilla con la prop `backdrop` y `z-index:-1` en un apilado aislado, así quedan encima del fondo y debajo del contenido; fijo a la pantalla en la página y del tamaño de la vista previa en el panel. Menos partículas en pantallas chicas, tope de 160, en pausa con la pestaña oculta o el canvas fuera de pantalla. La estela solo corre con puntero fino y deja de dibujar con el mouse quieto. El brillo y la entrada son CSS sobre las superficies de cada plantilla (`FX_SURFACES`); la cascada pone un retraso por superficie.
- Con `prefers-reduced-motion: reduce` no hay partículas, estela ni brillo, y toda entrada pasa a un aparecer de 150 ms. El visitante tiene un botón «Pausar efectos» (junto al de silenciar) cuando hay partículas o estela, recordado en `localStorage` (`decatron:pp-fx-paused`). La vista previa del panel tiene el botón «Reducir movimiento» (prop `reducedMotion`) y las miniaturas de plantillas usan `noEffects`.

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
- Efectos: `PageEffects.tsx` (partículas, estela, botón de pausa y CSS del brillo y las entradas) y la tarjeta Efectos en Apariencia.
- En vivo y estadísticas: `LiveStrip.tsx` (franja en las cinco plantillas; luz «AL AIRE» en Canal de TV), `StatsTab.tsx` (pestaña Estadísticas con gráfico de una serie y vista de tabla) y la tarjeta «Enlaces del bot» en Redes y enlaces.
- Multimedia: `MediaBlocks.tsx` (videos y fotos en las cinco plantillas, con los colores de cada una por variables `--mb-*`), `MediaTab.tsx` (pestaña Multimedia), `PageSound.tsx` (sonidos y botón para silenciar) y `EntryGate` en `AgeGate.tsx`.
- Escena por capas: `SceneCanvas.tsx` (lienzo con porcentajes y unidades `cqw`, mismo componente en la página y en el editor) y `SceneTab.tsx` (pestaña Escena con `OverlayCanvasEditor` y `MediaSelector` en modo `galleryOnly`).
- Puerta de edad y aviso de enlace +18: `AgeGate.tsx` (la página +18 no se dibuja hasta confirmar; en una página normal, `TemplateRenderer` tapa el título de los enlaces +18 propios y pide confirmar al tocarlos, para las cinco plantillas). Denunciar: `ReportBar.tsx`, al pie, oculto para el dueño.
- Admin: `/admin/paginas` (Denuncias, Apelaciones, Páginas, Dominios y Reservados).
- Textos: `public/locales/{es,en}/personal-page.json`; docs en `docs-personal-page.json`.

## Vista previa al compartir

`PersonalPageSharePageController` sirve `/@{handle}` con meta tags Open Graph cuando las páginas están abiertas y la página está publicada y activa; si no, las meta tags generales. Una página +18 sale neutra (solo `@nombre`, sin foto ni bio) con `robots: noindex`. Necesita un `location` de nginx para `/@…` hacia el backend (mismo patrón que la vista previa de los torneos).

## Configuración

| Clave | Por defecto | Descripción |
|---|---|---|
| `PersonalPages:PublicOpen` | `false` (en producción `true` desde 2026-11-11, en `appsettings.Secrets.json`) | Abre las páginas al público |
| `PersonalPages:PublicAssetsPath` | `/var/www/html/decatron/personal-page-assets` | Carpeta de las fotos subidas (el usuario del backend tiene que poder escribir) |

## Pruebas

`Decatron.Tests/PersonalPageTests.cs`: reglas puras (nombre, espera de 30 días, redirección, direcciones por red, foto, errores del contenido, color) y pruebas de base contra `decatron_schema` (el primero se lo queda, restricción de único, borrador/publicar/descartar, espera y redirección, recuperar un nombre viejo, reservados, transferencia por apelación, rechazar/retirar, ocultar). Subfase 5.2: dominios y subdominios, normalización de dominios, dominios protegidos, acortadores, bloqueados, +18 forzado, vista pública, y en base: guardar con dominios de admin, reglas y límite diario de denuncias, ocultar desde una denuncia, +18 forzado que se mantiene y bloquear el dominio de un enlace denunciado. Subfase 5.3: escena válida, capas con errores e índice, archivos solo de la galería, topes, vista pública sin capas ocultas ni archivos borrados, y en base: la galería del canal y archivos de otro canal rechazados. Subfase 5.4: enlaces de video reconocidos y rechazados, errores de videos, fotos y sonidos, topes, cuándo hay sonido, y vista pública sin videos ocultos ni archivos borrados. Subfase 5.5: destinos válidos de clic, enlaces del bot elegidos, y en base: contadores por día con ceros, clics por destino, borrado de más de 12 meses y enlaces del bot solo de módulos activos. Subfase 5.10: efectos apagados por defecto, solo valores de la lista cerrada, normalización con valores por defecto y efectos conservados en la vista pública.
