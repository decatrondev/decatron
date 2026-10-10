# Design system

> Español: [es/DESIGN_SYSTEM.md](es/DESIGN_SYSTEM.md)

How the dashboard and the public site get their look from one set of values, and how the owner edits those values at runtime. This page covers architecture only; internal figures and credentials are not part of it.

## Single source of truth

All visual values live in `ClientApp/src/components/ds/tokens.ts`:

- `DS_COLORS` — one palette per theme (`light`, `dark`): backgrounds, text, borders, the blue accent, status colors (`ok`, `warn`, `danger`) and the code-highlight colors (`syntaxKeyword`, `syntaxString`, `syntaxNumber`).
- `DS_SHAPE` — radii, the three control sizes (`sm`/`md`/`lg`), font weight, border width, UI font, grid and glow intensity.

At startup the app builds one `<style id="design-tokens">` from these values and the published overrides (see below), before React renders (no flash). The CSS it emits:

| Variables | Used by |
|---|---|
| `--ds-*` (hex values) | the component library (`ds.css`) and any inline style |
| `--dc-*` (`r g b` channels) | Tailwind classes `bg-ds-surface`, `text-ds-soft`, `border-ds-border/30`… (alpha works) |
| `--pub-*` (channels, always dark) | Tailwind classes `pub-*` for the public pages |

`:root` carries the light theme and `.dark` the dark theme, so every `ds-*` class follows the theme without `dark:` variants. A fixed dark panel inside a light page (for example a Discord message replica) just adds the `dark` class to its container.

## Component library

`ClientApp/src/components/ds/` (`index.tsx` + `ds.css`): `Button`, `IconButton`, `Field`, `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Tabs`, `Segmented`, `Card`, `Badge`, `Alert`, `Table`, `Modal`, `Toast`, `Empty`, `Progress`, `Spinner`. The same styles are available as plain classes (`ds-btn ds-btn--primary ds-btn--lg`, `ds-input`, `is-error`) for links and native elements.

Dashboard helpers built on top live in `ClientApp/src/components/dashboard/`: `PageHeader`, `Notices`, `toast`, `ModalShell`, `config` (cards, toggles, sliders), `PermissionPicker`, `TabIcon` (maps tab emoji identifiers to line icons).

Rules:

1. Pages do not write their own buttons, fields, cards or alerts: use the components or the `ds-*` classes. A missing variant is added to the library, not to the page.
2. Colors in pages come only from `ds-*` Tailwind classes. Status colors (green/amber/red) mean a state, never decoration; everything decorative uses the single accent blue.
3. Third-party brand colors (Twitch, Spotify, Discord…) and streamer-chosen overlay colors are content and keep their own values.
4. **Cascade:** `main.tsx` loads `ds.css` before `index.css` (Tailwind base). Tailwind's reset sets `background-color: transparent` on `button`, `[type='button']`, `[type='submit']` with the same specificity as a single class, so any `ds.css` rule that sets a `background` on a button needs two classes (`.ds-btn.ds-btn--primary`) or a `button.` prefix. Loading `ds.css` later is not an option: `.ds-input { width: 100% }` would then override Tailwind `w-*` utilities.
5. A control that hides a native input with `position: absolute` must have a `position: relative` container, or the hidden input extends the page height and creates a second scrollbar.

## Runtime editing (owner only)

`/admin/estilo` (owner role) edits the values without a deploy. Only what differs from the factory values in `tokens.ts` is stored.

- Table `design_versions` (migration `Decatron.Data/Migrations/Add_Design_Versions.sql`): one `draft`, one `published`, any number of `archived` rows; JSONB values, author, dates. Partial unique indexes enforce one draft and one published row.
- `DesignService` validates against an allow-list of color keys, ranges and fonts, versions the rows and caches the public payload for 10 minutes. The backend never generates CSS and does not know the factory colors.
- Endpoints: `GET /api/design/tokens` (public, cacheable); owner only: `GET /api/admin/design`, `PUT|DELETE /api/admin/design/draft`, `POST /api/admin/design/publish`, `POST /api/admin/design/reset`, `POST /api/admin/design/versions/{id}/restore`.
- The front end (`design/runtime.ts`) applies a cached copy first, refreshes from `/api/design/tokens`, and can preview the draft locally (`design/PreviewBanner.tsx`).
- Publishing is blocked if any text/background pair falls below WCAG AA (4.5:1); the pairs are listed in `design/contrast.ts`.

### Adding a color token

1. Add the key to `DsColors` and a value for both themes in `DS_COLORS` (`tokens.ts`).
2. Add the key to `ColorKeys` in `Decatron.Services/Design/DesignService.cs`.
3. If it is a text color, add its contrast pair(s) to `design/contrast.ts`.
4. Add a label (and group) in `pages/admin/DesignEditor.tsx`.
5. To use it with Tailwind, map it in `tailwind.config.js` under `ds` as `rgb(var(--dc-<kebab-name>) / <alpha-value>)`.

## Code highlighting

The script editor highlights with Prism using the grammar in `pages/commands/scripting/grammar.ts`; the colors come from `--ds-syntax-keyword` (blue, also functions), `--ds-syntax-string` (green, quoted text and `$(variables)`) and `--ds-syntax-number` (amber), so they are editable like any other token.
