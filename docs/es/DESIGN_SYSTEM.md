# Sistema de diseño

> English: [../DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md)

Cómo el dashboard y el sitio público toman su aspecto de un único conjunto de valores y cómo el dueño los edita en vivo. Esta página cubre solo arquitectura; no incluye cifras internas ni credenciales.

## Única fuente de verdad

Todos los valores visuales viven en `ClientApp/src/components/ds/tokens.ts`:

- `DS_COLORS` — una paleta por tema (`light`, `dark`): fondos, texto, bordes, el azul de acción, los colores de estado (`ok`, `warn`, `danger`) y los del resaltado de código (`syntaxKeyword`, `syntaxString`, `syntaxNumber`).
- `DS_SHAPE` — radios, los tres tamaños de control (`sm`/`md`/`lg`), peso de letra, grosor de borde, tipografía de la interfaz, intensidad de la cuadrícula y del resplandor.

Al arrancar, la app arma un único `<style id="design-tokens">` con estos valores y los publicados desde el editor (ver abajo), antes de que React dibuje (sin parpadeo). El CSS que emite:

| Variables | Las usa |
|---|---|
| `--ds-*` (valores hex) | la librería de componentes (`ds.css`) y estilos en línea |
| `--dc-*` (canales `r g b`) | clases Tailwind `bg-ds-surface`, `text-ds-soft`, `border-ds-border/30`… (la opacidad funciona) |
| `--pub-*` (canales, siempre oscuras) | clases Tailwind `pub-*` de las páginas públicas |

`:root` lleva el tema claro y `.dark` el oscuro, así que toda clase `ds-*` sigue el tema sin variantes `dark:`. Un panel oscuro fijo dentro de una página clara (por ejemplo la réplica de un mensaje de Discord) solo añade la clase `dark` a su contenedor.

## Librería de componentes

`ClientApp/src/components/ds/` (`index.tsx` + `ds.css`): `Button`, `IconButton`, `Field`, `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Tabs`, `Segmented`, `Card`, `Badge`, `Alert`, `Table`, `Modal`, `Toast`, `Empty`, `Progress`, `Spinner`. Los mismos estilos existen como clases (`ds-btn ds-btn--primary ds-btn--lg`, `ds-input`, `is-error`) para enlaces y elementos nativos.

Las piezas del dashboard construidas encima están en `ClientApp/src/components/dashboard/`: `PageHeader`, `Notices`, `toast`, `ModalShell`, `config` (tarjetas, interruptores, deslizadores), `PermissionPicker` y `TabIcon` (convierte los emojis identificadores de pestaña en iconos de línea).

Reglas:

1. Las páginas no escriben sus propios botones, campos, tarjetas ni avisos: usan los componentes o las clases `ds-*`. Si falta una variante, se añade a la librería, no a la página.
2. Los colores de las páginas salen solo de clases Tailwind `ds-*`. Verde, ámbar y rojo significan un estado, nunca decoración; lo decorativo usa el azul único.
3. Los colores de marcas de terceros (Twitch, Spotify, Discord…) y los que elige el streamer para sus overlays son contenido y conservan su valor.
4. **Cascada:** `main.tsx` carga `ds.css` antes que `index.css` (base de Tailwind). El reset de Tailwind fija `background-color: transparent` en `button`, `[type='button']` y `[type='submit']` con la misma especificidad que una sola clase; por eso toda regla de `ds.css` que ponga `background` a un botón necesita dos clases (`.ds-btn.ds-btn--primary`) o el prefijo `button.`. Cargar `ds.css` después no es opción: `.ds-input { width: 100% }` taparía las utilidades `w-*` de Tailwind.
5. Un control que oculta un input nativo con `position: absolute` debe tener un contenedor `position: relative`; si no, el input oculto alarga la página y aparece un segundo scroll.

## Edición en vivo (solo dueño)

`/admin/estilo` (rol dueño) edita los valores sin desplegar. Solo se guarda lo que difiere de los valores de fábrica de `tokens.ts`.

- Tabla `design_versions` (migración `Decatron.Data/Migrations/Add_Design_Versions.sql`): un borrador (`draft`), una versión publicada (`published`) y las que se quieran archivadas (`archived`); valores en JSONB, autor y fechas. Índices únicos parciales garantizan un borrador y una publicada.
- `DesignService` valida contra una lista blanca de claves de color, rangos y tipografías, versiona las filas y cachea 10 minutos lo que entrega al público. El backend no genera CSS ni conoce los colores de fábrica.
- Endpoints: `GET /api/design/tokens` (público, cacheable); solo dueño: `GET /api/admin/design`, `PUT|DELETE /api/admin/design/draft`, `POST /api/admin/design/publish`, `POST /api/admin/design/reset`, `POST /api/admin/design/versions/{id}/restore`.
- El front (`design/runtime.ts`) aplica primero una copia guardada, la refresca desde `/api/design/tokens` y puede previsualizar el borrador en local (`design/PreviewBanner.tsx`).
- No se puede publicar si algún par texto/fondo baja de WCAG AA (4,5:1); los pares están en `design/contrast.ts`.

### Agregar un color nuevo

1. Añadir la clave a `DsColors` y un valor para ambos temas en `DS_COLORS` (`tokens.ts`).
2. Añadir la clave a `ColorKeys` en `Decatron.Services/Design/DesignService.cs`.
3. Si es un color de texto, añadir su(s) par(es) de contraste en `design/contrast.ts`.
4. Añadir etiqueta (y grupo) en `pages/admin/DesignEditor.tsx`.
5. Para usarlo con Tailwind, mapearlo en `tailwind.config.js` bajo `ds` como `rgb(var(--dc-<nombre-en-kebab>) / <alpha-value>)`.

## Resaltado de código

El editor de scripts resalta con Prism usando la gramática de `pages/commands/scripting/grammar.ts`; los colores salen de `--ds-syntax-keyword` (azul, también funciones), `--ds-syntax-string` (verde, textos entre comillas y `$(variables)`) y `--ds-syntax-number` (ámbar), así que se editan como cualquier otro token.
